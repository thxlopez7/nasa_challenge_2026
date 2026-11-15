'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon, Orbit } from 'lucide-react';
import { saveChoice, type MissionSlug } from '../../utils/missionChoice';
import { DICTS } from '../../i18n/I18nContext';
import Starfield from './Starfield';

const TITLE = 'EXOVITALS';
const SUBTITLE = 'MEDICAL COMMAND';
const EXIT_MS = 1100;

/** Duración del salto warp de llegada, antes de que las estrellas se calmen. */
const ARRIVAL_MS = 1400;

/** Profundidad de cada letra (−1 = al fondo, 1 = delante): una ola suave. */
const depthOf = (i: number, n: number) => Math.sin((i / (n - 1)) * Math.PI) * 0.9 - 0.2;

/**
 * Intro de ExoVitals: la pantalla de título (la muestra IntroGate al abrir la app).
 * Se llega en warp, la galaxia se enfoca, EXOVITALS se arma letra a letra con
 * profundidad y se elige misión. Al elegir Luna o Marte, la cámara entra en
 * la galaxia y se avisa con `onChoose`.
 */
export function CoverPage({ onChoose }: { onChoose: (slug: MissionSlug) => void }) {
  // La intro no tiene selector de idioma: siempre en inglés.
  const t = DICTS.en;
  const ci = t.coverIntro;
  const root = useRef<HTMLDivElement>(null);
  const [arriving, setArriving] = useState(true);
  const [leaving, setLeaving] = useState<MissionSlug | null>(null);

  // Llegada automática en warp; después las estrellas se calman.
  useEffect(() => {
    const id = window.setTimeout(() => setArriving(false), ARRIVAL_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Parallax: variables CSS suavizadas, sin renders de React.
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
  }, []);

  const go = (slug: MissionSlug) => {
    if (leaving) return;
    saveChoice(slug);
    setLeaving(slug);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => onChoose(slug), reduced ? 0 : EXIT_MS);
  };

  return (
    <main
      ref={root}
      className={`cover relative h-[100svh] w-full overflow-hidden bg-black text-white ${
        leaving ? 'cover-leaving' : ''
      }`}
    >
      {/* Escena: galaxia y nebulosa */}
      <div className="cover-scene" aria-hidden>
        <div className="cover-layer cover-depth-0">
          <div className="cover-galaxy" />
        </div>
        <div className="cover-layer cover-depth-2">
          <div className="cover-glow cover-glow-a" />
          <div className="cover-glow cover-glow-b" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(3,2,11,0.75)_100%)]" />
      </div>

      {/* Estrellas: warp al llegar y al salir */}
      <div className="cover-layer cover-depth-1" aria-hidden>
        <Starfield warp={arriving || !!leaving} transparent />
      </div>

      {/* Pantalla de título */}
      <div className="cover-layer cover-depth-3 flex flex-col items-center justify-center px-5 text-center">
          <p className="cover-rise font-mono text-[10px] sm:text-xs uppercase tracking-[0.45em] text-cyan-200/80" style={{ animationDelay: '0.5s' }}>
            {ci.kicker}
          </p>

          <h1 className="cover-type mt-5 font-brand font-normal" aria-label={`${TITLE} — ${SUBTITLE}`}>
            <span className="cover-type-inner" aria-hidden>
              <span className="cover-word block whitespace-nowrap text-[min(10vw,9rem)] leading-[0.95] tracking-normal">
                {TITLE.split('').map((ch, i) => (
                  <span
                    key={i}
                    className="cover-letter"
                    style={{ '--d': depthOf(i, TITLE.length).toFixed(3) } as React.CSSProperties}
                  >
                    <span
                      className="cover-letter-face cover-title"
                      style={{ animationDelay: `${0.6 + i * 0.07}s, ${i * 0.35}s` }}
                    >
                      {ch}
                    </span>
                  </span>
                ))}
              </span>
              <span
                className="cover-subtitle cover-rise mt-3 flex items-center justify-center gap-2 sm:gap-5 whitespace-nowrap text-[clamp(0.75rem,3.8vw,1.875rem)] tracking-[0.18em] sm:tracking-[0.35em] text-cyan-100"
                style={{ animationDelay: '1.4s' }}
              >
                <span className="hidden sm:block h-px w-16 bg-gradient-to-r from-transparent to-cyan-300" />
                {SUBTITLE}
                <span className="hidden sm:block h-px w-16 bg-gradient-to-l from-transparent to-cyan-300" />
              </span>
            </span>
          </h1>

          <div className="cover-rise mt-8 sm:mt-12 w-full max-w-xs sm:max-w-none flex flex-col items-center gap-3" style={{ animationDelay: '1.8s' }}>
            <p className="cover-blink font-mono text-[10px] sm:text-xs uppercase tracking-[0.3em] sm:tracking-[0.4em] text-slate-200">
              {ci.chooseMission}
            </p>
            <div className="w-full sm:w-auto flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
              {(['luna', 'marte'] as const).map((slug) => {
                const missionName = slug === 'luna' ? t.common.moon : t.common.mars;
                const tagline = slug === 'luna' ? ci.moonTagline : ci.marsTagline;
                const Icon = slug === 'luna' ? Moon : Orbit;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => go(slug)}
                    disabled={!!leaving}
                    aria-label={ci.enterMissionAria(missionName, tagline)}
                    className={`cover-mission group min-h-[48px] inline-flex items-center justify-center gap-2.5 rounded-full border px-5 py-2.5 text-sm font-display font-bold tracking-wider backdrop-blur-md transition cursor-pointer disabled:cursor-default ${
                      slug === 'marte'
                        ? 'border-orange-300/50 bg-orange-500/10 text-orange-100 hover:bg-orange-500/25 hover:border-orange-200'
                        : 'border-slate-200/50 bg-white/5 text-slate-100 hover:bg-white/15 hover:border-white'
                    } ${leaving === slug ? 'scale-110' : ''}`}
                  >
                    <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:rotate-12" aria-hidden />
                    <span>{ci.missionPrefix} {missionName.toUpperCase()}</span>
                    <span className="hidden sm:inline font-mono font-normal text-[10px] tracking-normal opacity-70">
                      {tagline}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      <p className="absolute bottom-3 inset-x-0 text-center font-mono text-[10px] text-slate-400/70 px-4">
        {ci.credit}
      </p>
    </main>
  );
}

export default CoverPage;
