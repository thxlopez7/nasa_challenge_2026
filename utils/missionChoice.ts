import type { MissionProfileId } from '../types/mission';

/** Misiones que se eligen desde la portada (`?mision=marte|luna`). */
export type MissionSlug = 'marte' | 'luna';

export const MISSION_CHOICES: Record<
  MissionSlug,
  { profileId: MissionProfileId; label: string; tagline: string }
> = {
  luna: {
    profileId: 'LUNAR_ARTEMIS',
    label: 'Luna',
    tagline: '40 días · polo sur lunar',
  },
  marte: {
    profileId: 'MARS_CONJUNCTION',
    label: 'Marte',
    tagline: '900 días · clase conjunción',
  },
};

export function parseMissionSlug(value: unknown): MissionSlug | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === 'marte' || v === 'luna' ? v : undefined;
}

const CHOICE_KEY = 'exovitals-mission-choice';

/** Última misión elegida (persistente en este navegador). */
export function readChoice(): MissionSlug | undefined {
  try {
    return parseMissionSlug(window.localStorage.getItem(CHOICE_KEY));
  } catch {
    return undefined;
  }
}

export function saveChoice(slug: MissionSlug): void {
  try {
    window.localStorage.setItem(CHOICE_KEY, slug);
  } catch {
    /* almacenamiento bloqueado: la app sigue funcionando con la URL */
  }
}

export const slugForProfile = (profileId: MissionProfileId): MissionSlug | undefined =>
  (Object.keys(MISSION_CHOICES) as MissionSlug[]).find(
    (slug) => MISSION_CHOICES[slug].profileId === profileId
  );
