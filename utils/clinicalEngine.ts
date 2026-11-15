import {
  CLINICAL_RULE_THRESHOLDS,
  CLINICAL_RULES,
  type ComparisonOperator,
  type CriterionTrace,
  type RuleEvaluationInput,
  type RuleEvaluationTrace,
} from '../config/rules';
import type { MissionProfileHook } from '../config/missionProfile';
import type {
  AlertSeverity,
  Biomarkers,
  ClinicalAlerts,
  Environment,
  TelemetryData,
} from '../types/telemetry';

/**
 * Motor Clínico Determinista Edge-First — Matriz RIDGE y Trazabilidad de Reglas.
 *
 * Funciones puras, sin I/O ni dependencia de la Tierra: se ejecutan a bordo en
 * cada tick de telemetría (latencia < 1 ms). El contrato `ClinicalAlerts` expone
 * tres banderas automáticas más la emergencia manual:
 *
 *   R — Radiation       → isRadiationWarning (Regla 2)
 *   G — Gravity         → isRenalWarning     (Regla 1)
 *   E — Hostile Env.    → isCo2Warning       (Regla 3)
 *   I / D — Isolation y Distance se abordan con el check-in conductual,
 *   contramedidas y arquitectura offline-first.
 */

/** Umbrales clínicos de cada regla. Respaldados por `config/rules.ts` (única fuente de verdad). */
export const RIDGE_THRESHOLDS = {
  renal: CLINICAL_RULE_THRESHOLDS.renal,
  radiation: CLINICAL_RULE_THRESHOLDS.radiation,
  co2: CLINICAL_RULE_THRESHOLDS.co2,
} as const;

type SensorReadings = Biomarkers & Environment;
type AutomaticAlerts = Omit<ClinicalAlerts, 'isEmergency'>;

/** Una lectura sólo participa en una regla si es un número finito y no negativo. */
const isValidReading = (value: number): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Ratio neutrófilos / linfocitos (NLR).
 * Devuelve `Infinity` con linfocitos en 0 y neutrófilos presentes positivos (linfopenia
 * absoluta), y `NaN` si ninguna lectura es interpretable o si hay valores negativos.
 */
export function computeNlr(
  bio: Pick<Biomarkers, 'neutrofilos' | 'linfocitos'>
): number {
  if (
    !isValidReading(bio.neutrofilos) ||
    !isValidReading(bio.linfocitos)
  ) {
    return Number.NaN;
  }
  return bio.neutrofilos / bio.linfocitos;
}

/** Regla 1 — Nefropatía oculta o progresiva en microgravedad (gravedad alterada). */
export function isHiddenNephropathy(bio: Biomarkers): boolean {
  const t = RIDGE_THRESHOLDS.renal;
  if (
    ![bio.creatinina, bio.cistatinaC, bio.calcioIonico].every(isValidReading) ||
    bio.creatinina <= 0
  ) {
    return false;
  }

  const isCreatinineMaskedOrDisproportionate =
    bio.creatinina <= t.maxCreatinina ||
    bio.cistatinaC / bio.creatinina > t.minCisCrRatio;

  return (
    isCreatinineMaskedOrDisproportionate &&
    bio.cistatinaC > t.minCistatinaC &&
    bio.calcioIonico > t.minCalcioIonico
  );
}

/** Regla 2 — Inmunosupresión por radiación. */
export function isRadiationImmunosuppression(
  bio: Biomarkers,
  env: Environment
): boolean {
  const t = RIDGE_THRESHOLDS.radiation;
  if (
    ![
      env.radiationRate,
      env.radiationAccumulated,
      bio.linfocitos,
      bio.neutrofilos,
    ].every(isValidReading)
  ) {
    return false;
  }

  const nlr = computeNlr(bio);
  const hasHighRadiationExposure =
    env.radiationRate > t.minRadiationRate ||
    env.radiationAccumulated > t.minRadiationAccumulated;

  return (
    hasHighRadiationExposure &&
    bio.linfocitos < t.maxLinfocitos &&
    nlr > t.minNlr
  );
}

/** Regla 3 — Bolsillo de CO2 (hipercapnia con SpO2 conservada). */
export function isCo2Pocket(bio: Biomarkers, env: Environment): boolean {
  const t = RIDGE_THRESHOLDS.co2;
  if (![env.co2Level, bio.spO2].every(isValidReading)) {
    return false;
  }
  return env.co2Level > t.minCo2Level && bio.spO2 >= t.minSpO2;
}

/**
 * Evalúa las reglas automáticas. `isEmergency` queda fuera porque es un
 * override manual (Code Red) que el motor nunca debe apagar por sí mismo.
 */
export function evaluateTelemetry(
  bio: Biomarkers,
  env: Environment
): AutomaticAlerts {
  return {
    isRenalWarning: isHiddenNephropathy(bio),
    isRadiationWarning: isRadiationImmunosuppression(bio, env),
    isCo2Warning: isCo2Pocket(bio, env),
  };
}

/**
 * Devuelve el conjunto completo de `ClinicalAlerts` conservando el estado
 * actual de la emergencia manual.
 */
export function evaluateClinicalAlerts(
  readings: SensorReadings,
  isEmergency: boolean
): ClinicalAlerts {
  return { isEmergency, ...evaluateTelemetry(readings, readings) };
}

/**
 * Severidad global para la UI:
 *   CRITICAL — emergencia manual activa.
 *   WARNING  — al menos una regla RIDGE disparada.
 *   OPTIMAL  — sin alertas.
 */
export function getAlertSeverity(alerts: ClinicalAlerts): AlertSeverity {
  if (alerts.isEmergency) return 'CRITICAL';
  if (alerts.isRenalWarning || alerts.isRadiationWarning || alerts.isCo2Warning) {
    return 'WARNING';
  }
  return 'OPTIMAL';
}

/** Atajo para componentes que ya tienen el estado completo del store. */
export function getTelemetrySeverity(data: TelemetryData): AlertSeverity {
  return getAlertSeverity(data);
}

function compareCriterion(
  actual: number,
  operator: ComparisonOperator,
  threshold: number
): boolean {
  switch (operator) {
    case '>':
      return actual > threshold;
    case '>=':
      return actual >= threshold;
    case '<':
      return actual < threshold;
    case '<=':
      return actual <= threshold;
    case '==':
      return actual === threshold;
  }
}

/**
 * Evalúa todas las reglas declarativas de `config/rules.ts` y produce la traza
 * explicable por criterio (`passed`, `missing`, `actualValue`, `threshold`).
 * Función pura y determinista (< 1 ms).
 * `_profileHook` queda reservado para integración futura del bloque P5.
 */
export function evaluateRulesWithTrace(
  readings: Partial<RuleEvaluationInput>,
  _profileHook?: MissionProfileHook
): RuleEvaluationTrace[] {
  void _profileHook;

  const safeInput: RuleEvaluationInput = {
    heartRate: readings.heartRate ?? Number.NaN,
    spO2: readings.spO2 ?? Number.NaN,
    cistatinaC: readings.cistatinaC ?? Number.NaN,
    creatinina: readings.creatinina ?? Number.NaN,
    calcioIonico: readings.calcioIonico ?? Number.NaN,
    linfocitos: readings.linfocitos ?? Number.NaN,
    neutrofilos: readings.neutrofilos ?? Number.NaN,
    cortisol: readings.cortisol ?? Number.NaN,
    systolicMmHg: readings.systolicMmHg,
    diastolicMmHg: readings.diastolicMmHg,
    glucoseMgDl: readings.glucoseMgDl,
    glucoseContext: readings.glucoseContext,
    bodyTempC: readings.bodyTempC,
    co2Level: readings.co2Level ?? Number.NaN,
    radiationRate: readings.radiationRate ?? Number.NaN,
    radiationAccumulated: readings.radiationAccumulated ?? Number.NaN,
    isEmergency: readings.isEmergency,
    behavioralCheckIn: readings.behavioralCheckIn,
  };

  return CLINICAL_RULES.map((rule) => {
    const criteriaTrace: CriterionTrace[] = rule.criteria.map((c) => {
      const thresholdValue =
        typeof c.threshold === 'function' ? c.threshold(safeInput) : c.threshold;
      const thresholdNote = c.thresholdNote ? c.thresholdNote(safeInput) : undefined;
      const raw = c.extract(safeInput);

      const isValidExtracted =
        typeof raw === 'number' &&
        !Number.isNaN(raw) &&
        (c.allowInfinity ? true : Number.isFinite(raw));

      if (!isValidExtracted) {
        return {
          id: c.id,
          label: c.label,
          group: c.group,
          operator: c.operator,
          threshold: thresholdValue,
          thresholdNote,
          actualValue: null,
          unit: c.unit,
          decimals: c.decimals ?? 2,
          passed: false,
          missing: true,
        };
      }

      return {
        id: c.id,
        label: c.label,
        group: c.group,
        operator: c.operator,
        threshold: thresholdValue,
        thresholdNote,
        actualValue: raw,
        unit: c.unit,
        decimals: c.decimals ?? 2,
        passed: compareCriterion(raw, c.operator, thresholdValue),
        missing: false,
      };
    });

    const hasMissingInputs = criteriaTrace.some((c) => c.missing);

    const allGroup = criteriaTrace.filter((c) => c.group === 'all');
    const allGroupPassed = allGroup.every((c) => c.passed && !c.missing);

    const orGroupNames = new Set(
      criteriaTrace
        .filter((c) => c.group.startsWith('or:'))
        .map((c) => c.group)
    );

    let allOrGroupsPassed = true;
    for (const groupName of orGroupNames) {
      const members = criteriaTrace.filter((c) => c.group === groupName);
      if (!members.some((c) => c.passed && !c.missing)) {
        allOrGroupsPassed = false;
        break;
      }
    }

    const triggered =
      criteriaTrace.length > 0 && allGroupPassed && allOrGroupsPassed;

    const escalation =
      rule.id === 'R8_BEHAVIORAL_RISK' && safeInput.behavioralCheckIn?.selfHarmFlag
        ? 'emergency'
        : rule.escalation;

    return {
      ruleId: rule.id,
      shortCode: rule.shortCode,
      version: rule.version,
      system: rule.system,
      severity: triggered ? rule.severity : 'OPTIMAL',
      configuredSeverity: rule.severity,
      escalation,
      triggered,
      hasMissingInputs,
      title: rule.title,
      summary: rule.summary,
      rationale: rule.rationale,
      limitations: rule.limitations,
      actionSummary: rule.actionSummary,
      source: rule.source,
      verified: rule.verified,
      verificationTodo: rule.verificationTodo,
      criteria: criteriaTrace,
    };
  });
}
