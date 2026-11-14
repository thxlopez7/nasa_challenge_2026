'use client';

import { useEffect, useRef, useState } from 'react';
import { useTelemetryStore } from '../store/useTelemetryStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScenarioFrame = Record<string, any>;

export function SensorSimulator(): null {
  const updateSensors = useTelemetryStore((state) => state.updateSensors);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scenarioData, setScenarioData] = useState<any[]>([]);
  const tickIndex = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    fetch('/data/scenario_ridge_critical.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            `Error al cargar el dataset: HTTP ${res.status} (${res.statusText})`
          );
        }
        return res.json();
      })
      .then((data: ScenarioFrame[]) => {
        if (isMounted && Array.isArray(data)) {
          tickIndex.current = 0;
          setScenarioData(data);
        }
      })
      .catch((error: unknown) => {
        console.error(
          '[SensorSimulator] Fallo cargando /data/scenario_ridge_critical.json:',
          error
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (scenarioData.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      const { isManualOverride } = useTelemetryStore.getState();
      if (isManualOverride) return; // Pausa la inyección de datos si estamos en un escenario manual

      const currentData = scenarioData[tickIndex.current];

      if (currentData) {
        updateSensors(currentData);
      }

      tickIndex.current = (tickIndex.current + 1) % scenarioData.length;
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [scenarioData, updateSensors]);

  return null;
}

export default SensorSimulator;
