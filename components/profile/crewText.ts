import type { TranslationDict } from '../../i18n/es';
import type { CrewProfile } from '../../types/profile';

/** Identificadores de rol que se traducen; otros valores se muestran tal cual. */
export const ROLE_IDS = ['commander', 'pilot', 'missionSpecialist', 'flightEngineer', 'medicalOfficer'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

const isRoleId = (r: string): r is RoleId => (ROLE_IDS as readonly string[]).includes(r);

/** Textos del perfil en el idioma activo (rol y, en los de demo, sus datos). */
export function crewText(p: CrewProfile, t: TranslationDict) {
  const role = isRoleId(p.role) ? t.profiles.roles[p.role] : p.role;
  if (p.id === 'demo-critico') {
    return { role, allergies: t.profiles.demo.elenaAllergies, history: t.profiles.demo.elenaHistory };
  }
  if (p.id === 'demo-estable') {
    return { role, allergies: t.profiles.demo.tomasAllergies, history: t.profiles.demo.tomasHistory };
  }
  return { role, allergies: p.allergies, history: p.history };
}
