import { Biomarkers, ClinicalAlerts, Environment } from '../types/telemetry';

export type TelemetryPayload = Partial<
  Biomarkers & Environment & ClinicalAlerts
> &
  Record<string, unknown>;

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
 * inyectando la telemetría biométrica y ambiental actual del astronauta en tiempo real.
 */
export function generateClinicalPrompt(telemetry: TelemetryPayload): string {
  const cleanTelemetry = extractCleanTelemetry(telemetry);

  const basePrompt =
    'Eres ExoVitals, el sistema de soporte vital avanzado y Oficial Médico Autónomo de a bordo. Tu misión es hacer triaje y guiar al astronauta en emergencias porque la Tierra tiene un retraso de comunicación de 20 minutos. El usuario no es doctor, háblale de forma directa, empática y con instrucciones numeradas paso a paso.';

  const telemetryInjection = `\n\n--- ESTADO CLÍNICO ACTUAL DEL ASTRONAUTA ---\n${JSON.stringify(
    cleanTelemetry,
    null,
    2
  )}`;

  const clinicalRules = `\n\n--- REGLAS DE PROTOCOLO CLÍNICO ---
1. Respuestas ultracortas (Glanceable).
2. Priorizar contramedidas inmediatas si los datos clínicos muestran anomalías.
3. No inventar diagnósticos fuera de los datos provistos.
4. Si isEmergency es true, asume un colapso inminente.`;

  return `${basePrompt}${telemetryInjection}${clinicalRules}`;
}
