import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CrewProfile } from '../types/profile';

/** Los dos tripulantes de la demo: uno para cada escenario de la presentación. */
export const DEMO_PROFILES: CrewProfile[] = [
  {
    id: 'demo-critico',
    name: 'Elena Ríos',
    role: 'commander',
    avatar: 'marte',
    photo: '/images/crew/elena-rios.webp',
    age: 44,
    heightCm: 168,
    weightKg: 61,
    bloodType: 'O−',
    allergies: 'Penicilina',
    history: 'Sin antecedentes relevantes. 2 misiones previas de larga duración.',
    agency: 'ESA',
    scenario: 'critical',
    demo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'demo-estable',
    name: 'Tomás Vega',
    role: 'missionSpecialist',
    avatar: 'luna',
    photo: '/images/crew/tomas-vega.webp',
    age: 36,
    heightCm: 181,
    weightKg: 77,
    bloodType: 'A+',
    allergies: 'Ninguna',
    history: 'Migraña ocasional controlada. Primera misión de larga duración.',
    agency: 'NASA',
    scenario: 'stable',
    demo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

interface ProfileState {
  /** Perfiles creados por el usuario (los de demo van siempre aparte) */
  custom: CrewProfile[];
  activeId: string | null;
  addProfile: (p: Omit<CrewProfile, 'id' | 'createdAt' | 'demo'>) => CrewProfile;
  removeProfile: (id: string) => void;
  setActive: (id: string) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      custom: [],
      activeId: null,
      addProfile: (p) => {
        const profile: CrewProfile = {
          ...p,
          id: `crew-${Date.now().toString(36)}`,
          createdAt: new Date().toISOString(),
        };
        set({ custom: [...get().custom, profile] });
        return profile;
      },
      removeProfile: (id) =>
        set((s) => ({
          custom: s.custom.filter((p) => p.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      setActive: (id) => set({ activeId: id }),
    }),
    {
      name: 'exovitals-crew-profiles',
      storage: createJSONStorage(() => window.localStorage),
      // Se rehidrata tras montar para no desajustar el HTML del servidor.
      skipHydration: true,
    }
  )
);

export const allProfiles = (custom: CrewProfile[]): CrewProfile[] => [...DEMO_PROFILES, ...custom];

export function findProfile(custom: CrewProfile[], id: string | null): CrewProfile | undefined {
  return id ? allProfiles(custom).find((p) => p.id === id) : undefined;
}

/** Perfil activo (o undefined antes de elegir). */
export function useActiveProfile(): CrewProfile | undefined {
  const custom = useProfileStore((s) => s.custom);
  const activeId = useProfileStore((s) => s.activeId);
  return findProfile(custom, activeId);
}
