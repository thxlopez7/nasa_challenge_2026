import type { SVGProps } from 'react';

/**
 * Iconografía esquemática de EXOVITALS: trazo fino (1.5) sobre una
 * retícula de 24 px, sin rellenos, con remates técnicos. Heredan el color
 * (`currentColor`) y se ocultan a lectores de pantalla salvo que se les dé
 * `aria-label`.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------------- Salud ---------------- */

export const IconBone = (p: IconProps) => (
  <Base {...p}>
    <path d="M8.5 6.2a2.3 2.3 0 1 0-3.2 3.2L14.6 18.7a2.3 2.3 0 1 0 3.2-3.2z" />
    <path d="M6.2 8.5a2.3 2.3 0 1 1-3.1-.8M15.5 17.8a2.3 2.3 0 1 0 3.1.8M8.5 6.2a2.3 2.3 0 1 0-.8-3.1M17.8 15.5a2.3 2.3 0 1 1 .8 3.1" />
  </Base>
);

export const IconHeart = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    <path d="M3 12h4l1.5-2.5L11 15l1.5-3H21" />
  </Base>
);

export const IconRadiation = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="1.6" />
    <path d="M12 10.4V4a8 8 0 0 1 6.9 4l-5.5 3.2M10.6 12.8l-5.5 3.2A8 8 0 0 0 12 20v-6.4M13.4 12.8l5.5 3.2A8 8 0 0 1 12 20M10.6 11.2 5.1 8A8 8 0 0 1 12 4" />
  </Base>
);

export const IconLungs = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v8M12 12l-3 2M12 12l3 2" />
    <path d="M9 7.5C6 8 4 11 4 15.5c0 2 1 3.5 3 3.5s2-1.5 2-3.5V7.5zM15 7.5c3 .5 5 3.5 5 8 0 2-1 3.5-3 3.5s-2-1.5-2-3.5V7.5z" />
  </Base>
);

export const IconKidney = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 4C5.5 4 4 7.5 4 11s1.5 9 5 9c2.5 0 3-2 3-3.5S10 13 10 11.5 12 8.5 12 7 11 4 9 4z" />
    <path d="M15 4c3.5 0 5 3.5 5 7s-1.5 9-5 9" opacity="0.55" />
    <path d="M12 11.5h3" />
  </Base>
);

export const IconBrain = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 2.5h0a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2z" />
    <path d="M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 2.5h0a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" />
  </Base>
);

export const IconDroplet = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z" />
    <path d="M9 14.5a3 3 0 0 0 3 3" />
  </Base>
);

export const IconThermometer = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z" />
    <path d="M12 9v7" />
  </Base>
);

export const IconPulse = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 12h4l2-5 4 10 2-5h8" />
  </Base>
);

export const IconCo2 = (p: IconProps) => (
  <Base {...p}>
    <circle cx="7" cy="12" r="3" />
    <circle cx="15" cy="9" r="2.2" />
    <circle cx="15" cy="15" r="2.2" />
    <path d="M10 12h2.4M13.3 10.3 12.4 11M13.3 13.7l-.9-.7" />
  </Base>
);

/* ---------------- Navegación y sistema ---------------- */

export const IconGauge = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 16a8 8 0 1 1 16 0" />
    <path d="M12 16l4-5M6.5 16h0M17.5 16h0M8 10.5h0M16 10.5h0M12 8h0" />
  </Base>
);

export const IconGrid = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
    <path d="M13.5 16.75h6.5M16.75 13.5V20" />
  </Base>
);

export const IconSatellite = (p: IconProps) => (
  <Base {...p}>
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" transform="rotate(45 12 12)" />
    <path d="M7.8 7.8 4 4M4 8l4-4M16.2 16.2 20 20M16 20l4-4M15 6a6 6 0 0 1 3 3M15 3a9 9 0 0 1 6 6" />
  </Base>
);

export const IconMoon = (p: IconProps) => (
  <Base {...p}>
    <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z" />
    <circle cx="11" cy="13" r="1" />
    <circle cx="14" cy="16.5" r="0.6" />
  </Base>
);

export const IconRocket = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3c3 2 4.5 5.5 4.5 9.5L14 16h-4l-2.5-3.5C7.5 8.5 9 5 12 3z" />
    <circle cx="12" cy="9" r="1.5" />
    <path d="M10 16l-1 4 3-2 3 2-1-4M7.5 12.5 5 15l2.5.5M16.5 12.5 19 15l-2.5.5" />
  </Base>
);

export const IconShield = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </Base>
);

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4 2.8 19.5h18.4z" />
    <path d="M12 10v4M12 16.8h0" />
  </Base>
);

export const IconOctagon = (p: IconProps) => (
  <Base {...p}>
    <path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z" />
    <path d="M12 8v5M12 15.8h0" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
  </Base>
);

export const IconSignal = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20v-3M9 20v-7M14 20V9M19 20V4" />
  </Base>
);

/** Catálogo, útil para la página del sistema de diseño. */
export const ICONS = {
  IconBone, IconHeart, IconRadiation, IconLungs, IconKidney, IconBrain, IconDroplet, IconThermometer,
  IconPulse, IconCo2, IconGauge, IconGrid, IconSatellite, IconMoon, IconRocket, IconShield,
  IconAlert, IconOctagon, IconCheck, IconSignal,
};
