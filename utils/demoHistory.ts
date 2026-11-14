import type { TelemetryData } from '../types/telemetry';
import type {
  DayKey,
  DayRecord,
  EvaluationStepId,
  Mission,
  SelfReport,
} from '../types/mission';
import { evaluateTelemetry } from './clinicalEngine';
import {
  EVALUATION_STEPS,
  FULL_DAY_BONUS,
  addDays,
  getProfile,
  phaseOfDay,
} from './missionPlan';

/**
 * Historial SIMULADO para demostraciones: permite enseñar el calendario y las
 * tendencias sin esperar meses. Es determinista (misma semilla → mismos datos)
 * y cada registro queda marcado con `simulated: true`.
 *
 * Guion de la demo (misión a Marte, ~150 días):
 *   · Deriva renal lenta: cistatina C y calcio suben con la estancia en 0 g.
 *   · Días 61–65: evento de partículas solares → R2 y días excusados.
 *   · Día 98: bolsillo de CO2 → pausa, diagnóstico y evaluación retomada.
 *   · Días 85–110: bajón de ánimo típico del "tercer cuarto" del aislamiento.
 *   · Un día de descanso por semana, algún día parcial y días perdidos
 *     durante las dos primeras semanas de adaptación.
 */

export const DEMO_DAYS = 150;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v: number, digits = 2) => Number(v.toFixed(digits));
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const ALL_STEPS = EVALUATION_STEPS.map((s) => s.id);
const xpOf = (steps: EvaluationStepId[]) =>
  EVALUATION_STEPS.filter((s) => steps.includes(s.id)).reduce(
    (sum, s) => sum + s.xp,
    0
  );

export function generateDemoHistory(today: DayKey): {
  mission: Mission;
  records: Record<DayKey, DayRecord>;
} {
  const rand = mulberry32(2026);
  const noise = (amp: number) => (rand() * 2 - 1) * amp;

  const mission: Mission = {
    profileId: 'MARS_CONJUNCTION',
    startDate: addDays(today, -(DEMO_DAYS - 1)),
    simulatedHistory: true,
  };
  const profile = getProfile(mission.profileId);
  const records: Record<DayKey, DayRecord> = {};
  let accumulated = 0;

  // El día de hoy (DEMO_DAYS) queda libre para la evaluación en vivo.
  for (let day = 1; day < DEMO_DAYS; day++) {
    const date = addDays(mission.startDate, day - 1);
    const solarStorm = day >= 61 && day <= 65;
    const recovery = day > 65 && day <= 78 ? (78 - day) / 13 : 0;
    const co2Pocket = day === 98;
    const lowMoodPhase = day >= 85 && day <= 110;

    const radiationRate = solarStorm
      ? round(120 + noise(40), 1)
      : round(25 + noise(6), 1);
    accumulated += (radiationRate * 24) / 1000;

    const linfocitos = Math.round(
      solarStorm ? 780 + noise(120) : 1500 - recovery * 500 + noise(120)
    );
    const neutrofilos = Math.round(
      solarStorm ? 4400 + noise(300) : 3000 + recovery * 800 + noise(250)
    );

    const bio = {
      heartRate: Math.round(70 + noise(6) + (solarStorm ? 8 : 0)),
      spO2: Math.round(clamp(98 + noise(1.2), 96, 100)),
      cistatinaC: round(0.8 + day * 0.0026 + noise(0.03)),
      creatinina: round(1.0 + noise(0.06)),
      calcioIonico: round(1.1 + day * 0.001 + noise(0.02)),
      linfocitos,
      neutrofilos,
      cortisol: round(10 + noise(2) + (solarStorm || lowMoodPhase ? 4 : 0), 1),
    };
    const env = {
      co2Level: Math.round(co2Pocket ? 4150 : 650 + noise(150)),
      radiationRate,
      radiationAccumulated: round(45 + accumulated, 1),
    };
    const vitals: TelemetryData = {
      ...bio,
      ...env,
      isEmergency: false,
      ...evaluateTelemetry(bio, env),
    };

    const selfReport: SelfReport = {
      sleepHours: round(clamp(7 + noise(0.8) - (solarStorm ? 1.2 : 0), 4.5, 9), 1),
      mood: Math.round(clamp(4 + noise(0.8) - (lowMoodPhase ? 1.6 : 0), 1, 5)),
      fatigue: Math.round(clamp(2.4 + noise(0.8) + (solarStorm ? 1.5 : 0), 1, 5)),
    };

    // Los días con evento del guion siempre se registran.
    const scripted = solarStorm || co2Pocket;
    const isRestDay = day % 7 === 0 && !scripted;
    // Algún día perdido durante las dos semanas de adaptación inicial.
    const missed = !isRestDay && !scripted && day <= 14 && rand() < 0.15;
    if (isRestDay || missed) continue;

    const { phase } = phaseOfDay(profile, day);
    let record: DayRecord;

    if (solarStorm) {
      const done: EvaluationStepId[] = ['CHECK_IN', 'VITALS', 'HYDRATION'];
      record = {
        date,
        missionDay: day,
        phaseId: phase.id,
        status: 'EXCUSED',
        completedSteps: done,
        skippedSteps: [],
        selfReport,
        vitals,
        xp: xpOf(done),
        pauses: 1,
        simulated: true,
      };
    } else {
      const partial = rand() < 0.1;
      const skipped: EvaluationStepId[] = partial
        ? [rand() < 0.5 ? 'AEROBIC' : 'MIND']
        : [];
      const done = ALL_STEPS.filter((s) => !skipped.includes(s));
      record = {
        date,
        missionDay: day,
        phaseId: phase.id,
        status: partial ? 'PARTIAL' : 'COMPLETE',
        completedSteps: done,
        skippedSteps: skipped,
        selfReport,
        vitals,
        xp: xpOf(done) + (partial ? 0 : FULL_DAY_BONUS),
        pauses: co2Pocket ? 1 : 0,
        simulated: true,
      };
    }

    records[date] = record;
  }

  return { mission, records };
}
