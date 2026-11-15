import type { Biomarkers, Environment, TelemetryData } from '../types/telemetry';
import type { CrewScenario } from '../types/profile';

/**
 * Guiones de telemetría de los dos escenarios de la presentación.
 * Cada fotograma es una lectura de 1 Hz que entra por el SensorSimulator.
 */

export type ScenarioFrame = Partial<Biomarkers & Environment>;
/** Parámetros que guionizan los escenarios (el resto de sensores sigue su curso). */
type ScriptKey =
  | 'heartRate' | 'spO2' | 'cistatinaC' | 'creatinina' | 'calcioIonico' | 'linfocitos'
  | 'neutrofilos' | 'cortisol' | 'co2Level' | 'radiationRate' | 'radiationAccumulated';
type Full = Record<ScriptKey, number>;

const NOMINAL: Full = {
  heartRate: 72,
  spO2: 98,
  cistatinaC: 0.82,
  creatinina: 1.0,
  calcioIonico: 1.12,
  linfocitos: 1500,
  neutrofilos: 3000,
  cortisol: 11,
  co2Level: 650,
  radiationRate: 0.4,
  radiationAccumulated: 45,
};

/** Puntos clave (segundo → valores objetivo); entre ellos se interpola. */
const CRITICAL_KEYS: [number, Partial<Full>][] = [
  [20, { heartRate: 90 }],
  // Evento de partículas solares: sube la radiación, caen los linfocitos.
  [35, { radiationRate: 140, radiationAccumulated: 52, linfocitos: 950, neutrofilos: 4600, cortisol: 22, heartRate: 94 }],
  [50, { radiationRate: 150, radiationAccumulated: 58, linfocitos: 760, neutrofilos: 5300, cortisol: 26, heartRate: 98, co2Level: 1400 }],
  // Fallo del depurador de CO2: hipercapnia con SpO2 todavía conservada.
  [65, { radiationRate: 150, radiationAccumulated: 62, linfocitos: 720, neutrofilos: 5400, co2Level: 4400, spO2: 96, heartRate: 108, cortisol: 29 }],
  // Afectación renal y primeros signos de descompensación.
  [80, { radiationRate: 145, radiationAccumulated: 66, linfocitos: 690, neutrofilos: 5500, co2Level: 5200, spO2: 93, heartRate: 124, cistatinaC: 1.38, calcioIonico: 1.32, creatinina: 1.05, cortisol: 33 }],
  [95, { radiationRate: 140, radiationAccumulated: 70, linfocitos: 650, neutrofilos: 5600, co2Level: 6100, spO2: 86, heartRate: 142, cistatinaC: 1.45, calcioIonico: 1.34, creatinina: 1.08, cortisol: 38 }],
  [110, { radiationRate: 135, radiationAccumulated: 73, linfocitos: 620, neutrofilos: 5700, co2Level: 6400, spO2: 82, heartRate: 150, cistatinaC: 1.5, calcioIonico: 1.36, creatinina: 1.09, cortisol: 41 }],
];

/** En qué dirección empeora cada parámetro. */
const WORSE_UP: Record<keyof Full, boolean> = {
  heartRate: true, spO2: false, cistatinaC: true, creatinina: true, calcioIonico: true,
  linfocitos: false, neutrofilos: true, cortisol: true, co2Level: true, radiationRate: true,
  radiationAccumulated: true,
};

const DIGITS: Record<keyof Full, number> = {
  heartRate: 0, spO2: 0, cistatinaC: 2, creatinina: 2, calcioIonico: 2, linfocitos: 0,
  neutrofilos: 0, cortisol: 1, co2Level: 0, radiationRate: 1, radiationAccumulated: 1,
};

/** Ruido pequeño y determinista para que las curvas no sean rectas. */
const wobble = (t: number, k: number) => Math.sin(t * 1.7 + k * 3.1) * 0.5 + Math.sin(t * 0.43 + k) * 0.5;

const KEYS = Object.keys(NOMINAL) as ScriptKey[];

/**
 * Guion crítico: parte de las lecturas del último día registrado (para que
 * hoy continúe la tendencia) y empeora hasta la crisis. Ningún parámetro
 * "mejora" por el camino: cada objetivo se toma solo si es peor que el actual.
 */
function criticalFrames(base: Full): ScenarioFrame[] {
  const filled: [number, Full][] = [[0, base]];
  let acc = { ...base };
  for (const [t, target] of CRITICAL_KEYS) {
    const next = { ...acc };
    for (const k of KEYS) {
      const v = target[k];
      if (v === undefined) continue;
      next[k] = WORSE_UP[k] ? Math.max(acc[k], v) : Math.min(acc[k], v);
    }
    acc = next;
    filled.push([t, acc]);
  }
  const last = filled[filled.length - 1][0];
  const frames: ScenarioFrame[] = [];
  for (let t = 0; t <= last; t++) {
    const i = filled.findIndex(([kt]) => kt >= t);
    const [t1, b] = filled[i];
    const [t0, a] = i > 0 ? filled[i - 1] : filled[i];
    const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
    const f = {} as Full;
    KEYS.forEach((key, n) => {
      const value = a[key] + (b[key] - a[key]) * k;
      const jitter = key === 'heartRate' ? wobble(t, n) * 2 : key === 'co2Level' ? wobble(t, n) * 40 : 0;
      f[key] = Number((value + jitter).toFixed(DIGITS[key]));
    });
    frames.push(f);
  }
  return frames;
}

const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Escenario estable: oscila alrededor de un punto sano (en bucle). */
function stableFrames(base: Full): ScenarioFrame[] {
  const c = {
    heartRate: clampTo(base.heartRate, 62, 78),
    spO2: clampTo(base.spO2, 97, 99),
    cistatinaC: clampTo(base.cistatinaC, 0.78, 0.92),
    calcioIonico: clampTo(base.calcioIonico, 1.08, 1.16),
    linfocitos: clampTo(base.linfocitos, 1350, 1700),
    neutrofilos: clampTo(base.neutrofilos, 2700, 3300),
    cortisol: clampTo(base.cortisol, 9, 13),
    co2Level: clampTo(base.co2Level, 600, 850),
  };
  return Array.from({ length: 120 }, (_, t) => ({
    heartRate: Math.round(c.heartRate + Math.sin(t / 9) * 4 + wobble(t, 1) * 2),
    spO2: Math.round(c.spO2 + Math.sin(t / 23) * 0.6),
    cistatinaC: Number((c.cistatinaC + Math.sin(t / 40) * 0.02).toFixed(2)),
    creatinina: 1.0,
    calcioIonico: Number((c.calcioIonico + Math.sin(t / 50) * 0.01).toFixed(2)),
    linfocitos: Math.round(c.linfocitos + Math.sin(t / 30) * 40),
    neutrofilos: Math.round(c.neutrofilos + Math.sin(t / 27) * 80),
    cortisol: Number((c.cortisol + Math.sin(t / 35)).toFixed(1)),
    co2Level: Math.round(c.co2Level + Math.sin(t / 15) * 80 + wobble(t, 2) * 30),
    radiationRate: Number((0.45 + Math.sin(t / 20) * 0.1).toFixed(2)),
    radiationAccumulated: Number(((base.radiationAccumulated ?? 45) + t * 0.002).toFixed(1)),
  }));
}

/**
 * Guion de telemetría del escenario. `baseline` son las lecturas del último
 * día registrado: el día de hoy arranca desde ahí.
 */
export function scenarioScript(
  scenario: Exclude<CrewScenario, 'live'>,
  baseline?: ScenarioFrame
): { frames: ScenarioFrame[]; loop: boolean } {
  const base: Full = { ...NOMINAL };
  if (baseline) {
    for (const k of KEYS) {
      const v = baseline[k];
      if (typeof v === 'number' && Number.isFinite(v)) base[k] = v;
    }
    // Lo ambiental del día anterior no se arrastra: hoy empieza normal.
    base.radiationRate = Math.min(base.radiationRate, scenario === 'critical' ? 30 : 0.5);
    base.co2Level = Math.min(base.co2Level, scenario === 'critical' ? 1400 : 850);
  }
  return scenario === 'critical'
    ? { frames: criticalFrames(base), loop: false }
    : { frames: stableFrames(base), loop: true };
}

/* ------------------------------------------------------------------ */
/* Bitácora de eventos del escenario                                   */
/* ------------------------------------------------------------------ */

/** Textos de cada evento: viven en el diccionario (`t.scenarioText`). */
export type ScenarioEventId =
  | 'headache' | 'dizziness' | 'nasal'
  | 'solar' | 'lymph' | 'co2' | 'tachy' | 'hypoxemia';

export interface ScenarioEvent {
  id: ScenarioEventId;
  /** Segundo del escenario en el que ocurre */
  at: number;
  level: 'info' | 'warning' | 'critical';
}

export const SCENARIO_EVENTS: Record<Exclude<CrewScenario, 'live'>, ScenarioEvent[]> = {
  stable: [
    { id: 'headache', at: 12, level: 'info' },
    { id: 'dizziness', at: 40, level: 'info' },
    { id: 'nasal', at: 75, level: 'info' },
  ],
  critical: [
    { id: 'solar', at: 25, level: 'warning' },
    { id: 'lymph', at: 50, level: 'warning' },
    { id: 'co2', at: 62, level: 'critical' },
    { id: 'tachy', at: 80, level: 'critical' },
    { id: 'hypoxemia', at: 95, level: 'critical' },
  ],
};

/* ------------------------------------------------------------------ */
/* Criterio de crisis y diagnóstico presuntivo para Tierra             */
/* ------------------------------------------------------------------ */

/** ¿Las lecturas indican una situación que pone en riesgo la vida? */
export function isLifeThreatening(v: TelemetryData): boolean {
  const rules = [v.isRenalWarning, v.isRadiationWarning, v.isCo2Warning].filter(Boolean).length;
  return v.isEmergency || v.spO2 < 90 || v.heartRate > 140 || (rules >= 2 && (v.spO2 < 94 || v.heartRate > 120));
}

export type PresumptiveId = 'hypoxemia' | 'hypercapnia' | 'tachycardia' | 'radiation' | 'renal' | 'stress';

export interface PresumptiveFinding {
  id: PresumptiveId;
  severity: 'critical' | 'warning';
}

/**
 * Diagnóstico presuntivo a partir de las lecturas. Es orientativo: lo
 * confirma o descarta el cirujano de vuelo en Tierra. Los textos están en
 * el diccionario (`t.earthAlert.dx`).
 */
export function presumptiveDiagnosis(v: TelemetryData): PresumptiveFinding[] {
  const out: PresumptiveFinding[] = [];
  if (v.spO2 < 90) out.push({ id: 'hypoxemia', severity: 'critical' });
  if (v.co2Level > 3500) out.push({ id: 'hypercapnia', severity: v.co2Level > 5000 ? 'critical' : 'warning' });
  if (v.heartRate > 120) out.push({ id: 'tachycardia', severity: v.heartRate > 140 ? 'critical' : 'warning' });
  if (v.radiationRate > 50 && v.linfocitos < 1000) out.push({ id: 'radiation', severity: 'critical' });
  if (v.isRenalWarning || v.cistatinaC > 1.15) out.push({ id: 'renal', severity: 'warning' });
  if (v.cortisol > 30) out.push({ id: 'stress', severity: 'warning' });
  return out;
}

/** Claves de las recomendaciones para Tierra (`t.earthAlert.ground`). */
export const GROUND_RECOMMENDATIONS = ['r1', 'r2', 'r3', 'r4'] as const;
