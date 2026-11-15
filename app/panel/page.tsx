'use client';

import { Suspense, use, useSyncExternalStore } from 'react';
import AppNav from '../../components/AppNav';
import { useIntroStore } from '../../store/useIntroStore';
import { useActiveProfile } from '../../store/useProfileStore';
import EarthAlert from '../../components/scenario/EarthAlert';
import CommandDashboard from '../../components/CommandDashboard';
import BodyMapHUD from '../../components/body3d/BodyMapHUD';
import { parseMissionSlug, readChoice, type MissionSlug } from '../../utils/missionChoice';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const noopSubscribe = () => () => {};

/** Lee `?mision=` (dato dinámico) dentro de un Suspense. */
function WithMission({ searchParams }: { searchParams: SearchParams }) {
  const fromUrl = parseMissionSlug(use(searchParams).mision);
  // Sin `?mision=` se usa la última misión elegida.
  const saved = useSyncExternalStore(noopSubscribe, readChoice, () => undefined);
  return <OnePage mision={fromUrl ?? saved} />;
}

/**
 * Página única de ExoVitals: el cuerpo 3D ocupa la primera pantalla y debajo
 * está el centro de mando. La barra superior salta entre secciones.
 */
function OnePage({ mision }: { mision?: MissionSlug }) {
  // El escaneo 3D empieza de cero al cerrar la intro, para que se vea entero.
  const scanRun = useIntroStore((s) => s.closedCount);
  const profile = useActiveProfile();
  return (
    <>
      <AppNav mision={mision} />
      <section id="cuerpo" aria-label="Escáner corporal 3D" className="scroll-mt-14 overflow-x-clip">
        <BodyMapHUD mision={mision} scanRun={scanRun} />
      </section>
      <section id="mando" aria-label="Centro de mando" className="scroll-mt-14 overflow-x-clip">
        <CommandDashboard mision={mision} profile={profile} />
      </section>
      {profile && <EarthAlert key={`${profile.id}-${scanRun}`} profile={profile} mision={mision} />}
    </>
  );
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <WithMission searchParams={searchParams} />
    </Suspense>
  );
}
