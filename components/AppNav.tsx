'use client';

import Link from 'next/link';
import { Activity, Moon, Orbit, ScanLine } from 'lucide-react';
import { MISSION_CHOICES, type MissionSlug } from '../utils/missionChoice';

/**
 * Barra común para moverse entre la portada, el centro de mando y el cuerpo
 * 3D, conservando la misión elegida (`?mision=`).
 */
export function AppNav({ current, mision }: { current: 'panel' | 'cuerpo'; mision?: MissionSlug }) {
  const q = mision ? `?mision=${mision}` : '';
  const choice = mision ? MISSION_CHOICES[mision] : undefined;
  const MissionIcon = mision === 'luna' ? Moon : Orbit;

  const links = [
    { id: 'panel', href: `/panel${q}`, label: 'Centro de mando', icon: Activity },
    { id: 'cuerpo', href: `/cuerpo${q}`, label: 'Cuerpo 3D', icon: ScanLine },
  ] as const;

  return (
    <nav
      aria-label="Secciones de ExoVitals"
      className="sticky top-0 z-50 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-950/85 backdrop-blur px-4 sm:px-6 py-2.5 font-mono text-xs"
    >
      <Link href="/" className="inline-flex items-center gap-2 font-bold uppercase tracking-[0.2em] text-slate-200 hover:text-cyan-300 transition">
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

      {choice && (
        <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-cyan-500/40 px-3 py-1 text-cyan-200">
          <MissionIcon className="h-3.5 w-3.5" aria-hidden />
          Misión {choice.label}
          <span className="hidden sm:inline text-slate-500">· {choice.tagline}</span>
        </span>
      )}
    </nav>
  );
}

export default AppNav;
