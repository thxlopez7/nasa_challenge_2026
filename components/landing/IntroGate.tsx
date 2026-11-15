'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useIntroStore } from '../../store/useIntroStore';
import { useMissionStore } from '../../store/useMissionStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import type { CrewProfile } from '../../types/profile';
import type { MissionSlug } from '../../utils/missionChoice';
import ProfilePicker from '../profile/ProfilePicker';
import CoverPage from './CoverPage';

/** Rutas internas donde no tiene sentido una intro. */
const NO_INTRO = ['/test', '/sistema'];

/**
 * Entrada a la app, encima de cualquier página: pantalla de título (elegir
 * Luna o Marte) → «¿Quién está a bordo?» (elegir o crear tripulante).
 * Vive en el layout raíz, así que aparece en cada carga completa y no al
 * navegar dentro de la app.
 */
export function IntroGate() {
  const open = useIntroStore((s) => s.open);
  const step = useIntroStore((s) => s.step);
  const goTo = useIntroStore((s) => s.goTo);
  const hide = useIntroStore((s) => s.hide);
  const setActive = useProfileStore((s) => s.setActive);
  const pathname = usePathname();
  const router = useRouter();
  const visible = open && !NO_INTRO.some((p) => pathname.startsWith(p));

  // Perfiles guardados en este navegador.
  useEffect(() => {
    void useProfileStore.persist.rehydrate();
  }, []);

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

  const onChooseMission = (slug: MissionSlug) => {
    // Conserva `?lang=` y el hash (#hoy, #registrar…) al elegir misión.
    const params = new URLSearchParams(window.location.search);
    params.set('mision', slug);
    router.replace(`/panel?${params.toString()}${window.location.hash}`, { scroll: false });
    goTo('profiles');
  };

  const onPickProfile = async (p: CrewProfile) => {
    // Cada tripulante tiene su propia misión; su telemetría empieza de cero
    // (antes de cambiar de perfil, para no mezclar lecturas del anterior).
    useTelemetryStore.getState().simulateScenario('RESET');
    await useMissionStore.persist.rehydrate();
    useMissionStore.getState().switchCrew(p.id);
    setActive(p.id);
    hide();
  };

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Entrada a ExoVitals">
      {step === 'title' ? (
        <CoverPage onChoose={onChooseMission} />
      ) : (
        <ProfilePicker onPick={onPickProfile} onBack={() => goTo('title')} />
      )}
    </div>
  );
}

export default IntroGate;
