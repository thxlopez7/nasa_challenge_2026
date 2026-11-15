import type { MissionProfileId } from '../types/mission';

export type SupportedLang = 'es' | 'en';

export interface MissionCommsProfile {
  profileId: MissionProfileId;
  /** Latencia mínima unidireccional Tierra-nave en segundos. */
  oneWayLatencySecMin: number;
  /** Latencia máxima unidireccional Tierra-nave en segundos. */
  oneWayLatencySecMax: number;
  /** Latencia nominal unidireccional para cálculos/simulación en segundos. */
  oneWayLatencyNominalSec: number;
  /** Si la misión sufre apagón periódico por conjunción solar. */
  hasSolarConjunctionBlackout: boolean;
  /** Duración aproximada de conjunción solar en días, cuando aplica. */
  solarBlackoutDays: number;
  /** Descripción corta en ambos idiomas. */
  commsMode: Record<SupportedLang, string>;
  /** Nota operativa sobre comunicación con el Centro de Control. */
  operationalNote: Record<SupportedLang, string>;
}

/**
 * Tabla única de latencia física real por perfil de misión.
 * Referencias: física luz-distancia Tierra-Órbita (~400 km), Tierra-Luna (~384,400 km -> 1.28 s),
 * Tierra-Marte (~55M–401M km -> 3–22 min unidireccional, conjunción solar ~14 días).
 */
export const MISSION_COMMS: Record<MissionProfileId, MissionCommsProfile> = {
  ISS_6M: {
    profileId: 'ISS_6M',
    oneWayLatencySecMin: 0.3,
    oneWayLatencySecMax: 2,
    oneWayLatencyNominalSec: 1,
    hasSolarConjunctionBlackout: false,
    solarBlackoutDays: 0,
    commsMode: {
      es: 'Enlace LEO casi en tiempo real (< 2 s)',
      en: 'Near real-time LEO link (< 2 s)',
    },
    operationalNote: {
      es: 'Voz y telemetría continua vía TDRS con breves zonas ciegas orbitales.',
      en: 'Continuous TDRS voice and telemetry with brief orbital handoff gaps.',
    },
  },
  LUNAR_ARTEMIS: {
    profileId: 'LUNAR_ARTEMIS',
    oneWayLatencySecMin: 1.2,
    oneWayLatencySecMax: 1.5,
    oneWayLatencyNominalSec: 1.3,
    hasSolarConjunctionBlackout: false,
    solarBlackoutDays: 0,
    commsMode: {
      es: 'Latencia Tierra-Luna ~1.3 s (~2.6 s ida y vuelta)',
      en: 'Earth–Moon latency ~1.3 s (~2.6 s round-trip)',
    },
    operationalNote: {
      es: 'Comunicación casi interactiva con Control de Misión; posibles sombras polares sin repetidor.',
      en: 'Near-interactive link with Flight Control; possible polar terrain shadowing without relay.',
    },
  },
  MARS_CONJUNCTION: {
    profileId: 'MARS_CONJUNCTION',
    oneWayLatencySecMin: 180,
    oneWayLatencySecMax: 1320,
    oneWayLatencyNominalSec: 1200,
    hasSolarConjunctionBlackout: true,
    solarBlackoutDays: 14,
    commsMode: {
      es: 'Latencia Tierra-Marte 3–22 min (~20 min nominal)',
      en: 'Earth–Mars latency 3–22 min (~20 min nominal)',
    },
    operationalNote: {
      es: 'Triaje obligatoriamente autónomo a bordo (~40 min ida y vuelta) y apagón total ~14 días en conjunción solar.',
      en: 'Mandatory onboard autonomous triage (~40 min round-trip) plus ~14-day solar conjunction blackout.',
    },
  },
};

export function getMissionComms(profileId: MissionProfileId): MissionCommsProfile {
  return MISSION_COMMS[profileId] ?? MISSION_COMMS.MARS_CONJUNCTION;
}

export function formatOneWayLatency(profileId: MissionProfileId, lang: SupportedLang): string {
  const p = getMissionComms(profileId);
  if (p.oneWayLatencyNominalSec < 5) {
    return `${p.oneWayLatencyNominalSec.toFixed(1)} s`;
  }
  const minMins = Math.round(p.oneWayLatencySecMin / 60);
  const maxMins = Math.round(p.oneWayLatencySecMax / 60);
  const nomMins = Math.round(p.oneWayLatencyNominalSec / 60);
  return lang === 'es'
    ? `${minMins}–${maxMins} min (~${nomMins} min)`
    : `${minMins}–${maxMins} min (~${nomMins} min)`;
}
