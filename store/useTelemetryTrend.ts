'use client';

import { useEffect, useState } from 'react';
import { deriveSystemSnapshots, type PhysiologicalSystemId } from './selectors';
import { useTelemetryStore } from './useTelemetryStore';
import { mockInitialState, type TelemetryData } from '../types/telemetry';

export type SystemTrendSeries = Record<PhysiologicalSystemId, number[]>;

const MAX_POINTS = 14;

function sampleScores(state: TelemetryData): Record<PhysiologicalSystemId, number> {
  const snaps = deriveSystemSnapshots({
    biomarkers: {
      heartRate: state.heartRate,
      spO2: state.spO2,
      cistatinaC: state.cistatinaC,
      creatinina: state.creatinina,
      calcioIonico: state.calcioIonico,
      linfocitos: state.linfocitos,
      neutrofilos: state.neutrofilos,
      cortisol: state.cortisol,
    },
    environment: {
      co2Level: state.co2Level,
      radiationRate: state.radiationRate,
      radiationAccumulated: state.radiationAccumulated,
    },
    alerts: {
      isEmergency: state.isEmergency,
      isRenalWarning: state.isRenalWarning,
      isRadiationWarning: state.isRadiationWarning,
      isCo2Warning: state.isCo2Warning,
    },
    sleepHoursRecorded: null,
  });

  return {
    neuro: snaps.neuro.loadScore,
    cardio: snaps.cardio.loadScore,
    inmune: snaps.inmune.loadScore,
    oseo: snaps.oseo.loadScore,
    conducta: snaps.conducta.loadScore,
  };
}

const BASE = sampleScores(mockInitialState);
const INITIAL_SERIES: SystemTrendSeries = {
  neuro: [BASE.neuro],
  cardio: [BASE.cardio],
  inmune: [BASE.inmune],
  oseo: [BASE.oseo],
  conducta: [BASE.conducta],
};

/**
 * Mantiene una serie histórica corta (hasta 14 muestras) de carga por sistema
 * alimentada exclusivamente por los ticks reales de `useTelemetryStore`.
 */
export function useSystemTrendSeries(): SystemTrendSeries {
  const [series, setSeries] = useState<SystemTrendSeries>(INITIAL_SERIES);

  useEffect(() => {
    const pushPoint = (next: Record<PhysiologicalSystemId, number>) => {
      setSeries((prev) => ({
        neuro: [...prev.neuro.slice(-(MAX_POINTS - 1)), next.neuro],
        cardio: [...prev.cardio.slice(-(MAX_POINTS - 1)), next.cardio],
        inmune: [...prev.inmune.slice(-(MAX_POINTS - 1)), next.inmune],
        oseo: [...prev.oseo.slice(-(MAX_POINTS - 1)), next.oseo],
        conducta: [...prev.conducta.slice(-(MAX_POINTS - 1)), next.conducta],
      }));
    };

    const timer = window.setTimeout(() => {
      pushPoint(sampleScores(useTelemetryStore.getState()));
    }, 0);

    const unsubscribe = useTelemetryStore.subscribe((state) => {
      pushPoint(sampleScores(state));
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return series;
}
