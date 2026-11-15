import type { TelemetryData } from '../types/telemetry';
import type { SleepEpoch, SleepNight, SleepStage, SleepSummary } from '../types/sleep';

/**
 * Procesado del sensor de sueño ultrasónico.
 *
 * En el prototipo no hay hardware: `simulateSleepNight` genera la noche que
 * el sensor habría captado, determinista para cada fecha y modulada por la
 * telemetría (un bolsillo de CO2 o una tormenta solar empeoran el descanso).
 * `summarizeNight` es el mismo cálculo que se aplicaría a datos reales.
 */

export const EPOCH_MIN = 5;

/** Más lejos que esto del sensor = fuera del saco de dormir. */
export const OUT_OF_BED_CM = 120;

export const SLEEP_THRESHOLDS = {
  /** Horas de sueño mínimas */
  minHours: 6,
  /** Eficiencia mínima, % */
  minEfficiency: 85,
  /** Pausas respiratorias por hora a partir de las que se avisa (≈ IAH leve) */
  maxBreathingPauses: 5,
  /** Rango normal de respiración dormido, rpm */
  breathingRate: { min: 10, max: 20 },
  /** Rango cómodo de temperatura de la habitación, °C */
  roomTemp: { min: 18, max: 25 },
} as const;

export const STAGE_LABEL: Record<SleepStage, string> = {
  AWAKE: 'Despierto',
  REM: 'REM',
  LIGHT: 'Ligero',
  DEEP: 'Profundo',
};

/* ------------------------------------------------------------------ */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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

const round = (v: number, digits = 1) => Number(v.toFixed(digits));
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Fase de un ciclo de ~90 min: más profundo al principio, más REM al final. */
function stageInCycle(pos: number, cycle: number): SleepStage {
  const deepShare = Math.max(0.05, 0.4 - cycle * 0.09);
  const remShare = Math.min(0.4, 0.12 + cycle * 0.07);
  if (pos < 0.15) return 'LIGHT';
  if (pos < 0.15 + deepShare) return 'DEEP';
  if (pos < 1 - remShare) return 'LIGHT';
  return 'REM';
}

/* ------------------------------------------------------------------ */

export interface SleepInputs {
  co2Level: TelemetryData['co2Level'];
  radiationRate: TelemetryData['radiationRate'];
  cortisol: TelemetryData['cortisol'];
}

/** Genera la noche anterior a `date` tal como la registraría el sensor. */
export function simulateSleepNight(date: string, inputs: SleepInputs): SleepNight {
  const rand = mulberry32(hashString(`sleep:${date}`));
  const noise = (amp: number) => (rand() * 2 - 1) * amp;

  // Factores que empeoran el sueño.
  const co2 = inputs.co2Level > 3500;
  const storm = inputs.radiationRate > 50;
  const stress = inputs.cortisol > 18;
  const disruption = (co2 ? 0.35 : 0) + (storm ? 0.3 : 0) + (stress ? 0.15 : 0);

  const bedMin = 22 * 60 + 15 + Math.round(noise(25)); // ~22:15
  const inBedEpochs = Math.round((8.4 + noise(0.4) - (storm ? 0.8 : 0)) * (60 / EPOCH_MIN));
  const latencyEpochs = Math.max(1, Math.round(2 + rand() * 3 + disruption * 6));
  const baseTemp = 21.4 + noise(1.4) + (co2 ? 1.6 : 0);
  const baseDistance = 42 + noise(6);
  const pauseRate = clamp(1.5 + rand() * 2.5 + (co2 ? 4 : 0), 0, 15);

  const epochs: SleepEpoch[] = [];
  let awakeLeft = 0;
  let outLeft = 0;

  for (let i = 0; i < inBedEpochs; i++) {
    const minute = i * EPOCH_MIN;
    let stage: SleepStage;
    let out = false;

    if (i < latencyEpochs) {
      stage = 'AWAKE';
    } else if (i >= inBedEpochs - 1) {
      stage = 'AWAKE'; // despertar final
    } else {
      if (awakeLeft === 0 && outLeft === 0) {
        const p = 0.025 + disruption * 0.06;
        if (rand() < p) {
          if (rand() < 0.3) outLeft = 1 + Math.floor(rand() * 2);
          else awakeLeft = 1 + Math.floor(rand() * 2);
        }
      }
      if (outLeft > 0) {
        out = true;
        outLeft--;
        stage = 'AWAKE';
      } else if (awakeLeft > 0) {
        awakeLeft--;
        stage = 'AWAKE';
      } else {
        const sleptMin = minute - latencyEpochs * EPOCH_MIN;
        const cycleLen = 90 + noise(8);
        const cycle = Math.floor(sleptMin / cycleLen);
        stage = stageInCycle((sleptMin % cycleLen) / cycleLen, cycle);
        // Con mala noche, parte del profundo pasa a ligero.
        if (stage === 'DEEP' && rand() < disruption * 0.5) stage = 'LIGHT';
      }
    }

    const breathingBase = { AWAKE: 16.5, REM: 15.8, LIGHT: 14.2, DEEP: 12.8 }[stage];
    const movementBase = { AWAKE: 48, REM: 4, LIGHT: 14, DEEP: 6 }[stage];
    const progress = i / inBedEpochs;

    epochs.push({
      minute,
      stage,
      breathingRate: round(clamp(breathingBase + noise(stage === 'REM' ? 1.6 : 0.7) + (co2 ? 1.4 : 0), 8, 26)),
      movement: Math.round(clamp(movementBase + noise(movementBase * 0.6) + (out ? 40 : 0), 0, 100)),
      distanceCm: Math.round(out ? 160 + rand() * 90 : baseDistance + noise(stage === 'AWAKE' ? 10 : 3)),
      // Ligero enfriamiento de madrugada.
      roomTempC: round(baseTemp - Math.sin(progress * Math.PI) * 0.8 + noise(0.15)),
    });
  }

  return {
    summary: summarizeNight(epochs, bedMin, pauseRate),
    epochs,
  };
}

/** Resume las épocas de una noche en los indicadores del informe. */
export function summarizeNight(
  epochs: SleepEpoch[],
  bedMinuteOfDay: number,
  pausesPerHour: number
): SleepSummary {
  const asleep = epochs.filter((e) => e.stage !== 'AWAKE');
  const firstSleep = epochs.findIndex((e) => e.stage !== 'AWAKE');
  const lastSleep = epochs.findLastIndex((e) => e.stage !== 'AWAKE');

  let awakenings = 0;
  let outOfBed = 0;
  for (let i = Math.max(1, firstSleep); i <= lastSleep; i++) {
    const prev = epochs[i - 1];
    const cur = epochs[i];
    if (cur.stage === 'AWAKE' && prev.stage !== 'AWAKE') awakenings++;
    if (cur.distanceCm > OUT_OF_BED_CM && prev.distanceCm <= OUT_OF_BED_CM) outOfBed++;
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const inBed = epochs.filter((e) => e.distanceCm <= OUT_OF_BED_CM);
  const temps = epochs.map((e) => e.roomTempC);
  const hh = Math.floor(bedMinuteOfDay / 60) % 24;
  const mm = bedMinuteOfDay % 60;

  return {
    bedtime: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    inBedHours: round((epochs.length * EPOCH_MIN) / 60),
    totalHours: round((asleep.length * EPOCH_MIN) / 60),
    efficiency: Math.round(epochs.length ? (asleep.length / epochs.length) * 100 : 0),
    latencyMin: Math.max(0, firstSleep) * EPOCH_MIN,
    awakenings,
    breathingRate: round(mean(asleep.map((e) => e.breathingRate))),
    breathingPauses: round(pausesPerHour),
    movementIndex: Math.round(mean(epochs.map((e) => e.movement))),
    outOfBed,
    distanceCm: Math.round(mean(inBed.map((e) => e.distanceCm))),
    roomTempC: round(mean(temps)),
    roomTempMinC: round(Math.min(...temps)),
    roomTempMaxC: round(Math.max(...temps)),
    deepPct: Math.round(asleep.length ? (asleep.filter((e) => e.stage === 'DEEP').length / asleep.length) * 100 : 0),
    remPct: Math.round(asleep.length ? (asleep.filter((e) => e.stage === 'REM').length / asleep.length) * 100 : 0),
  };
}

/** "22:15" + minutos → "HH:MM" */
export function clockAt(bedtime: string, minutes: number): string {
  const [h, m] = bedtime.split(':').map(Number);
  const t = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
