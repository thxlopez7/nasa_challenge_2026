import type { AlertSeverity, TelemetryData } from './telemetry';
import type { SleepSummary } from './sleep';

/**
 * Contrato del Centro de Misión: arco de misión, evaluación diaria,
 * calendario y progresión. Independiente del contrato de telemetría: sólo
 * guarda instantáneas de `TelemetryData` para seguir la evolución del cuerpo.
 */

/** Fecha local en formato YYYY-MM-DD */
export type DayKey = string;

export type MissionProfileId = 'ISS_6M' | 'MARS_CONJUNCTION';
export type MissionPhaseId = 'LEO' | 'TRANSIT_OUT' | 'SURFACE' | 'TRANSIT_BACK';

export interface MissionPhase {
  id: MissionPhaseId;
  name: string;
  days: number;
  description: string;
}

export interface MissionProfile {
  id: MissionProfileId;
  name: string;
  summary: string;
  phases: readonly MissionPhase[];
}

/** Pasos de la evaluación diaria, en orden. */
export type EvaluationStepId =
  | 'CHECK_IN'
  | 'VITALS'
  | 'RESISTIVE'
  | 'AEROBIC'
  | 'HYDRATION'
  | 'MIND'
  | 'DEBRIEF';

/** Autoevaluación del tripulante (escala 1–5) */
export interface SelfReport {
  /** Horas de sueño de la última noche (medidas por el sensor ultrasónico) */
  sleepHours: number;
  /** Informe nocturno del sensor ultrasónico del módulo de descanso */
  sleep?: SleepSummary;
  /** 1 = muy bajo · 5 = muy bueno */
  mood: number;
  /** 1 = descansado · 5 = agotado */
  fatigue: number;
}

export type PauseReason = 'USER' | 'CLINICAL_ALERT' | 'CODE_RED';

/**
 * Estado del día en el calendario:
 *   COMPLETE — evaluación cerrada con todas las contramedidas.
 *   PARTIAL  — evaluación cerrada con pasos omitidos o sin terminar.
 *   EXCUSED  — día cerrado por motivo médico: no penaliza la adherencia.
 */
export type DayStatus = 'COMPLETE' | 'PARTIAL' | 'EXCUSED';

export interface DayRecord {
  date: DayKey;
  missionDay: number;
  phaseId: MissionPhaseId;
  status: DayStatus;
  completedSteps: EvaluationStepId[];
  skippedSteps: EvaluationStepId[];
  selfReport?: SelfReport;
  vitals?: TelemetryData;
  xp: number;
  pauses: number;
  /** Registro generado por el historial de demostración */
  simulated?: boolean;
}

export interface EvaluationSession {
  date: DayKey;
  stepIndex: number;
  status: 'ACTIVE' | 'PAUSED';
  completedSteps: EvaluationStepId[];
  skippedSteps: EvaluationStepId[];
  pauseReason?: PauseReason;
  pausedAt?: string;
  pauses: number;
  selfReport?: SelfReport;
  vitals?: TelemetryData;
  hydrationCount: number;
  xp: number;
}

export interface Mission {
  profileId: MissionProfileId;
  startDate: DayKey;
  /** Fecha en que se cerró la misión (al completar el último día o al abortarla) */
  endedOn?: DayKey;
  aborted?: boolean;
  simulatedHistory?: boolean;
}

export interface Finding {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  action: string;
}

export interface Diagnosis {
  severity: AlertSeverity;
  findings: Finding[];
}

export type AchievementId =
  | 'FIRST_EVAL'
  | 'FIRST_WEEK'
  | 'SELF_CARE'
  | 'DAY_30'
  | 'DAY_100'
  | 'PHASE_SURFACE'
  | 'PHASE_RETURN'
  | 'HALFWAY'
  | 'MISSION_COMPLETE';

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface Rank {
  level: number;
  title: string;
  minXp: number;
}
