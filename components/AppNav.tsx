'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Activity, Moon, Orbit, ScanLine, Sparkles } from 'lucide-react';
import { MISSION_CHOICES, saveChoice, type MissionSlug } from '../utils/missionChoice';

const SLUGS: MissionSlug[] = ['luna', 'marte'];

/**
 * Barra común: navegación entre el centro de mando y el cuerpo 3D, y el
 * selector de misión (Luna / Marte). Cambiar de misión conserva la sección
 * actual y el progreso de cada destino.
 */
export function AppNav({ current, mision }: { current: 'panel' | 'cuerpo'; mision?: MissionSlug }) {
  // Recuerda la misión activa para la próxima visita.
  useEffect(() => {
    if (mision) saveChoice(mision);
  }, [mision]);

  const q = mision ? `?mision=${mision}` : '';
  const links = [
    { id: 'panel', href: `/panel${q}`, label: 'Centro de mando', icon: Activity },
    { id: 'cuerpo', href: `/cuerpo${q}`, label: 'Cuerpo 3D', icon: ScanLine },
  ] as const;

  return (
    <nav
      aria-label="Secciones de ExoVitals"
      className="sticky top-0 z-50 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-950/85 backdrop-blur px-4 sm:px-6 py-2.5 font-mono text-xs"
    >
      <Link
        href={`/panel${q}`}
        className="inline-flex items-center gap-2 font-display font-bold uppercase tracking-[0.2em] text-slate-200 hover:text-cyan-300 transition"
      >
        <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
        ExoVitals
      </Link>

      <div className="flex gap-1">
        {links.map(({ id, href, label, icon: Icon }) => {
          const active = current === id;
          return (
            <Link
              key={id}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition ${
                active ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden md:inline text-slate-500">Misión</span>
        <div role="radiogroup" aria-label="Elegir misión" className="flex rounded-full border border-slate-700 p-0.5">
          {SLUGS.map((slug) => {
            const choice = MISSION_CHOICES[slug];
            const Icon = slug === 'luna' ? Moon : Orbit;
            const active = mision === slug;
            return (
              <Link
                key={slug}
                href={`/${current}?mision=${slug}`}
                role="radio"
                aria-checked={active}
                title={choice.tagline}
                onClick={() => saveChoice(slug)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition ${
                  active
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
        <Link
          href="/"
          title="Ver la intro otra vez"
          aria-label="Ver la intro otra vez"
          className="rounded-full p-1.5 text-slate-500 hover:text-cyan-300 hover:bg-slate-800 transition"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}

export default AppNav;
