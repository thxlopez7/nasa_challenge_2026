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
