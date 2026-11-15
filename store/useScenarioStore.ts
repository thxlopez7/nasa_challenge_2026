import { create } from 'zustand';

/**
 * Reloj del escenario en curso: segundos de telemetría inyectados desde que
 * empezó el perfil activo. Lo avanza el SensorSimulator a 1 Hz.
 */
export const useScenarioStore = create<{
  elapsed: number;
  tick: () => void;
  reset: () => void;
}>()((set) => ({
  elapsed: 0,
  tick: () => set((s) => ({ elapsed: s.elapsed + 1 })),
  reset: () => set({ elapsed: 0 }),
}));
