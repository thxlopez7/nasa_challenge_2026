/**
 * Contrato del sensor de sueño ultrasónico del módulo de descanso.
 *
 * El sensor emite pulsos ultrasónicos inaudibles (18–22 kHz) y escucha su eco.
 * El desplazamiento del pecho al respirar (milímetros) y los movimientos del
 * cuerpo cambian el tiempo y la frecuencia del eco; de ahí salen la
 * respiración, el movimiento y la distancia (proximidad) al sensor. Un
 * termistor del mismo equipo mide la temperatura de la habitación.
 *
 * La noche se resume en épocas de 5 minutos.
 */

export type SleepStage = 'AWAKE' | 'REM' | 'LIGHT' | 'DEEP';

/** Una época de 5 minutos de la noche. */
export interface SleepEpoch {
  /** Minutos desde que el tripulante se acostó */
  minute: number;
  stage: SleepStage;
  /** Respiraciones por minuto */
  breathingRate: number;
  /** Intensidad de movimiento 0–100 */
  movement: number;
  /** Distancia del pecho al sensor, en cm (> OUT_OF_BED_CM = fuera del saco) */
  distanceCm: number;
  /** Temperatura de la habitación, °C */
  roomTempC: number;
}

/** Resumen de la noche: lo que se guarda en el historial. */
export interface SleepSummary {
  /** Hora local en que se acostó (HH:MM) */
  bedtime: string;
  /** Tiempo en el saco de dormir, horas */
  inBedHours: number;
  /** Tiempo dormido, horas */
  totalHours: number;
  /** Dormido / en el saco, % */
  efficiency: number;
  /** Minutos hasta dormirse */
  latencyMin: number;
  /** Despertares tras quedarse dormido */
  awakenings: number;
  /** Respiración media dormido, rpm */
  breathingRate: number;
  /** Pausas respiratorias por hora de sueño */
  breathingPauses: number;
  /** Movimiento medio 0–100 */
  movementIndex: number;
  /** Veces que salió del saco de dormir */
  outOfBed: number;
  /** Distancia media del pecho al sensor, cm */
  distanceCm: number;
  roomTempC: number;
  roomTempMinC: number;
  roomTempMaxC: number;
  /** Proporción de sueño profundo y REM sobre el tiempo dormido, % */
  deepPct: number;
  remPct: number;
}

export interface SleepNight {
  summary: SleepSummary;
  epochs: SleepEpoch[];
}
