'use client';

import { useEffect } from 'react';

/** Botones principales de toda la app que llevan la onda de energía al clic. */
const PRESS_SELECTOR = 'button.bg-cyan-500, a.bg-cyan-500, button.bg-cyan-400, [data-ev-press]';

/**
 * Anima los botones principales al hacer clic: un destello y una onda cian
 * (`.ev-pressed` en globals.css). Escucha en el documento, así funciona en
 * cualquier botón principal sin tocar cada componente. Con movimiento
 * reducido no hace nada.
 */
export function PressEffects(): null {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(PRESS_SELECTOR);
      if (!el || (el as HTMLButtonElement).disabled) return;
      el.classList.remove('ev-pressed');
      // Fuerza un reflow para reiniciar la animación en clics seguidos.
      void el.offsetWidth;
      el.classList.add('ev-pressed');
      window.setTimeout(() => el.classList.remove('ev-pressed'), 600);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  return null;
}

export default PressEffects;
