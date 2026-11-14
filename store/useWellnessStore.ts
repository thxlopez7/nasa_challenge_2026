import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  MissionDefinition,
  MissionId,
  WellnessData,
  WellnessEvent,
  WellnessState,
} from '../types/wellness';

export const MISSIONS: readonly MissionDefinition[] = [
  {
    id: 'ared',
    title: 'Ejercicio resistivo ARED',
    description:
      'Sesión en el dispositivo de ejercicio resistivo avanzado para frenar la pérdida ósea y muscular en microgravedad.',
    category: 'PHYSICAL',
    steps: 3,
    stepLabel: 'bloque',
    stepLabelPlural: 'bloques',
    xpPerStep: 40,
  },
  {
    id: 'hydration',
    title: 'Protocolo de hidratación',
    description:
      'Registra cada toma de líquido para mantener el volumen urinario y reducir el riesgo de cálculos renales.',
    category: 'PHYSICAL',
    steps: 4,
    stepLabel: 'toma',
    stepLabelPlural: 'tomas',
    xpPerStep: 15,
  },
  {
    id: 'citrate',
    title: 'Citrato de potasio',
    description:
      'Dosis según la prescripción del cirujano de vuelo. Contramedida frente a la formación de cálculos.',
    category: 'PHYSICAL',
    steps: 1,
    stepLabel: 'dosis',
    stepLabelPlural: 'dosis',
    xpPerStep: 30,
  },
  {
    id: 'coherence',
    title: 'Pausa de coherencia cardíaca',
    description:
      'Respiración guiada a 6 ciclos por minuto (5 s inhalar · 5 s exhalar) para regular el estrés y el aislamiento.',
    category: 'MENTAL',
    steps: 3,
    stepLabel: 'sesión',
    stepLabelPlural: 'sesiones',
    xpPerStep: 25,
  },
];

export const XP_PER_LEVEL = 250;
export const MISSION_COMPLETE_BONUS = 50;

export const getLevel = (xp: number): number =>
  Math.floor(xp / XP_PER_LEVEL) + 1;

export const getMission = (id: MissionId): MissionDefinition => {
  const mission = MISSIONS.find((m) => m.id === id);
  if (!mission) throw new Error(`Misión desconocida: ${id}`);
  return mission;
};

/** Día local en formato YYYY-MM-DD */
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return toDayKey(new Date(y, m - 1, d - 1));
}

const emptyProgress = (): Record<MissionId, number> => ({
  ared: 0,
  hydration: 0,
  citrate: 0,
  coherence: 0,
});

const initialData: WellnessData = {
  xp: 0,
  streak: 0,
  bestStreak: 0,
  day: '',
  lastCompletedDay: null,
  progress: emptyProgress(),
};

export const useWellnessStore = create<WellnessState>()(
  persist(
    (set, get) => ({
      ...initialData,

      syncDay: (today) => {
        const { day, lastCompletedDay } = get();
        if (day === today) return;

        const keepsStreak =
          lastCompletedDay === today ||
          lastCompletedDay === previousDayKey(today);

        set((state) => ({
          day: today,
          progress: emptyProgress(),
          streak: keepsStreak ? state.streak : 0,
        }));
      },

      logStep: (missionId) => {
        const state = get();
        const mission = getMission(missionId);
        const current = state.progress[missionId];
        if (current >= mission.steps) return [];

        const events: WellnessEvent[] = [];
        const nextProgress = { ...state.progress, [missionId]: current + 1 };

        let gained = mission.xpPerStep;
        events.push({ type: 'XP', amount: mission.xpPerStep, missionId });

        if (nextProgress[missionId] === mission.steps) {
          gained += MISSION_COMPLETE_BONUS;
          events.push({
            type: 'MISSION_COMPLETE',
            missionId,
            bonus: MISSION_COMPLETE_BONUS,
          });
        }

        const nextXp = state.xp + gained;
        const nextLevel = getLevel(nextXp);
        if (nextLevel > getLevel(state.xp)) {
          events.push({ type: 'LEVEL_UP', level: nextLevel });
        }

        let { streak, bestStreak, lastCompletedDay } = state;
        const allDone = MISSIONS.every(
          (m) => nextProgress[m.id] >= m.steps
        );
        if (allDone && lastCompletedDay !== state.day) {
          streak += 1;
          bestStreak = Math.max(bestStreak, streak);
          lastCompletedDay = state.day;
          events.push({ type: 'STREAK', streak });
        }

        set({
          progress: nextProgress,
          xp: nextXp,
          streak,
          bestStreak,
          lastCompletedDay,
        });
        return events;
      },
    }),
    {
      name: 'exovitals-wellness-storage',
      storage: createJSONStorage(() => window.localStorage),
      // Se rehidrata en el cliente tras montar, para evitar desajustes de SSR.
      skipHydration: true,
      partialize: ({ xp, streak, bestStreak, day, lastCompletedDay, progress }) => ({
        xp,
        streak,
        bestStreak,
        day,
        lastCompletedDay,
        progress,
      }),
    }
  )
);
