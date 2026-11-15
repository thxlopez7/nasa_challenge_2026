/**
 * Perfil de tripulante: la "cuenta" con la que se entra a ExoVitals. Guarda
 * los datos médicos de base que acompañan a cualquier alerta enviada a Tierra.
 */

/** Guion de telemetría que vive el perfil durante la demo. */
export type CrewScenario =
  /** Se descompensa hasta un estado crítico y se alerta a Tierra sola. */
  | 'critical'
  /** Se mantiene estable con molestias leves (cefalea, mareo). */
  | 'stable'
  /** Telemetría del dataset de sensores, sin guion. */
  | 'live';

export type AvatarId = 'nebula' | 'solar' | 'marte' | 'luna' | 'aurora' | 'oceano';

export type BloodType = 'A+' | 'A−' | 'B+' | 'B−' | 'AB+' | 'AB−' | 'O+' | 'O−';

export interface CrewProfile {
  id: string;
  name: string;
  role: string;
  avatar: AvatarId;
  /** Foto de portada (URL o data URL). Si no hay, se usa el avatar ilustrado. */
  photo?: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bloodType: BloodType;
  /** Alergias conocidas ("Ninguna" si no hay) */
  allergies: string;
  /** Antecedentes o medicación habitual */
  history: string;
  /** Agencia o país de origen */
  agency: string;
  scenario: CrewScenario;
  /** Perfiles de demostración: no se pueden borrar */
  demo?: boolean;
  createdAt: string;
}
