import type { RuleEvaluationTrace, RuleId } from '../config/rules';
import type { SupportedLang } from '../config/missionComms';
import { ONBOARD_PROTOCOLS_EN } from '../content/protocols.en';
import { ONBOARD_PROTOCOLS_ES } from '../content/protocols.es';
import type { OnboardProtocol, ProtocolKey } from '../content/protocolTypes';
import type { EscalationLevel, TelemetryData } from '../types/telemetry';
import { deriveEscalationLevel } from './behavioralScoring';

export interface LocalTriageReport {
  mode: 'deterministic-offline';
  lang: SupportedLang;
  escalationLevel: EscalationLevel;
  headline: string;
  activeRuleIds: RuleId[];
  matchedProtocolIds: ProtocolKey[];
  protocols: OnboardProtocol[];
  immediateSteps: string[];
  redFlags: string[];
  sbarSummary: {
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
  };
}

const RULE_PRIORITY: Record<ProtocolKey, number> = {
  R4_CODE_RED_EMERGENCY: 0,
  R3_CO2_SUBCLINICAL: 1,
  R2_RADIATION_IMMUNOSUPPRESSION: 2,
  R1_HIDDEN_NEPHROPATHY: 3,
  R5_BLOOD_PRESSURE: 4,
  R6_DYSGLYCEMIA: 5,
  R7_THERMAL_ANOMALY: 6,
  R8_BEHAVIORAL_RISK: 7,
  NOMINAL: 8,
};

function normalizeQuery(raw?: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Motor determinista de Triaje Local 100% offline (< 1 ms).
 * Combina las reglas activas en `RuleTrace`, síntomas/palabras clave ingresadas
 * por el astronauta y los protocolos verificados a bordo sin usar red ni IA.
 */
export function runLocalTriage(
  telemetry: Partial<TelemetryData>,
  ruleTraces: RuleEvaluationTrace[],
  lang: SupportedLang,
  query?: string
): LocalTriageReport {
  const catalog = lang === 'en' ? ONBOARD_PROTOCOLS_EN : ONBOARD_PROTOCOLS_ES;

  const triggeredIds = ruleTraces
    .filter((r) => r.triggered)
    .map((r) => r.ruleId);

  const normalizedQuery = normalizeQuery(query);
  const keywordMatches: ProtocolKey[] = [];

  if (normalizedQuery.length > 0) {
    for (const protocol of Object.values(catalog)) {
      if (protocol.id === 'NOMINAL') continue;
      const hit = protocol.keywords.some((kw) =>
        normalizedQuery.includes(normalizeQuery(kw))
      );
      if (hit) keywordMatches.push(protocol.id);
    }
  }

  const uniqueKeys = Array.from(new Set<ProtocolKey>([...triggeredIds, ...keywordMatches]));
  if (uniqueKeys.length === 0) {
    uniqueKeys.push('NOMINAL');
  }

  uniqueKeys.sort((a, b) => RULE_PRIORITY[a] - RULE_PRIORITY[b]);

  const protocols = uniqueKeys.map((k) => catalog[k]);
  const primary = protocols[0] ?? catalog.NOMINAL;

  const safeBio = {
    heartRate: telemetry.heartRate ?? 72,
    spO2: telemetry.spO2 ?? 99,
    cistatinaC: telemetry.cistatinaC ?? 0.8,
    creatinina: telemetry.creatinina ?? 1.1,
    calcioIonico: telemetry.calcioIonico ?? 1.1,
    linfocitos: telemetry.linfocitos ?? 1500,
    neutrofilos: telemetry.neutrofilos ?? 3000,
    cortisol: telemetry.cortisol ?? 10,
    systolicMmHg: telemetry.systolicMmHg,
    diastolicMmHg: telemetry.diastolicMmHg,
    glucoseMgDl: telemetry.glucoseMgDl,
    glucoseContext: telemetry.glucoseContext,
    bodyTempC: telemetry.bodyTempC,
  };

  const escalationLevel = deriveEscalationLevel({
    alerts: {
      isEmergency: Boolean(telemetry.isEmergency),
      isRenalWarning: Boolean(telemetry.isRenalWarning),
      isRadiationWarning: Boolean(telemetry.isRadiationWarning),
      isCo2Warning: Boolean(telemetry.isCo2Warning),
    },
    biomarkers: safeBio,
    behavioralCheckIn: telemetry.behavioralCheckIn,
  });

  const immediateSteps = Array.from(
    new Set(protocols.flatMap((p) => p.immediateSteps))
  ).slice(0, 8);

  const redFlags = Array.from(
    new Set(protocols.flatMap((p) => p.redFlags))
  ).slice(0, 6);

  const co2 = telemetry.co2Level ?? 600;
  const radRate = telemetry.radiationRate ?? 15.5;
  const radAcc = telemetry.radiationAccumulated ?? 45;
  const nlr =
    safeBio.linfocitos > 0
      ? (safeBio.neutrofilos / safeBio.linfocitos).toFixed(2)
      : '∞';
  const bpStr =
    safeBio.systolicMmHg !== undefined && safeBio.diastolicMmHg !== undefined
      ? `${safeBio.systolicMmHg}/${safeBio.diastolicMmHg} mmHg`
      : lang === 'en'
        ? 'Not captured'
        : 'Sin captura';

  const activeTitles = triggeredIds
    .map((id) => catalog[id].title)
    .join('; ');

  const sbarSummary =
    lang === 'en'
      ? {
          situation:
            triggeredIds.length > 0
              ? `Escalation: ${escalationLevel.toUpperCase()} — Active alerts: ${activeTitles}.`
              : `Escalation: ${escalationLevel.toUpperCase()} — Routine onboard medical review.`,
          background: `HR ${safeBio.heartRate} bpm · SpO₂ ${safeBio.spO2}% · BP ${bpStr} · CO₂ ${co2} ppm · Rad ${radRate} µSv/h (${radAcc} mSv cum.) · CysC ${safeBio.cistatinaC} mg/L / Cr ${safeBio.creatinina} mg/dL · Ca²⁺ ${safeBio.calcioIonico} mmol/L · NLR ${nlr}.`,
          assessment: `${primary.headline}${query ? ` Crew query: "${query.trim().slice(0, 140)}".` : ''}`,
          recommendation: immediateSteps.slice(0, 3).join(' '),
        }
      : {
          situation:
            triggeredIds.length > 0
              ? `Escalamiento: ${escalationLevel.toUpperCase()} — Reglas activas: ${activeTitles}.`
              : `Escalamiento: ${escalationLevel.toUpperCase()} — Revisión clínica rutinaria a bordo.`,
          background: `FC ${safeBio.heartRate} lpm · SpO₂ ${safeBio.spO2}% · PA ${bpStr} · CO₂ ${co2} ppm · Rad ${radRate} µSv/h (${radAcc} mSv acum.) · CisC ${safeBio.cistatinaC} mg/L / Cr ${safeBio.creatinina} mg/dL · Ca²⁺ ${safeBio.calcioIonico} mmol/L · NLR ${nlr}.`,
          assessment: `${primary.headline}${query ? ` Consulta de tripulación: "${query.trim().slice(0, 140)}".` : ''}`,
          recommendation: immediateSteps.slice(0, 3).join(' '),
        };

  return {
    mode: 'deterministic-offline',
    lang,
    escalationLevel,
    headline: primary.headline,
    activeRuleIds: triggeredIds,
    matchedProtocolIds: uniqueKeys,
    protocols,
    immediateSteps,
    redFlags,
    sbarSummary,
  };
}
