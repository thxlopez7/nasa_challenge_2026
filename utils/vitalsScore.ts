import type { TelemetryData } from '../types/telemetry';
import { RIDGE_THRESHOLDS as T } from './clinicalEngine';

/**
 * Índice de salud 0–100 a partir de los signos vitales: 100 es un
 * tripulante en condiciones nominales. Cada parámetro fuera de su rango resta
 * puntos según lo lejos que esté. Sirve para ver de un vistazo si el
 * tripulante mejora o empeora; no es una escala clínica validada.
 */
export function healthScore(v: Pick<TelemetryData,
  'heartRate' | 'spO2' | 'co2Level' | 'radiationRate' | 'linfocitos' | 'cistatinaC' | 'cortisol' | 'calcioIonico'>): number {
  let p = 0;
  if (v.heartRate > 100) p += (v.heartRate - 100) * 0.7;
  if (v.heartRate < 50) p += (50 - v.heartRate) * 1.2;
  if (v.spO2 < 96) p += (96 - v.spO2) * 5;
  if (v.co2Level > 1000) p += Math.min(18, (v.co2Level - 1000) / 220);
  if (v.radiationRate > 2) p += Math.min(10, v.radiationRate / 14);
  if (v.linfocitos < 1200) p += Math.min(12, (1200 - v.linfocitos) / 45);
  if (v.cistatinaC > 1.0) p += Math.min(8, (v.cistatinaC - 1.0) * 20);
  if (v.calcioIonico > 1.25) p += Math.min(6, (v.calcioIonico - 1.25) * 60);
  if (v.cortisol > 15) p += Math.min(8, (v.cortisol - 15) * 0.35);
  return Math.max(0, Math.min(100, Math.round(100 - p)));
}

export type HealthBand = 'stable' | 'risk' | 'critical';

/** Bandas: ≥ 75 estable · 35–74 en riesgo · < 35 crisis vital. */
export const SCORE_STABLE = 75;
export const SCORE_CRISIS = 35;

export const bandOf = (score: number): HealthBand =>
  score >= SCORE_STABLE ? 'stable' : score >= SCORE_CRISIS ? 'risk' : 'critical';

export const BAND_LABEL: Record<HealthBand, string> = {
  stable: 'Estable',
  risk: 'En riesgo',
  critical: 'Crisis vital',
};

/** Métricas que se siguen en vivo y por días. */
export type VitalKey = 'heartRate' | 'spO2' | 'co2Level' | 'radiationRate' | 'linfocitos' | 'cistatinaC';

export interface VitalDef {
  key: VitalKey;
  label: string;
  unit: string;
  digits: number;
  /** Qué dirección es buena: subir, bajar o quedarse en rango */
  better: 'up' | 'down' | 'range';
  /** Umbral de alarma que se dibuja en la gráfica */
  threshold: number;
  thresholdLabel: string;
  /** Estado según el valor actual */
  status: (v: number) => 'ok' | 'warn' | 'crit';
}

export const VITALS: VitalDef[] = [
  {
    key: 'heartRate', label: 'Frecuencia cardíaca', unit: 'lpm', digits: 0, better: 'range',
    threshold: 120, thresholdLabel: 'Taquicardia > 120',
    status: (v) => (v > 130 || v < 45 ? 'crit' : v > 100 || v < 55 ? 'warn' : 'ok'),
  },
  {
    key: 'spO2', label: 'Saturación O2', unit: '%', digits: 0, better: 'up',
    threshold: 90, thresholdLabel: 'Hipoxemia < 90 %',
    status: (v) => (v < 90 ? 'crit' : v < 95 ? 'warn' : 'ok'),
  },
  {
    key: 'co2Level', label: 'CO2 del módulo', unit: 'ppm', digits: 0, better: 'down',
    threshold: T.co2.minCo2Level, thresholdLabel: `R3 > ${T.co2.minCo2Level}`,
    status: (v) => (v > 5000 ? 'crit' : v > T.co2.minCo2Level ? 'warn' : 'ok'),
  },
  {
    key: 'radiationRate', label: 'Radiación', unit: 'µSv/h', digits: 1, better: 'down',
    threshold: T.radiation.minRadiationRate, thresholdLabel: `R2 > ${T.radiation.minRadiationRate}`,
    status: (v) => (v > 100 ? 'crit' : v > T.radiation.minRadiationRate ? 'warn' : 'ok'),
  },
  {
    key: 'linfocitos', label: 'Linfocitos', unit: '/µL', digits: 0, better: 'up',
    threshold: T.radiation.maxLinfocitos, thresholdLabel: `R2 < ${T.radiation.maxLinfocitos}`,
    status: (v) => (v < 800 ? 'crit' : v < T.radiation.maxLinfocitos ? 'warn' : 'ok'),
  },
  {
    key: 'cistatinaC', label: 'Cistatina C', unit: 'mg/L', digits: 2, better: 'down',
    threshold: T.renal.minCistatinaC, thresholdLabel: `R1 > ${T.renal.minCistatinaC}`,
    status: (v) => (v > 1.35 ? 'crit' : v > T.renal.minCistatinaC ? 'warn' : 'ok'),
  },
];

/**
 * ¿El cambio de `from` a `to` es una mejora (+1), un empeoramiento (−1) o
 * casi nada (0)? `tolerance` es el cambio mínimo que cuenta.
 */
export function direction(def: VitalDef, from: number, to: number, tolerance: number): -1 | 0 | 1 {
  const d = to - from;
  if (Math.abs(d) < tolerance) return 0;
  if (def.better === 'up') return d > 0 ? 1 : -1;
  if (def.better === 'down') return d < 0 ? 1 : -1;
  // En rango (FC): mejora si se acerca a 75 lpm.
  return Math.abs(to - 75) < Math.abs(from - 75) ? 1 : -1;
}

/** Cambio mínimo que se considera relevante para cada métrica. */
export const TOLERANCE: Record<VitalKey, number> = {
  heartRate: 4,
  spO2: 1,
  co2Level: 150,
  radiationRate: 3,
  linfocitos: 150,
  cistatinaC: 0.04,
};
