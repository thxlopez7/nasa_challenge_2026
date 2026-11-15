'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, House, Moon, Orbit, ScanLine } from 'lucide-react';
import { useActiveProfile } from '../store/useProfileStore';
import AstroAvatar from './profile/AstroAvatar';
import { useIntroStore } from '../store/useIntroStore';
import { MISSION_CHOICES, saveChoice, type MissionSlug } from '../utils/missionChoice';

const SLUGS: MissionSlug[] = ['luna', 'marte'];

const SECTIONS = [
  { id: 'cuerpo', label: 'Cuerpo 3D', icon: ScanLine },
  { id: 'mando', label: 'Centro de mando', icon: Activity },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

/**
 * Barra fija de la página única: salta entre secciones (marcando la que se
 * está viendo) y permite cambiar de misión (Luna / Marte) sin perder el
 * progreso de cada destino.
 */
export function AppNav({ mision }: { mision?: MissionSlug }) {
  const showIntro = useIntroStore((s) => s.show);
  const profile = useActiveProfile();
  const [active, setActive] = useState<SectionId>('cuerpo');

  // Recuerda la misión activa para la próxima visita.
  useEffect(() => {
    if (mision) saveChoice(mision);
  }, [mision]);

  // Marca la sección visible mientras se hace scroll.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => !!el
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id as SectionId);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const goTo = (id: SectionId) => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
  };

  return (
    <nav
      aria-label="Secciones de ExoVitals"
      className="sticky top-0 z-50 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-950/85 backdrop-blur px-4 sm:px-6 py-2.5 font-mono text-xs"
    >
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="inline-flex items-center gap-2 font-brand uppercase tracking-[0.2em] text-slate-200 hover:text-cyan-300 transition cursor-pointer"
      >
        <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
        ExoVitals
      </button>

      <div className="flex gap-1">
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                goTo(id);
              }}
              aria-current={on ? 'location' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition ${
                on ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </a>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden md:inline text-slate-500">Misión</span>
        <div role="radiogroup" aria-label="Elegir misión" className="flex rounded-full border border-slate-700 p-0.5">
          {SLUGS.map((slug) => {
            const choice = MISSION_CHOICES[slug];
            const Icon = slug === 'luna' ? Moon : Orbit;
            const on = mision === slug;
            return (
              <Link
                key={slug}
                href={`/panel?mision=${slug}`}
                scroll={false}
                replace
                role="radio"
                aria-checked={on}
                title={choice.tagline}
                onClick={() => saveChoice(slug)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
                  on
                    ? slug === 'marte'
                      ? 'bg-orange-500/20 text-orange-100'
                      : 'bg-slate-200/15 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {choice.label}
              </Link>
            );
          })}
        </div>
        {profile && (
          <button
            type="button"
            onClick={() => showIntro('profiles')}
            title="Cambiar de tripulante"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 py-0.5 pl-0.5 pr-3 text-slate-300 hover:border-slate-400 hover:text-white transition cursor-pointer"
          >
            <AstroAvatar id={profile.avatar} className="h-6 w-6 rounded-full" />
            <span className="hidden sm:inline">{profile.name}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => showIntro('title')}
          title="Volver al inicio de la experiencia"
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 px-3 py-1 text-cyan-200 hover:bg-cyan-500/15 transition cursor-pointer"
        >
          <House className="h-3.5 w-3.5" aria-hidden />
          Inicio
        </button>
      </div>
    </nav>
  );
}

export default AppNav;
