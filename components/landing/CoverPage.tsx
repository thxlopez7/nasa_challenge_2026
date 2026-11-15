'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Orbit } from 'lucide-react';
import {
  MISSION_CHOICES,
  introSkipTarget,
  saveChoice,
  type MissionSlug,
} from '../../utils/missionChoice';
import Starfield from './Starfield';

const ARRIVAL_MS = 1600;
const EXIT_MS = 1100;
const TITLE = 'EXOVITALS';
const SUBTITLE = 'MEDICAL COMMAND';

const noopSubscribe = () => () => {};

/** Profundidad de cada letra (−1 = al fondo, 1 = delante): una ola suave. */
const depthOf = (i: number, n: number) => Math.sin((i / (n - 1)) * Math.PI) * 0.9 - 0.2;

/**
 * Intro de ExoVitals.
 *
 * Se reproduce sola: llegada a velocidad warp, la galaxia se asienta y el
 * título se arma letra a letra con profundidad. Al elegir Luna o Marte, la
 * cámara entra en la galaxia y la intro desaparece (se reemplaza en el
 * historial). En el resto de la sesión se salta y va directo a la misión
 * elegida; `/?intro` la vuelve a mostrar.
 *
 * Parallax por capas: el puntero (o la inclinación del móvil) desplaza cada
 * capa según su profundidad, y el título gira levemente en 3D.
 */
export function CoverPage() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const skipTo = useSyncExternalStore(noopSubscribe, introSkipTarget, () => undefined);
  const [arriving, setArriving] = useState(true);
  const [leaving, setLeaving] = useState<MissionSlug | null>(null);

  // Intro ya vista en esta sesión → directo al panel.
  useEffect(() => {
    if (skipTo) router.replace(`/panel?mision=${skipTo}`);
  }, [skipTo, router]);

  // Precarga el panel para que el salto no espere a la red.
  useEffect(() => {
    router.prefetch('/panel?mision=luna');
    router.prefetch('/panel?mision=marte');
  }, [router]);

  // Secuencia automática: se llega en warp y se frena.
  useEffect(() => {
    const id = window.setTimeout(() => setArriving(false), ARRIVAL_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Parallax: variables CSS suavizadas, sin renders de React.
  useEffect(() => {
    const el = root.current;
    if (!el || skipTo) return;
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
      // Deriva lenta: la escena respira aunque no se mueva el puntero.
      const driftX = Math.sin(t / 7000) * 0.18;
      const driftY = Math.cos(t / 9000) * 0.12;
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
  }, [skipTo]);

  const go = (slug: MissionSlug) => {
    if (leaving) return;
    saveChoice(slug);
    setLeaving(slug);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // `replace`: la intro no queda en el historial; desaparece tras elegir.
    window.setTimeout(() => router.replace(`/panel?mision=${slug}`), reduced ? 0 : EXIT_MS);
  };

  if (skipTo) return <main className="h-[100svh] w-full bg-[#03020b]" aria-busy="true" />;

  return (
    <main
      ref={root}
      className={`cover relative h-[100svh] w-full overflow-hidden bg-[#03020b] text-white ${
        arriving ? 'cover-arriving' : ''
      } ${leaving ? 'cover-leaving' : ''}`}
    >
      {/* Capa 0 · centro galáctico */}
      <div className="cover-layer cover-depth-0" aria-hidden>
        <div className="cover-galaxy" />
      </div>

      {/* Capa 1 · estrellas con profundidad (warp al llegar y al salir) */}
      <div className="cover-layer cover-depth-1" aria-hidden>
        <Starfield warp={arriving || !!leaving} transparent />
      </div>

      {/* Capa 2 · brillos de nebulosa */}
      <div className="cover-layer cover-depth-2" aria-hidden>
        <div className="cover-glow cover-glow-a" />
        <div className="cover-glow cover-glow-b" />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(3,2,11,0.75)_100%)]" aria-hidden />

      {/* Capa 3 · tipografía y misiones */}
      <div className="cover-layer cover-depth-3 flex flex-col items-center justify-center px-5 text-center">
        <p className="cover-rise font-mono text-[10px] sm:text-xs uppercase tracking-[0.45em] text-cyan-200/80" style={{ animationDelay: '1.2s' }}>
          NASA Space Apps Challenge 2026
        </p>

        <h1 className="cover-type mt-5 font-display font-bold" aria-label={`${TITLE} — ${SUBTITLE}`}>
          <span className="cover-type-inner" aria-hidden>
            <span className="cover-word block text-[13vw] sm:text-8xl lg:text-[9rem] leading-[0.95] tracking-tight">
              {TITLE.split('').map((ch, i) => (
                <span
                  key={i}
                  className="cover-letter"
                  style={{ '--d': depthOf(i, TITLE.length).toFixed(3) } as React.CSSProperties}
                >
                  <span
                    className="cover-letter-face cover-title"
                    style={{ animationDelay: `${0.9 + i * 0.07}s, ${i * 0.35}s` }}
                  >
                    {ch}
                  </span>
                </span>
              ))}
            </span>
            <span
              className="cover-subtitle cover-rise mt-3 flex items-center justify-center gap-3 sm:gap-5 text-sm sm:text-2xl lg:text-3xl tracking-[0.3em] sm:tracking-[0.4em] text-cyan-100"
              style={{ animationDelay: '1.7s' }}
            >
              <span className="h-px w-8 sm:w-16 bg-gradient-to-r from-transparent to-cyan-300" />
              {SUBTITLE}
              <span className="h-px w-8 sm:w-16 bg-gradient-to-l from-transparent to-cyan-300" />
            </span>
          </span>
        </h1>

        <div className="cover-rise mt-12 flex flex-col items-center gap-3" style={{ animationDelay: '2.1s' }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-slate-300/80">Elige tu misión</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {(['luna', 'marte'] as const).map((slug) => {
              const choice = MISSION_CHOICES[slug];
              const Icon = slug === 'luna' ? Moon : Orbit;
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
                  } ${leaving === slug ? 'scale-110' : ''}`}
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
      </div>

      <p className="absolute bottom-3 inset-x-0 text-center font-mono text-[10px] text-slate-400/70 px-4">
        Centro galáctico · NASA/JPL-Caltech/ESA/CXC/STScI (Hubble, Spitzer y Chandra)
      </p>
    </main>
  );
}

export default CoverPage;
