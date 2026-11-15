'use client';

import { useEffect, useRef, useState } from 'react';
import { initialState, useTelemetryStore } from '../store/useTelemetryStore';
import type { Biomarkers, Environment } from '../types/telemetry';

type ScenarioFrame = Partial<Biomarkers & Environment>;

export function SensorSimulator(): null {
  const updateSensors = useTelemetryStore((state) => state.updateSensors);
  const [scenarioData, setScenarioData] = useState<ScenarioFrame[]>([]);
  const tickIndex = useRef<number>(0);

  useEffect(() => {
    const abortController = new AbortController();

    fetch('/data/scenario_ridge_critical.json', {
      signal: abortController.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            `Error al cargar el dataset: HTTP ${res.status} (${res.statusText})`
          );
        }
        return res.json();
      })
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          tickIndex.current = 0;
          setScenarioData(data as ScenarioFrame[]);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error(
          '[SensorSimulator] Fallo cargando /data/scenario_ridge_critical.json:',
          error
        );
      });

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = useTelemetryStore.subscribe((state, prevState) => {
      const overrideCleared =
        prevState.isManualOverride && !state.isManualOverride;
      const restoredToInitial =
        !state.isManualOverride &&
        state.heartRate === initialState.heartRate &&
        state.spO2 === initialState.spO2 &&
        state.cistatinaC === initialState.cistatinaC &&
        state.creatinina === initialState.creatinina &&
        state.calcioIonico === initialState.calcioIonico &&
        state.co2Level === initialState.co2Level &&
        state.radiationRate === initialState.radiationRate &&
        state.radiationAccumulated === initialState.radiationAccumulated;

      if (overrideCleared || restoredToInitial) {
        tickIndex.current = 0;
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (scenarioData.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      const { isManualOverride } = useTelemetryStore.getState();
      if (isManualOverride) return; // Pausa la inyección de datos si estamos en un escenario manual

      const currentData = scenarioData[tickIndex.current];

      if (currentData && typeof currentData === 'object') {
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
