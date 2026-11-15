import { create } from 'zustand';
import type { TelemetryData } from '../types/telemetry';
import { healthScore } from '../utils/vitalsScore';

export interface VitalSample {
  /** Marca de tiempo (ms) */
  t: number;
  heartRate: number;
  spO2: number;
  co2Level: number;
  radiationRate: number;
  linfocitos: number;
  cistatinaC: number;
  score: number;
}

/** Lecturas que se guardan: 5 minutos a 1 Hz. */
const MAX = 300;

/** Historial reciente de signos vitales, para ver la evolución en vivo. */
export const useVitalsHistory = create<{
  samples: VitalSample[];
  push: (v: TelemetryData) => void;
  clear: () => void;
}>()((set) => ({
  samples: [],
  push: (v) =>
    set((s) => {
      const now = Date.now();
      const last = s.samples[s.samples.length - 1];
      // Una muestra por segundo como mucho.
      if (last && now - last.t < 900) return s;
      const sample: VitalSample = {
        t: now,
        heartRate: v.heartRate,
        spO2: v.spO2,
        co2Level: v.co2Level,
        radiationRate: v.radiationRate,
        linfocitos: v.linfocitos,
        cistatinaC: v.cistatinaC,
        score: healthScore(v),
      };
      return { samples: [...s.samples.slice(-(MAX - 1)), sample] };
    }),
  clear: () => set({ samples: [] }),
}));
