import type { TelemetryData } from '../types/telemetry';
import type {
  Achievement,
  DayKey,
  DayRecord,
  Diagnosis,
  EvaluationStepId,
  Finding,
  Mission,
  MissionPhase,
  MissionProfile,
  MissionProfileId,
  Rank,
  SelfReport,
} from '../types/mission';
import { RIDGE_THRESHOLDS as T, computeNlr } from './clinicalEngine';
import { SLEEP_THRESHOLDS } from './sleepSensing';

/* ------------------------------------------------------------------ */
/* Perfiles de misión                                                  */
/* Duraciones de referencia: expediciones ISS de ~6 meses y la         */
/* arquitectura de clase conjunción de NASA (DRA 5.0): ~180–210 días   */
/* de ida, ~500 días en superficie y ~180–210 días de vuelta.          */
/* ------------------------------------------------------------------ */

export const MISSION_PROFILES: Record<MissionProfileId, MissionProfile> = {
  ISS_6M: {
    id: 'ISS_6M',
    name: 'Expedición ISS · 6 meses',
    summary: 'Órbita baja terrestre. Ideal para validar hábitos y contramedidas.',
    phases: [
      {
        id: 'LEO',
        name: 'Órbita baja',
        days: 180,
        description: 'Microgravedad continua con soporte desde la Tierra.',
      },
    ],
  },
  MARS_CONJUNCTION: {
    id: 'MARS_CONJUNCTION',
    name: 'Marte · clase conjunción',
    summary: 'Ida, estancia larga en superficie y regreso: ~2,5 años.',
    phases: [
      {
        id: 'TRANSIT_OUT',
        name: 'Tránsito a Marte',
        days: 200,
        description: 'Microgravedad y radiación de espacio profundo, sin escudo magnético terrestre.',
      },
      {
        id: 'SURFACE',
        name: 'Superficie marciana',
        days: 500,
        description: 'Gravedad de 0,38 g, polvo y comunicaciones con hasta ~20 min de retraso.',
      },
      {
        id: 'TRANSIT_BACK',
        name: 'Regreso a la Tierra',
        days: 200,
        description: 'Fase final de microgravedad antes de la readaptación a 1 g.',
      },
    ],
  },
};

export const getProfile = (id: MissionProfileId): MissionProfile =>
  MISSION_PROFILES[id];

export const totalDays = (profile: MissionProfile): number =>
  profile.phases.reduce((sum, p) => sum + p.days, 0);

/* ------------------------------------------------------------------ */
/* Fechas (claves locales YYYY-MM-DD, aritmética en UTC sin horario    */
/* de verano)                                                          */
/* ------------------------------------------------------------------ */

export function toDayKey(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const keyToUtc = (key: DayKey): number => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export function addDays(key: DayKey, days: number): DayKey {
  const date = new Date(keyToUtc(key) + days * 86_400_000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const diffDays = (from: DayKey, to: DayKey): number =>
  Math.round((keyToUtc(to) - keyToUtc(from)) / 86_400_000);

/** Día de la semana 0 = lunes … 6 = domingo */
export const weekdayOf = (key: DayKey): number =>
  (new Date(keyToUtc(key)).getUTCDay() + 6) % 7;

const DATE_FMT = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
export const formatDay = (key: DayKey): string =>
  DATE_FMT.format(new Date(keyToUtc(key)));

export const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

/* ------------------------------------------------------------------ */
/* Arco de misión                                                      */
/* ------------------------------------------------------------------ */

/** Día de misión (1 = día de inicio). Puede ser ≤ 0 o > total. */
export const missionDayOf = (mission: Mission, date: DayKey): number =>
  diffDays(mission.startDate, date) + 1;

export const dateOfMissionDay = (mission: Mission, day: number): DayKey =>
  addDays(mission.startDate, day - 1);

export function phaseOfDay(
  profile: MissionProfile,
  missionDay: number
): { phase: MissionPhase; index: number; dayInPhase: number } {
  let start = 1;
  for (let i = 0; i < profile.phases.length; i++) {
    const phase = profile.phases[i];
    if (missionDay < start + phase.days) {
      return { phase, index: i, dayInPhase: Math.max(1, missionDay - start + 1) };
    }
    start += phase.days;
  }
  const last = profile.phases.length - 1;
  return {
    phase: profile.phases[last],
    index: last,
    dayInPhase: profile.phases[last].days,
  };
}

export const missionWeekOf = (missionDay: number): number =>
  Math.floor((missionDay - 1) / 7) + 1;

/* ------------------------------------------------------------------ */
/* Evaluación diaria                                                   */
/* El volumen de ejercicio de referencia en la ISS es ~1,5 h/día de    */
/* resistivo y ~1 h/día de aeróbico, 6 días por semana. Por eso la     */
/* meta semanal es 6 de 7 días: un día de descanso nunca rompe nada.   */
/* ------------------------------------------------------------------ */

export interface StepDefinition {
  id: EvaluationStepId;
  title: string;
  short: string;
  description: string;
  xp: number;
  skippable: boolean;
}

export const EVALUATION_STEPS: readonly StepDefinition[] = [
  {
    id: 'CHECK_IN',
    title: 'Check-in del tripulante',
    short: 'Check-in',
    description: 'El sensor ultrasónico ya analizó tu noche: sincroniza su informe y cuenta cómo te sientes. Tarda 20 segundos.',
    xp: 10,
    skippable: false,
  },
  {
    id: 'VITALS',
    title: 'Lectura de biomarcadores',
    short: 'Biomarcadores',
    description: 'Se guarda una instantánea de tu telemetría y pasa por el motor RIDGE.',
    xp: 10,
    skippable: false,
  },
  {
    id: 'RESISTIVE',
    title: 'Ejercicio resistivo (ARED)',
    short: 'Resistivo',
    description: 'Sesión de carga según tu plan de entrenamiento. Frena la pérdida ósea y muscular.',
    xp: 40,
    skippable: true,
  },
  {
    id: 'AEROBIC',
    title: 'Ejercicio aeróbico',
    short: 'Aeróbico',
    description: 'Cinta o cicloergómetro según tu plan. Mantiene la capacidad cardiovascular.',
    xp: 30,
    skippable: true,
  },
  {
    id: 'HYDRATION',
    title: 'Hidratación y citrato',
    short: 'Hidratación',
    description: 'Registra tus tomas de líquido y el citrato si el cirujano de vuelo lo prescribió.',
    xp: 20,
    skippable: true,
  },
  {
    id: 'MIND',
    title: 'Pausa de coherencia cardíaca',
    short: 'Mente',
    description: 'Respiración guiada de 1 minuto a 6 ciclos por minuto (5 s · 5 s).',
    xp: 25,
    skippable: true,
  },
  {
    id: 'DEBRIEF',
    title: 'Cierre y diagnóstico del día',
    short: 'Cierre',
    description: 'Resumen de hallazgos y recompensa del día.',
    xp: 0,
    skippable: false,
  },
];

export const HYDRATION_TARGET = 4;
export const FULL_DAY_BONUS = 25;
export const WEEKLY_TARGET_DAYS = 6;

export const stepIndexOf = (id: EvaluationStepId): number =>
  EVALUATION_STEPS.findIndex((s) => s.id === id);

/** XP máximo de un día perfecto */
export const MAX_DAILY_XP =
  EVALUATION_STEPS.reduce((sum, s) => sum + s.xp, 0) + FULL_DAY_BONUS;

/* ------------------------------------------------------------------ */
/* Rangos: umbrales calibrados con el XP real de un día perfecto       */
/* (~160 XP). Rango 2 ≈ 3 días, 4 ≈ 1 mes, 6 ≈ 4 meses, 8 ≈ 15 meses.   */
/* ------------------------------------------------------------------ */

export const RANKS: readonly Rank[] = [
  { level: 1, title: 'Cadete', minXp: 0 },
  { level: 2, title: 'Tripulante', minXp: 500 },
  { level: 3, title: 'Especialista de misión', minXp: 1_500 },
  { level: 4, title: 'Ingeniero de vuelo', minXp: 4_000 },
  { level: 5, title: 'Oficial médico de a bordo', minXp: 9_000 },
  { level: 6, title: 'Comandante de misión', minXp: 18_000 },
  { level: 7, title: 'Veterano interplanetario', minXp: 36_000 },
  { level: 8, title: 'Leyenda de Marte', minXp: 72_000 },
];

export function rankFor(xp: number): {
  rank: Rank;
  next: Rank | null;
  progress: number;
} {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].minXp) index = i;
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const progress = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1;
  return { rank, next, progress };
}

/* ------------------------------------------------------------------ */
/* Adherencia semanal                                                  */
/* ------------------------------------------------------------------ */

/**
 * Cualquier día con evaluación cerrada cuenta para la meta semanal: presentarse
 * es lo que se refuerza. Completarlo todo ya se premia con el bono diario.
 */
const countsForAdherence = (r: DayRecord) =>
  r.status === 'COMPLETE' || r.status === 'PARTIAL' || r.status === 'EXCUSED';

export function weekProgress(
  records: Record<DayKey, DayRecord>,
  week: number
): number {
  return Object.values(records).filter(
    (r) => missionWeekOf(r.missionDay) === week && countsForAdherence(r)
  ).length;
}

/**
 * Semanas consecutivas que cumplieron la meta (6/7), contando hacia atrás
 * desde la semana actual. La semana en curso suma sólo si ya cumplió, y
 * nunca rompe la racha mientras sigue abierta.
 */
export function weeklyStreak(
  records: Record<DayKey, DayRecord>,
  currentWeek: number
): number {
  let streak = weekProgress(records, currentWeek) >= WEEKLY_TARGET_DAYS ? 1 : 0;
  for (let w = currentWeek - 1; w >= 1; w--) {
    if (weekProgress(records, w) >= WEEKLY_TARGET_DAYS) streak++;
    else break;
  }
  return streak;
}

/* ------------------------------------------------------------------ */
/* Logros (derivados de los registros: nunca se pueden desincronizar) */
/* ------------------------------------------------------------------ */

export function computeAchievements(
  mission: Mission,
  records: Record<DayKey, DayRecord>
): Achievement[] {
  const profile = getProfile(mission.profileId);
  const total = totalDays(profile);
  const list = Object.values(records);
  const maxDay = list.reduce((m, r) => Math.max(m, r.missionDay), 0);
  const hasPhase = (id: string) => list.some((r) => r.phaseId === id);
  const isMars = profile.id === 'MARS_CONJUNCTION';

  let firstWeek = false;
  for (let w = 1; w <= missionWeekOf(Math.max(1, maxDay)); w++) {
    if (weekProgress(records, w) >= WEEKLY_TARGET_DAYS) {
      firstWeek = true;
      break;
    }
  }

  const items: Achievement[] = [
    {
      id: 'FIRST_EVAL',
      title: 'Primer contacto',
      description: 'Cierra tu primera evaluación diaria.',
      unlocked: list.length > 0,
    },
    {
      id: 'FIRST_WEEK',
      title: 'Semana sólida',
      description: `Cumple la meta de ${WEEKLY_TARGET_DAYS} de 7 días en una semana.`,
      unlocked: firstWeek,
    },
    {
      id: 'SELF_CARE',
      title: 'Autocuidado',
      description: 'Pausa una evaluación para atender un diagnóstico y retómala.',
      unlocked: list.some((r) => r.pauses > 0 && r.status !== 'EXCUSED'),
    },
    {
      id: 'DAY_30',
      title: '30 días en el espacio',
      description: 'Registra el día 30 de misión.',
      unlocked: maxDay >= 30,
    },
    {
      id: 'DAY_100',
      title: 'Centenario',
      description: 'Registra el día 100 de misión.',
      unlocked: maxDay >= 100,
    },
    {
      id: 'HALFWAY',
      title: 'Ecuador de la misión',
      description: 'Supera la mitad de la duración total.',
      unlocked: maxDay >= Math.ceil(total / 2),
    },
  ];

  if (isMars) {
    items.push(
      {
        id: 'PHASE_SURFACE',
        title: 'Pisada marciana',
        description: 'Registra tu primer día en la superficie de Marte.',
        unlocked: hasPhase('SURFACE'),
      },
      {
        id: 'PHASE_RETURN',
        title: 'Rumbo a casa',
        description: 'Registra tu primer día del regreso a la Tierra.',
        unlocked: hasPhase('TRANSIT_BACK'),
      }
    );
  }

  items.push({
    id: 'MISSION_COMPLETE',
    title: 'Misión cumplida',
    description: 'Llega al último día de la misión.',
    unlocked: !!mission.endedOn && !mission.aborted,
  });

  return items;
}

/* ------------------------------------------------------------------ */
/* Diagnóstico determinista                                            */
/* Solo describe lo que miden el motor RIDGE y la autoevaluación, y    */
/* deriva al cirujano de vuelo. No emite diagnósticos médicos.         */
/* ------------------------------------------------------------------ */

export function buildDiagnosis(
  vitals: TelemetryData,
  selfReport?: SelfReport
): Diagnosis {
  const findings: Finding[] = [];

  if (vitals.isEmergency) {
    findings.push({
      id: 'CODE_RED',
      severity: 'CRITICAL',
      title: 'Code Red activo',
      detail: 'Se activó el protocolo de emergencia médica.',
      action:
        'Detén la evaluación, sigue el protocolo de emergencia y contacta al cirujano de vuelo.',
    });
  }

  if (vitals.isRenalWarning) {
    findings.push({
      id: 'R1',
      severity: 'WARNING',
      title: 'R1 · Patrón de nefropatía oculta',
      detail: `Cistatina C ${vitals.cistatinaC.toFixed(2)} mg/L (> ${T.renal.minCistatinaC}), Ca²⁺ ${vitals.calcioIonico.toFixed(2)} mmol/L (> ${T.renal.minCalcioIonico}) con creatinina ${vitals.creatinina.toFixed(2)} mg/dL.`,
      action:
        'Prioriza la hidratación y el citrato prescrito, y repórtalo al cirujano de vuelo.',
    });
  }

  if (vitals.isRadiationWarning) {
    const nlr = computeNlr(vitals);
    findings.push({
      id: 'R2',
      severity: 'WARNING',
      title: 'R2 · Posible inmunosupresión por radiación',
      detail: `Radiación ${vitals.radiationRate} µSv/h, linfocitos ${vitals.linfocitos} cél/µL, NLR ${Number.isFinite(nlr) ? nlr.toFixed(2) : '∞'}.`,
      action:
        'Sigue el protocolo de refugio ante eventos solares y repórtalo al cirujano de vuelo.',
    });
  }

  if (vitals.isCo2Warning) {
    findings.push({
      id: 'R3',
      severity: 'WARNING',
      title: 'R3 · Bolsillo de CO2',
      detail: `CO2 ${vitals.co2Level} ppm (> ${T.co2.minCo2Level}) con SpO2 ${vitals.spO2}% conservada.`,
      action:
        'Desplázate a una zona ventilada y avisa al equipo de soporte vital (ECLSS).',
    });
  }

  if (selfReport) {
    if (selfReport.sleepHours < 6) {
      findings.push({
        id: 'SLEEP',
        severity: 'WARNING',
        title: 'Sueño corto',
        detail: `${selfReport.sleepHours} h de sueño ${selfReport.sleep ? 'medidas por el sensor' : 'registradas'}.`,
        action:
          'Tenlo en cuenta al dosificar el esfuerzo de hoy. Si se repite varios días, coméntalo con el cirujano de vuelo.',
      });
    }
    const night = selfReport.sleep;
    if (night) {
      if (night.breathingPauses >= SLEEP_THRESHOLDS.maxBreathingPauses) {
        findings.push({
          id: 'SLEEP_BREATHING',
          severity: 'WARNING',
          title: 'Pausas respiratorias durante el sueño',
          detail: `${night.breathingPauses} pausas por hora detectadas por el sensor ultrasónico.`,
          action:
            'Revisa la ventilación del módulo de descanso (el CO2 se acumula junto a la cabeza en 0 g) y coméntalo con el cirujano de vuelo si se repite.',
        });
      }
      const { min, max } = SLEEP_THRESHOLDS.roomTemp;
      if (night.roomTempC < min || night.roomTempC > max) {
        findings.push({
          id: 'SLEEP_TEMP',
          severity: 'WARNING',
          title: 'Temperatura del módulo de descanso fuera de rango',
          detail: `${night.roomTempC} °C de media durante la noche (cómodo: ${min}–${max} °C).`,
          action: 'Ajusta el termostato o el flujo de aire del módulo antes de la próxima noche.',
        });
      }
      if (night.efficiency < SLEEP_THRESHOLDS.minEfficiency && selfReport.sleepHours >= SLEEP_THRESHOLDS.minHours) {
        findings.push({
          id: 'SLEEP_EFFICIENCY',
          severity: 'WARNING',
          title: 'Sueño fragmentado',
          detail: `Eficiencia ${night.efficiency}% con ${night.awakenings} despertares.`,
          action: 'Reduce luz y ruido en el módulo y evita pantallas la hora previa a dormir.',
        });
      }
    }
    if (selfReport.fatigue >= 4) {
      findings.push({
        id: 'FATIGUE',
        severity: 'WARNING',
        title: 'Fatiga elevada',
        detail: `Fatiga ${selfReport.fatigue}/5.`,
        action:
          'Puedes pausar o adaptar el ejercicio de hoy. Si persiste, repórtalo.',
      });
    }
    if (selfReport.mood <= 2) {
      findings.push({
        id: 'MOOD',
        severity: 'WARNING',
        title: 'Ánimo bajo',
        detail: `Ánimo ${selfReport.mood}/5.`,
        action:
          'Haz la pausa de coherencia y busca contacto con la tripulación o tu red de apoyo. Si persiste, habla con el equipo de salud conductual.',
      });
    }
  }

  const severity = findings.some((f) => f.severity === 'CRITICAL')
    ? 'CRITICAL'
    : findings.length > 0
      ? 'WARNING'
      : 'OPTIMAL';

  return { severity, findings };
}

/** ¿Hay alguna bandera clínica RIDGE activa (sin contar la autoevaluación)? */
export const hasClinicalAlert = (v: TelemetryData): boolean =>
  v.isRenalWarning || v.isRadiationWarning || v.isCo2Warning;
