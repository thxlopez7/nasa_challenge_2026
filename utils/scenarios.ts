import type { Biomarkers, Environment, TelemetryData } from '../types/telemetry';
import type { CrewScenario } from '../types/profile';

/**
 * Guiones de telemetría de los dos escenarios de la presentación.
 * Cada fotograma es una lectura de 1 Hz que entra por el SensorSimulator.
 */

export type ScenarioFrame = Partial<Biomarkers & Environment>;
type Full = Required<ScenarioFrame>;

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

/** Puntos clave (segundo → valores); entre ellos se interpola. */
const CRITICAL_KEYS: [number, Partial<Full>][] = [
  [0, {}],
  [20, { heartRate: 76 }],
  // Evento de partículas solares: sube la radiación, caen los linfocitos.
  [35, { radiationRate: 140, radiationAccumulated: 52, linfocitos: 1100, neutrofilos: 4200, cortisol: 18, heartRate: 88 }],
  [50, { radiationRate: 150, radiationAccumulated: 58, linfocitos: 760, neutrofilos: 5300, cortisol: 24, heartRate: 96, co2Level: 900 }],
  // Fallo del depurador de CO2: hipercapnia con SpO2 todavía conservada.
  [65, { radiationRate: 150, radiationAccumulated: 62, linfocitos: 720, neutrofilos: 5400, co2Level: 4400, spO2: 97, heartRate: 108, cortisol: 28 }],
  // Afectación renal y primeros signos de descompensación.
  [80, { radiationRate: 145, radiationAccumulated: 66, linfocitos: 690, neutrofilos: 5500, co2Level: 5200, spO2: 93, heartRate: 124, cistatinaC: 1.32, calcioIonico: 1.31, creatinina: 1.05, cortisol: 32 }],
  [95, { radiationRate: 140, radiationAccumulated: 70, linfocitos: 650, neutrofilos: 5600, co2Level: 6100, spO2: 86, heartRate: 142, cistatinaC: 1.41, calcioIonico: 1.33, creatinina: 1.08, cortisol: 38 }],
  [110, { radiationRate: 135, radiationAccumulated: 73, linfocitos: 620, neutrofilos: 5700, co2Level: 6400, spO2: 82, heartRate: 150, cistatinaC: 1.46, calcioIonico: 1.35, creatinina: 1.09, cortisol: 41 }],
];

const DIGITS: Record<keyof Full, number> = {
  heartRate: 0, spO2: 0, cistatinaC: 2, creatinina: 2, calcioIonico: 2, linfocitos: 0,
  neutrofilos: 0, cortisol: 1, co2Level: 0, radiationRate: 1, radiationAccumulated: 1,
};

/** Ruido pequeño y determinista para que las curvas no sean rectas. */
const wobble = (t: number, k: number) => Math.sin(t * 1.7 + k * 3.1) * 0.5 + Math.sin(t * 0.43 + k) * 0.5;

function fromKeys(keys: [number, Partial<Full>][]): ScenarioFrame[] {
  // Rellena cada punto clave con los valores del anterior.
  const filled: [number, Full][] = [];
  let acc = { ...NOMINAL };
  for (const [t, v] of keys) {
    acc = { ...acc, ...v };
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
    (Object.keys(NOMINAL) as (keyof Full)[]).forEach((key, n) => {
      const base = a[key] + (b[key] - a[key]) * k;
      const jitter =
        key === 'heartRate' ? wobble(t, n) * 2 : key === 'co2Level' ? wobble(t, n) * 40 : 0;
      f[key] = Number((base + jitter).toFixed(DIGITS[key]));
    });
    frames.push(f);
  }
  return frames;
}

/** Escenario estable: lecturas normales con pequeñas variaciones (en bucle). */
function stableFrames(): ScenarioFrame[] {
  return Array.from({ length: 120 }, (_, t) => ({
    heartRate: Math.round(70 + Math.sin(t / 9) * 4 + wobble(t, 1) * 2),
    spO2: Math.round(98 + Math.sin(t / 23)),
    cistatinaC: Number((0.84 + Math.sin(t / 40) * 0.03).toFixed(2)),
    creatinina: 1.0,
    calcioIonico: Number((1.12 + Math.sin(t / 50) * 0.02).toFixed(2)),
    linfocitos: Math.round(1480 + Math.sin(t / 30) * 40),
    neutrofilos: Math.round(3000 + Math.sin(t / 27) * 80),
    cortisol: Number((11 + Math.sin(t / 35)).toFixed(1)),
    co2Level: Math.round(720 + Math.sin(t / 15) * 120 + wobble(t, 2) * 30),
    radiationRate: Number((0.45 + Math.sin(t / 20) * 0.1).toFixed(2)),
    radiationAccumulated: Number((45 + t * 0.002).toFixed(1)),
  }));
}

export const SCENARIO_FRAMES: Record<Exclude<CrewScenario, 'live'>, { frames: ScenarioFrame[]; loop: boolean }> = {
  critical: { frames: fromKeys(CRITICAL_KEYS), loop: false },
  stable: { frames: stableFrames(), loop: true },
};

/* ------------------------------------------------------------------ */
/* Bitácora de eventos del escenario                                   */
/* ------------------------------------------------------------------ */

export interface ScenarioEvent {
  /** Segundo del escenario en el que ocurre */
  at: number;
  level: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  /** Qué hacer (para la tripulación) */
  action?: string;
}

export const SCENARIO_EVENTS: Record<Exclude<CrewScenario, 'live'>, ScenarioEvent[]> = {
  stable: [
    {
      at: 12,
      level: 'info',
      title: 'Cefalea leve · 3/10',
      detail: 'Los fluidos del cuerpo se desplazan hacia la cabeza en microgravedad. Es habitual los primeros días.',
      action: 'Hidrátate, descansa la vista unos minutos y, si persiste, toma el analgésico del botiquín según el protocolo.',
    },
    {
      at: 40,
      level: 'info',
      title: 'Mareo al girar la cabeza · 2/10',
      detail: 'Síndrome de adaptación espacial: el oído interno se reajusta a la ingravidez.',
      action: 'Mueve la cabeza despacio y fija la mirada en un punto de referencia del módulo.',
    },
    {
      at: 75,
      level: 'info',
      title: 'Congestión nasal y cara hinchada',
      detail: 'Efecto normal de la redistribución de fluidos («cara de luna»). Sin cambios en los signos vitales.',
      action: 'No requiere tratamiento. Se registra para el seguimiento semanal.',
    },
  ],
  critical: [
    {
      at: 25,
      level: 'warning',
      title: 'Evento de partículas solares',
      detail: 'La radiación sube por encima de 50 µSv/h.',
      action: 'Desplázate al refugio blindado del módulo.',
    },
    {
      at: 50,
      level: 'warning',
      title: 'Linfocitos en descenso',
      detail: 'Ratio neutrófilos/linfocitos por encima de 3: inmunosupresión por radiación (R2).',
    },
    {
      at: 62,
      level: 'critical',
      title: 'Fallo del depurador de CO2',
      detail: 'El CO2 del módulo supera 3500 ppm (R3).',
      action: 'Activa el depurador de respaldo y colócate la mascarilla de oxígeno.',
    },
    {
      at: 80,
      level: 'critical',
      title: 'Taquicardia y caída de la saturación',
      detail: 'FC > 120 lpm y SpO2 < 94 %. Cistatina C y calcio elevados (R1).',
    },
    {
      at: 95,
      level: 'critical',
      title: 'Hipoxemia grave',
      detail: 'SpO2 < 90 %. El tripulante deja de responder a las comprobaciones.',
    },
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

export interface PresumptiveFinding {
  title: string;
  basis: string;
  severity: 'critical' | 'warning';
}

/**
 * Diagnóstico presuntivo a partir de las lecturas. Es orientativo: lo
 * confirma o descarta el cirujano de vuelo en Tierra.
 */
export function presumptiveDiagnosis(v: TelemetryData): PresumptiveFinding[] {
  const out: PresumptiveFinding[] = [];
  const nlr = v.linfocitos > 0 ? v.neutrofilos / v.linfocitos : 0;
  if (v.spO2 < 90) {
    out.push({ title: 'Insuficiencia respiratoria aguda con hipoxemia', basis: `SpO2 ${v.spO2} %`, severity: 'critical' });
  }
  if (v.co2Level > 3500) {
    out.push({ title: 'Hipercapnia por fallo del soporte vital (ECLSS)', basis: `CO2 ${v.co2Level} ppm en el módulo`, severity: v.co2Level > 5000 ? 'critical' : 'warning' });
  }
  if (v.heartRate > 120) {
    out.push({ title: 'Taquicardia con posible descompensación hemodinámica', basis: `FC ${v.heartRate} lpm`, severity: v.heartRate > 140 ? 'critical' : 'warning' });
  }
  if (v.radiationRate > 50 && v.linfocitos < 1000) {
    out.push({ title: 'Inmunosupresión aguda por radiación', basis: `Radiación ${v.radiationRate} µSv/h · linfocitos ${v.linfocitos}/µL · NLR ${nlr.toFixed(1)}`, severity: 'critical' });
  }
  if (v.isRenalWarning || v.cistatinaC > 1.15) {
    out.push({ title: 'Lesión renal incipiente con hipercalcemia', basis: `Cistatina C ${v.cistatinaC} mg/L · Ca²⁺ ${v.calcioIonico} mmol/L · creatinina ${v.creatinina} mg/dL`, severity: 'warning' });
  }
  if (v.cortisol > 30) {
    out.push({ title: 'Respuesta de estrés agudo', basis: `Cortisol ${v.cortisol} ng/mL`, severity: 'warning' });
  }
  return out;
}

/** Recomendaciones que acompañan a la alerta (para el equipo médico en Tierra). */
export const GROUND_RECOMMENDATIONS = [
  'Confirmar el diagnóstico con el cirujano de vuelo y priorizar la vía aérea: oxígeno al 100 %.',
  'Ordenar a la tripulación restante el traslado al refugio blindado y el cambio al depurador de CO2 de respaldo.',
  'Preparar la pauta de hidratación y vigilar la función renal en las próximas lecturas.',
  'Evaluar el aborto de la actividad en curso y el plan de evacuación médica.',
];

/** Retraso de la señal Tierra ↔ destino, en segundos (estimación de demo). */
export const SIGNAL_DELAY_S: Record<'luna' | 'marte', number> = {
  luna: 1.3,
  marte: 12.5 * 60,
};
