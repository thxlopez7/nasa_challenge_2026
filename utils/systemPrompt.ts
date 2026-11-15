import {
  formatOneWayLatency,
  getMissionComms,
  type SupportedLang,
} from '../config/missionComms';
import type { MissionProfileId } from '../types/mission';
import type { Biomarkers, ClinicalAlerts, Environment } from '../types/telemetry';

export type TelemetryPayload = Partial<
  Biomarkers & Environment & ClinicalAlerts
> &
  Record<string, unknown>;

export interface ClinicalPromptOptions {
  missionProfileId?: MissionProfileId;
  lang?: SupportedLang;
}

const CLINICAL_TELEMETRY_KEYS: ReadonlyArray<
  keyof (Biomarkers & Environment & ClinicalAlerts)
> = [
  'heartRate',
  'spO2',
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
];

/**
 * Extrae únicamente las métricas biométricas, ambientales y alertas clínicas
 * para no contaminar el contexto del LLM con banderas internas de UI/Store.
 */
function extractCleanTelemetry(
  telemetry: TelemetryPayload
): Record<string, unknown> {
  const cleanSnapshot: Record<string, unknown> = {};

  for (const key of CLINICAL_TELEMETRY_KEYS) {
    if (telemetry[key] !== undefined && typeof telemetry[key] !== 'function') {
      cleanSnapshot[key] = telemetry[key];
    }
  }

  return Object.keys(cleanSnapshot).length > 0 ? cleanSnapshot : telemetry;
}

/**
 * Construye el System Instruction dinámico para el Cirujano de Vuelo Autónomo,
 * inyectando telemetría, perfil de latencia real de la misión e idioma activo.
 */
export function generateClinicalPrompt(
  telemetry: TelemetryPayload,
  options: ClinicalPromptOptions = {}
): string {
  const cleanTelemetry = extractCleanTelemetry(telemetry);
  const lang: SupportedLang = options.lang === 'en' ? 'en' : 'es';
  const profileId: MissionProfileId = options.missionProfileId ?? 'MARS_CONJUNCTION';
  const comms = getMissionComms(profileId);
  const latencyText = formatOneWayLatency(profileId, lang);

  if (lang === 'en') {
    const basePrompt = `You are ExoVitals, an onboard autonomous clinical support assistant for spaceflight crew. Active mission: ${profileId}. Earth link profile: ${comms.commsMode.en} (one-way delay ${latencyText}; ${comms.operationalNote.en}). The crew member is NOT a physician: speak directly, calmly, empirically, with brief numbered step-by-step actions.`;
    const telemetryInjection = `\n\n--- LIVE CREW TELEMETRY ---\n${JSON.stringify(cleanTelemetry, null, 2)}`;
    const clinicalRules = `\n\n--- CLINICAL SAFETY PROTOCOL ---
1. Keep guidance concise and glanceable.
2. Prioritize immediate countermeasures if telemetry shows active anomalies.
3. Never invent metrics, diagnoses, or citations outside provided telemetry.
4. Clearly remind the user when to escalate to Ground Flight Surgeons vs self-manage.
5. Respond exclusively in English.`;
    return `${basePrompt}${telemetryInjection}${clinicalRules}`;
  }

  const basePrompt = `Eres ExoVitals, el sistema de soporte clínico autónomo de a bordo. Misión activa: ${profileId}. Enlace con Tierra: ${comms.commsMode.es} (latencia unidireccional ${latencyText}; ${comms.operationalNote.es}). El astronauta NO es médico: háblale directo, empático y con pasos numerados breves.`;

  const telemetryInjection = `\n\n--- ESTADO CLÍNICO ACTUAL DEL ASTRONAUTA ---\n${JSON.stringify(
    cleanTelemetry,
    null,
    2
  )}`;

  const clinicalRules = `\n\n--- REGLAS DE PROTOCOLO CLÍNICO ---
1. Respuestas ultracortas y accionables (glanceable).
2. Priorizar contramedidas inmediatas si los datos muestran anomalías.
3. No inventar diagnósticos ni valores fuera de la telemetría provista.
4. Indicar cuándo basta autocuidado vs escalar al Cirujano de Vuelo.
5. Si isEmergency es true, priorizar estabilización inmediata.
6. Responde exclusivamente en español.`;

  return `${basePrompt}${telemetryInjection}${clinicalRules}`;
}
