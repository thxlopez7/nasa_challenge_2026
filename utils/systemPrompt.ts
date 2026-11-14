import { Biomarkers, ClinicalAlerts, Environment } from '../types/telemetry';

export type TelemetryPayload = Partial<
  Biomarkers & Environment & ClinicalAlerts
> &
  Record<string, unknown>;

/**
 * Construye el System Instruction dinámico para el Cirujano de Vuelo Autónomo (Gemini 1.5 Flash),
 * inyectando la telemetría biométrica y ambiental actual del astronauta en tiempo real.
 */
export function generateClinicalPrompt(telemetry: TelemetryPayload): string {
  const basePrompt =
    'Eres ExoVitals, el sistema de soporte vital avanzado y Oficial Médico Autónomo de a bordo. Tu misión es hacer triaje y guiar al astronauta en emergencias porque la Tierra tiene un retraso de comunicación de 20 minutos. El usuario no es doctor, háblale de forma directa, empática y con instrucciones numeradas paso a paso.';

  const telemetryInjection = `\n\n--- ESTADO CLÍNICO ACTUAL DEL ASTRONAUTA ---\n${JSON.stringify(
    telemetry,
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
