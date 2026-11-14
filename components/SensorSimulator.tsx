'use client';

import { useEffect } from 'react';
import { useTelemetryStore } from '../store/useTelemetryStore';

export function SensorSimulator(): null {
  useEffect(() => {
    const intervalId = setInterval(() => {
      const { heartRate, co2Level, updateSensors } =
        useTelemetryStore.getState();

      const hrNoise = Math.floor(Math.random() * 5) - 2; // [-2, +2] bpm
      const co2Noise = (Math.floor(Math.random() * 5) - 2) * 5; // [-10, +10] ppm

      const nextHeartRate = Math.max(45, Math.min(185, heartRate + hrNoise));
      const nextCo2Level = Math.max(350, Math.min(8000, co2Level + co2Noise));

      updateSensors({
        heartRate: nextHeartRate,
        co2Level: nextCo2Level,
      });
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return null;
}

export default SensorSimulator;
