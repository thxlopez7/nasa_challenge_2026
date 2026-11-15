/**
 * Única fuente de verdad para la configuración del modelo de IA (P1).
 * Modelo verificado contra la API Live de Gemini en `.env.local` (gemini-3-flash-preview).
 */

export const AI_MODEL_ID = 'gemini-3-flash-preview' as const;
export const AI_MODEL_LABEL = 'Gemini 3 Flash' as const;
export const AI_TEMPERATURE = 0.2;
export const AI_TIMEOUT_MS = 15_000;
export const AI_MAX_QUERY_LENGTH = 6000;

export interface AiRuntimeConfig {
  modelId: string;
  modelLabel: string;
  temperature: number;
  timeoutMs: number;
  maxQueryLength: number;
}

export const AI_RUNTIME_CONFIG: AiRuntimeConfig = {
  modelId: AI_MODEL_ID,
  modelLabel: AI_MODEL_LABEL,
  temperature: AI_TEMPERATURE,
  timeoutMs: AI_TIMEOUT_MS,
  maxQueryLength: AI_MAX_QUERY_LENGTH,
};
