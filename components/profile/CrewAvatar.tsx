import type { CrewProfile } from '../../types/profile';
import AstroAvatar from './AstroAvatar';

/** Foto del tripulante si la tiene; si no, su avatar ilustrado. */
export function CrewAvatar({ profile, className = '' }: { profile: CrewProfile; className?: string }) {
  if (profile.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- también admite fotos subidas (data URL)
      <img src={profile.photo} alt={`Foto de ${profile.name}`} className={`object-cover ${className}`} />
    );
  }
  return <AstroAvatar id={profile.avatar} className={className} />;
}

export default CrewAvatar;
