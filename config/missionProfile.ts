import type { MissionProfileId } from '../types/mission';

// P5: owned by teammate — do not extend here

/**
 * Interfaz mínima de extensión reservada para el bloque P5
 * (perfiles fisiológicos por entorno y baseline individual del astronauta).
 * No implementar umbrales ni cálculos de z-score aquí.
 */
export interface AstronautBaselineStub {
  crewId?: string;
}

export interface MissionProfileHook {
  profileId: MissionProfileId;
  baseline?: AstronautBaselineStub;
}

export const DEFAULT_MISSION_PROFILE_HOOK: MissionProfileHook = {
  profileId: 'MARS_CONJUNCTION',
};

export function resolveMissionProfileHook(
  profileId: MissionProfileId,
  _override?: Partial<MissionProfileHook>
): MissionProfileHook {
  // P5: owned by teammate — do not extend here
  return {
    profileId,
    baseline: _override?.baseline,
  };
}
