import { useId } from 'react';
import type { AvatarId } from '../../types/profile';

/** Paleta de cada avatar: fondo y visor del casco. */
/** Nombre interno (los visibles están en `t.profiles.avatars`). */
export const AVATARS: Record<AvatarId, { label: string; bg: [string, string]; visor: [string, string] }> = {
  nebula: { label: 'Nebulosa', bg: ['#6d28d9', '#1e1b4b'], visor: ['#c4b5fd', '#4c1d95'] },
  solar: { label: 'Solar', bg: ['#d97706', '#451a03'], visor: ['#fde68a', '#b45309'] },
  marte: { label: 'Marte', bg: ['#c2410c', '#431407'], visor: ['#fdba74', '#9a3412'] },
  luna: { label: 'Luna', bg: ['#64748b', '#0f172a'], visor: ['#f1f5f9', '#475569'] },
  aurora: { label: 'Aurora', bg: ['#059669', '#022c22'], visor: ['#6ee7b7', '#065f46'] },
  oceano: { label: 'Océano', bg: ['#0284c7', '#082f49'], visor: ['#67e8f9', '#0e7490'] },
};

export const AVATAR_IDS = Object.keys(AVATARS) as AvatarId[];

/** Avatar ilustrado: casco de astronauta sobre un fondo de color. */
export function AstroAvatar({ id, className = '' }: { id: AvatarId; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const a = AVATARS[id];
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a.bg[0]} />
          <stop offset="1" stopColor={a.bg[1]} />
        </linearGradient>
        <linearGradient id={`visor-${uid}`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={a.visor[0]} />
          <stop offset="1" stopColor={a.visor[1]} />
        </linearGradient>
        <linearGradient id={`suit-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="14" fill={`url(#bg-${uid})`} />
      {/* Estrellas */}
      <circle cx="18" cy="20" r="1.4" fill="#fff" opacity="0.8" />
      <circle cx="98" cy="16" r="1" fill="#fff" opacity="0.7" />
      <circle cx="104" cy="44" r="1.6" fill="#fff" opacity="0.6" />
      <circle cx="12" cy="58" r="1" fill="#fff" opacity="0.6" />
      {/* Traje */}
      <path d="M22 120c2-22 18-32 38-32s36 10 38 32z" fill={`url(#suit-${uid})`} />
      <rect x="50" y="98" width="20" height="12" rx="3" fill={a.bg[0]} opacity="0.85" />
      {/* Casco */}
      <circle cx="60" cy="56" r="32" fill={`url(#suit-${uid})`} />
      <rect x="34" y="78" width="52" height="10" rx="5" fill="#94a3b8" />
      {/* Visor */}
      <ellipse cx="60" cy="56" rx="24" ry="21" fill={`url(#visor-${uid})`} />
      <path d="M44 48c4-8 12-12 20-12" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.55" />
      <circle cx="73" cy="64" r="3" fill="#fff" opacity="0.35" />
      {/* Antena */}
      <rect x="86" y="30" width="4" height="12" rx="2" fill="#94a3b8" />
      <circle cx="88" cy="28" r="3" fill={a.visor[0]} />
    </svg>
  );
}

export default AstroAvatar;
