'use client';

import { Suspense, use, useSyncExternalStore } from 'react';
import AppNav from '../../components/AppNav';
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
  return (
    <>
      <AppNav mision={mision} />
      <section id="cuerpo" aria-label="Escáner corporal 3D" className="scroll-mt-12">
        <BodyMapHUD />
      </section>
      <section id="mando" aria-label="Centro de mando" className="scroll-mt-12">
        <CommandDashboard mision={mision} />
      </section>
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
