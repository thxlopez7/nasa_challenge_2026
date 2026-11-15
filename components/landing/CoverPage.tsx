'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Orbit } from 'lucide-react';
import { MISSION_CHOICES, type MissionSlug } from '../../utils/missionChoice';
import Starfield from './Starfield';

const EXIT_MS = 1100;

/**
 * Portada con parallax por capas:
 *   0 · centro galáctico (foto de fondo)       → se mueve poco
 *   1 · estrellas lejanas (canvas con profundidad)
 *   2 · brillos de nebulosa                     → se mueven más
 *   3 · título                                  → flota por delante
 * El puntero (o la inclinación del móvil) desplaza cada capa según su
 * profundidad. Al elegir misión, las estrellas saltan a warp y se entra al panel.
 */
export function CoverPage() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState<MissionSlug | null>(null);

  // Precarga el panel para que el salto warp no espere a la red.
  useEffect(() => {
    router.prefetch('/panel?mision=luna');
    router.prefetch('/panel?mision=marte');
  }, [router]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const target = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let raf = 0;

    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      target.x = Math.max(-1, Math.min(1, e.gamma / 30));
      target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    };
    const loop = (t: number) => {
      // Deriva lenta cuando no hay puntero, para que la escena respire.
      const driftX = Math.sin(t / 7000) * 0.15;
      const driftY = Math.cos(t / 9000) * 0.1;
      pos.x += (target.x + driftX - pos.x) * 0.05;
      pos.y += (target.y + driftY - pos.y) * 0.05;
      el.style.setProperty('--px', pos.x.toFixed(4));
      el.style.setProperty('--py', pos.y.toFixed(4));
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onPointer);
    window.addEventListener('deviceorientation', onTilt);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);

  const go = (slug: MissionSlug) => {
    if (leaving) return;
    setLeaving(slug);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => router.push(`/panel?mision=${slug}`), reduced ? 0 : EXIT_MS);
  };

  return (
    <main
      ref={root}
      className={`cover relative h-[100svh] w-full overflow-hidden bg-[#03020b] text-white ${leaving ? 'cover-leaving' : ''}`}
    >
      {/* Capa 0 · centro galáctico */}
      <div className="cover-layer cover-depth-0" aria-hidden>
        <div className="cover-galaxy" />
      </div>

      {/* Capa 1 · estrellas lejanas con profundidad */}
      <div className="cover-layer cover-depth-1" aria-hidden>
        <Starfield warp={!!leaving} transparent />
      </div>

      {/* Capa 2 · brillos de nebulosa */}
      <div className="cover-layer cover-depth-2" aria-hidden>
        <div className="cover-glow cover-glow-a" />
        <div className="cover-glow cover-glow-b" />
      </div>

      {/* Viñeta para leer el texto */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(3,2,11,0.75)_100%)]" aria-hidden />

      {/* Capa 3 · contenido */}
      <div className="cover-layer cover-depth-3 flex flex-col items-center justify-center px-5 text-center">
        <p className="cover-rise font-mono text-[10px] sm:text-xs uppercase tracking-[0.45em] text-cyan-200/80" style={{ animationDelay: '0.2s' }}>
          NASA Space Apps Challenge 2026
        </p>

        <h1 className="mt-5 font-display font-bold leading-[0.95] tracking-tight">
          <span className="cover-rise block text-[13vw] sm:text-8xl lg:text-[9rem] cover-title" style={{ animationDelay: '0.35s' }}>
            EXOVITALS
          </span>
          <span className="cover-rise mt-3 flex items-center justify-center gap-3 sm:gap-5 text-sm sm:text-2xl lg:text-3xl tracking-[0.3em] sm:tracking-[0.4em] text-cyan-100" style={{ animationDelay: '0.6s' }}>
            <span className="h-px w-8 sm:w-16 bg-gradient-to-r from-transparent to-cyan-300" aria-hidden />
            MEDICAL COMMAND
            <span className="h-px w-8 sm:w-16 bg-gradient-to-l from-transparent to-cyan-300" aria-hidden />
          </span>
        </h1>

        <div className="cover-rise mt-12 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '0.9s' }}>
          {(['luna', 'marte'] as const).map((slug) => {
            const choice = MISSION_CHOICES[slug];
            const Icon = slug === 'luna' ? Moon : Orbit;
            const chosen = leaving === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => go(slug)}
                disabled={!!leaving}
                aria-label={`Entrar a la misión ${choice.label}: ${choice.tagline}`}
                className={`cover-mission group inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-display font-bold tracking-wider backdrop-blur-md transition cursor-pointer disabled:cursor-default ${
                  slug === 'marte'
                    ? 'border-orange-300/50 bg-orange-500/10 text-orange-100 hover:bg-orange-500/25 hover:border-orange-200'
                    : 'border-slate-200/50 bg-white/5 text-slate-100 hover:bg-white/15 hover:border-white'
                } ${chosen ? 'scale-110' : ''}`}
              >
                <Icon className="h-4 w-4 transition-transform group-hover:rotate-12" aria-hidden />
                MISIÓN {choice.label.toUpperCase()}
                <span className="hidden sm:inline font-mono font-normal text-[10px] tracking-normal opacity-70">
                  {choice.tagline}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="absolute bottom-3 inset-x-0 text-center font-mono text-[10px] text-slate-400/70 px-4">
        Centro galáctico · NASA/JPL-Caltech/ESA/CXC/STScI (Hubble, Spitzer y Chandra)
      </p>
    </main>
  );
}

export default CoverPage;
