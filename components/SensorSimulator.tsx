'use client';

import { useEffect, useRef, useState } from 'react';
import { useScenarioStore } from '../store/useScenarioStore';
import { useTelemetryStore } from '../store/useTelemetryStore';
import type { Biomarkers, Environment } from '../types/telemetry';

type ScenarioFrame = Partial<Biomarkers & Environment>;

/**
 * Inyecta lecturas a 1 Hz en el store de telemetría.
 *
 * Sin `frames`, reproduce el dataset `/data/scenario_ridge_critical.json`
 * en bucle. Con `frames`, reproduce ese guion (el del escenario del
 * tripulante); si `loop` es falso, se queda en la última lectura.
 */
export function SensorSimulator({
  frames,
  loop = true,
}: {
  frames?: ScenarioFrame[];
  loop?: boolean;
} = {}): null {
  const updateSensors = useTelemetryStore((state) => state.updateSensors);
  const [fetched, setFetched] = useState<ScenarioFrame[]>([]);
  const tickIndex = useRef<number>(0);
  const data = frames ?? fetched;

  useEffect(() => {
    if (frames) return;
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
      .then((json: unknown) => {
        if (Array.isArray(json)) {
          tickIndex.current = 0;
          setFetched(json as ScenarioFrame[]);
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
  }, [frames]);

  useEffect(() => {
    if (data.length === 0) {
      return;
    }
    tickIndex.current = 0;
    useScenarioStore.getState().reset();

    const intervalId = setInterval(() => {
      const { isManualOverride } = useTelemetryStore.getState();
      if (isManualOverride) return; // Pausa la inyección de datos si estamos en un escenario manual

      const currentData = data[tickIndex.current];

      if (currentData && typeof currentData === 'object') {
        updateSensors(currentData);
        useScenarioStore.getState().tick();
      }

      tickIndex.current = loop
        ? (tickIndex.current + 1) % data.length
        : Math.min(tickIndex.current + 1, data.length - 1);
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [data, loop, updateSensors]);

  return null;
}

export default SensorSimulator;
