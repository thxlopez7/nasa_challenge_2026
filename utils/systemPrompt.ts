import {
  formatOneWayLatency,
  getMissionComms,
  type SupportedLang,
} from '../config/missionComms';
import type { MissionProfileId } from '../types/mission';
import type {
  Biomarkers,
  ClinicalAlerts,
  Environment,
  TelemetryState,
} from '../types/telemetry';

export type TelemetryPayload = Partial<TelemetryState> &
  Record<string, unknown>;

export interface ClinicalPromptOptions {
  missionProfileId?: MissionProfileId;
  lang?: SupportedLang;
}

const CLINICAL_TELEMETRY_KEYS: ReadonlyArray<
  keyof (Biomarkers & Environment & ClinicalAlerts) | 'measuredAt' | 'source' | 'escalationLevel'
> = [
  'heartRate',
  'spO2',
  'systolicMmHg',
  'diastolicMmHg',
  'glucoseMgDl',
  'glucoseContext',
  'bodyTempC',
  'cistatinaC',
  'creatinina',
  'calcioIonico',
  'linfocitos',
  'neutrofilos',
  'cortisol',
  'co2Level',
  'radiationRate',
  'radiationAccumulated',
  'isEmergency',
  'isRenalWarning',
  'isRadiationWarning',
  'isCo2Warning',
  'escalationLevel',
  'measuredAt',
  'source',
];

/**
 * Extrae telemetría somática y ambiental; nunca incluye datos psicológicos/conductuales
 * (`behavioralCheckIn`) a menos que el tripulante haya dado opt-in explícito (`sharePsychWithAi === true`).
 */
function extractCleanTelemetry(telemetry: TelemetryPayload): {
  snapshot: Record<string, unknown>;
  psychShared: boolean;
} {
  const cleanSnapshot: Record<string, unknown> = {};

  for (const key of CLINICAL_TELEMETRY_KEYS) {
    if (telemetry[key] !== undefined && typeof telemetry[key] !== 'function') {
      cleanSnapshot[key] = telemetry[key];
    }
  }

  const checkIn = telemetry.behavioralCheckIn;
  const optIn = telemetry.sharePsychWithAi === true && checkIn?.sharePsychWithAi === true;

  if (optIn && checkIn) {
    cleanSnapshot.behavioralCheckIn = {
      mood: checkIn.mood,
      sleepQuality: checkIn.sleepQuality,
      fatigue: checkIn.fatigue,
      stress: checkIn.stress,
      workload: checkIn.workload,
      socialContact: checkIn.socialContact,
      phq2Total: checkIn.phq2Anhedonia + checkIn.phq2Dysphoria,
      behavioralRiskIndex: checkIn.behavioralRiskIndex,
      selfHarmFlag: checkIn.selfHarmFlag,
      updatedAt: checkIn.updatedAt,
    };
  }

  return {
    snapshot: Object.keys(cleanSnapshot).length > 0 ? cleanSnapshot : {},
    psychShared: optIn,
  };
}

/**
 * Construye el System Instruction dinámico para el Asistente Clínico Autónomo,
 * aplicando filtro de privacidad psicológica e inyectando latencia real e idioma.
 */
export function generateClinicalPrompt(
  telemetry: TelemetryPayload,
  options: ClinicalPromptOptions = {}
): string {
  const { snapshot, psychShared } = extractCleanTelemetry(telemetry);
  const lang: SupportedLang = options.lang === 'en' ? 'en' : 'es';
  const profileId: MissionProfileId = options.missionProfileId ?? 'MARS_CONJUNCTION';
  const comms = getMissionComms(profileId);
  const latencyText = formatOneWayLatency(profileId, lang);

  const privacyNote = psychShared
    ? ''
    : lang === 'en'
      ? '\n[PRIVACY BOUNDARY]: Crew behavioral/PHQ-2 check-in is kept private onboard (opt-in disabled). Do not reference excluded psychological check-in scores.'
      : '\n[LÍMITE DE PRIVACIDAD]: El check-in conductual/PHQ-2 permanece privado a bordo (opt-in desactivado). No menciones ni supongas puntuaciones psicológicas excluidas.';

  if (lang === 'en') {
    const basePrompt = `You are ExoVitals, an onboard autonomous clinical support assistant for spaceflight crew. Active mission: ${profileId}. Earth link profile: ${comms.commsMode.en} (one-way delay ${latencyText}; ${comms.operationalNote.en}). The crew member is NOT a physician: speak directly, calmly, with brief numbered actions.`;
    const telemetryInjection = `\n\n--- LIVE CREW TELEMETRY ---\n${JSON.stringify(snapshot, null, 2)}${privacyNote}`;
    const clinicalRules = `\n\n--- CLINICAL SAFETY PROTOCOL ---
1. Keep guidance concise and glanceable.
2. State clearly whether self-care suffices, Flight Surgeon notification is warranted, or emergency action is needed.
3. Never invent metrics, diagnoses, or citations outside provided telemetry.
4. Note outdated/missing measurements when relevant.
5. Respond exclusively in English.`;
    return `${basePrompt}${telemetryInjection}${clinicalRules}`;
  }

  const basePrompt = `Eres ExoVitals, el sistema de soporte clínico autónomo de a bordo. Misión activa: ${profileId}. Enlace con Tierra: ${comms.commsMode.es} (latencia unidireccional ${latencyText}; ${comms.operationalNote.es}). El astronauta NO es médico: háblale directo, empático y con pasos numerados breves.`;

  const telemetryInjection = `\n\n--- ESTADO CLÍNICO ACTUAL DEL ASTRONAUTA ---\n${JSON.stringify(
    snapshot,
    null,
    2
  )}${privacyNote}`;

  const clinicalRules = `\n\n--- REGLAS DE PROTOCOLO CLÍNICO ---
1. Respuestas ultracortas y accionables (glanceable).
2. Diferenciar claramente entre autocuidado, consulta al Cirujano de Vuelo y emergencia.
3. No inventar diagnósticos ni valores fuera de la telemetría provista.
4. Señalar si alguna medición crítica está desactualizada o ausente.
5. Si isEmergency es true, priorizar estabilización inmediata.
6. Responde exclusivamente en español.`;

  return `${basePrompt}${telemetryInjection}${clinicalRules}`;
}
