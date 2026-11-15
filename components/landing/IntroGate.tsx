'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useIntroStore } from '../../store/useIntroStore';
import type { MissionSlug } from '../../utils/missionChoice';
import CoverPage from './CoverPage';

/** Rutas internas donde no tiene sentido una intro. */
const NO_INTRO = ['/test'];

/**
 * Muestra la intro encima de cualquier página al abrir la app. Vive en el
 * layout raíz, así que aparece en cada carga completa (también si se entra
 * directo a /panel o /cuerpo) y no al navegar dentro de la app.
 */
export function IntroGate() {
  const open = useIntroStore((s) => s.open);
  const hide = useIntroStore((s) => s.hide);
  const pathname = usePathname();
  const router = useRouter();
  const visible = open && !NO_INTRO.some((p) => pathname.startsWith(p));

  // Precarga el panel para que el salto no espere a la red.
  useEffect(() => {
    router.prefetch('/panel?mision=luna');
    router.prefetch('/panel?mision=marte');
  }, [router]);

  // La página de debajo no se desplaza mientras está la intro.
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible) return null;

  const onChoose = (slug: MissionSlug) => {
    // Conserva `?lang=` y el hash (#hoy, #registrar…) al elegir misión.
    const params = new URLSearchParams(window.location.search);
    params.set('mision', slug);
    router.replace(`/panel?${params.toString()}${window.location.hash}`, { scroll: false });
    hide();
  };

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Intro de ExoVitals">
      <CoverPage onChoose={onChoose} />
    </div>
  );
}

export default IntroGate;
