import type {
  AlertSeverity,
  Biomarkers,
  ClinicalAlerts,
  Environment,
  TelemetryData,
} from '../types/telemetry';

/**
 * Motor Clínico Determinista Edge-First — Matriz RIDGE.
 *
 * Funciones puras, sin I/O ni dependencia de la Tierra: se ejecutan a bordo en
 * cada tick de telemetría (latencia cero). El contrato `ClinicalAlerts` expone
 * tres banderas automáticas más la emergencia manual:
 *
 *   R — Radiation       → isRadiationWarning (Regla 2)
 *   G — Gravity         → isRenalWarning     (Regla 1)
 *   E — Hostile Env.    → isCo2Warning       (Regla 3)
 *   I / D — Isolation y Distance no tienen bandera en el contrato: se abordan
 *   con las contramedidas de bienestar y la arquitectura offline-first.
 */

/** Umbrales clínicos de cada regla. Única fuente de verdad para motor y UI. */
export const RIDGE_THRESHOLDS = {
  renal: {
    /** Creatinina normal o baja (mg/dL): enmascara el daño en microgravedad */
    maxCreatinina: 1.1,
    /** Cistatina C elevada (mg/L) */
    minCistatinaC: 1.15,
    /** Calcio iónico elevado (mmol/L): resorción ósea */
    minCalcioIonico: 1.25,
    /** Ratio Cistatina C / Creatinina cuando ambas suben en daño renal franco */
    minCisCrRatio: 1.2,
  },
  radiation: {
    /** Tasa de dosis actual (µSv/h) */
    minRadiationRate: 50.0,
    /** Dosis acumulada de misión (mSv) */
    minRadiationAccumulated: 50.0,
    /** Linfopenia (cél/µL) */
    maxLinfocitos: 1000,
    /** Ratio neutrófilos / linfocitos */
    minNlr: 3.0,
  },
  co2: {
    /** Hipercapnia ambiental (ppm) */
    minCo2Level: 3500,
    /** SpO2 conservada (%): el CO2 no se manifiesta en el pulsioxímetro */
    minSpO2: 96,
  },
} as const;

type SensorReadings = Biomarkers & Environment;
type AutomaticAlerts = Omit<ClinicalAlerts, 'isEmergency'>;

/** Una lectura sólo participa en una regla si es un número finito y no negativo. */
const isValidReading = (value: number): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Ratio neutrófilos / linfocitos (NLR).
 * Devuelve `Infinity` con linfocitos en 0 y neutrófilos presentes (linfopenia
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
