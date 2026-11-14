'use client';

import { useEffect } from 'react';
import { useTelemetryStore } from '@/store/useTelemetryStore';

const TICK_INTERVAL_MS = 1000; // 1 Hz
const HEART_RATE_NOISE_AMPLITUDE = 3; // ±3 bpm
const CO2_NOISE_AMPLITUDE = 10; // ±10 ppm

const HEART_RATE_BOUNDS = { MIN: 45, MAX: 185 } as const;
const CO2_BOUNDS = { MIN: 350, MAX: 8000 } as const;

/**
 * Genera ruido centrado en cero con distribución aproximadamente gaussiana
 * promediando dos muestras uniformes en el rango [-amplitude, +amplitude].
 */
const generateGaussianNoise = (amplitude: number): number => {
  const sample1 = Math.random() * 2 - 1;
  const sample2 = Math.random() * 2 - 1;
  return ((sample1 + sample2) / 2) * amplitude;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export function SensorSimulator(): null {
  const updateSensors = useTelemetryStore((state) => state.updateSensors);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const { heartRate, co2Level } = useTelemetryStore.getState();

      const deltaHeartRate = generateGaussianNoise(HEART_RATE_NOISE_AMPLITUDE);
      const deltaCo2 = generateGaussianNoise(CO2_NOISE_AMPLITUDE);

      const nextHeartRate = Math.round(
        clamp(
          heartRate + deltaHeartRate,
          HEART_RATE_BOUNDS.MIN,
          HEART_RATE_BOUNDS.MAX
        )
      );

      const nextCo2Level = Math.round(
        clamp(co2Level + deltaCo2, CO2_BOUNDS.MIN, CO2_BOUNDS.MAX)
      );

      updateSensors({
        heartRate: nextHeartRate,
        co2Level: nextCo2Level,
      });
    }, TICK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [updateSensors]);

  return null;
}

export default SensorSimulator;
