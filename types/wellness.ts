/**
 * Contrato del módulo de bienestar (gamificación de contramedidas).
 * Es independiente del contrato de telemetría: no añade ni modifica campos de
 * `TelemetryState`; sólo lee sus alertas para priorizar misiones.
 */

export type MissionId = 'ared' | 'hydration' | 'citrate' | 'coherence';

export type MissionCategory = 'PHYSICAL' | 'MENTAL';

export interface MissionDefinition {
  id: MissionId;
  title: string;
  description: string;
  category: MissionCategory;
  /** Pasos necesarios para completar la misión del día */
  steps: number;
  /** Texto de la unidad de cada paso (p. ej. "bloque", "toma") */
  stepLabel: string;
  /** Plural de la unidad (p. ej. "bloques", "sesiones") */
  stepLabelPlural: string;
  /** XP por paso registrado */
  xpPerStep: number;
}

/** Eventos que la UI convierte en notificaciones */
export type WellnessEvent =
  | { type: 'XP'; amount: number; missionId: MissionId }
  | { type: 'MISSION_COMPLETE'; missionId: MissionId; bonus: number }
  | { type: 'LEVEL_UP'; level: number }
  | { type: 'STREAK'; streak: number };

export interface WellnessData {
  xp: number;
  streak: number;
  bestStreak: number;
  /** Día local (YYYY-MM-DD) del progreso actual */
  day: string;
  /** Último día con todas las misiones completas */
  lastCompletedDay: string | null;
  progress: Record<MissionId, number>;
}

export interface WellnessState extends WellnessData {
  /** Cambia de día: reinicia el progreso y corta la racha si se saltó un día */
  syncDay: (today: string) => void;
  /** Registra un paso de una misión y devuelve los eventos generados */
  logStep: (missionId: MissionId) => WellnessEvent[];
}
