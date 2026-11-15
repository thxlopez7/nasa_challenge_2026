'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  Gauge,
  Radiation,
  Satellite,
  ShieldCheck,
  Wind,
} from 'lucide-react';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import type { AlertSeverity } from '../../types/telemetry';
import { RIDGE_THRESHOLDS as T, getAlertSeverity } from '../../utils/clinicalEngine';
import Starfield from './Starfield';

const SEEN_KEY = 'exovitals-intro-seen';
const EXIT_MS = 900;

/* ---- ¿Ya vio la portada en esta sesión? (sin setState en efectos) ---- */

const noopSubscribe = () => () => {};
function readSeen(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has('intro')) return false;
    return window.sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */

const STATUS: Record<AlertSeverity, { label: string; dot: string; text: string }> = {
  OPTIMAL: { label: 'Tripulación estable', dot: 'bg-cyan-400', text: 'text-cyan-300' },
  WARNING: { label: 'Alerta clínica activa', dot: 'bg-amber-400', text: 'text-amber-300' },
  CRITICAL: { label: 'Code Red', dot: 'bg-red-500', text: 'text-red-300' },
};

/** Trazo de ECG: 4 latidos a lo ancho, al ritmo de la frecuencia cardíaca real. */
function HeartTrace({ heartRate }: { heartRate: number }) {
  const beat = (x: number) =>
    `L${x},50 L${x + 12},50 L${x + 16},44 L${x + 20},50 L${x + 26},50 L${x + 29},58 L${x + 33},12 L${x + 37},70 L${x + 41},50 L${x + 52},50 L${x + 60},40 L${x + 70},50`;
  const d = `M0,50 ${[30, 130, 230, 330].map(beat).join(' ')} L400,50`;
  const seconds = (4 * 60) / Math.max(30, heartRate || 72);

  return (
    <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="h-14 w-full" aria-hidden>
      <path d={d} fill="none" stroke="#0e7490" strokeWidth="1.5" opacity="0.5" />
      <path
        d={d}
        fill="none"
        stroke="#22d3ee"
        strokeWidth="2"
        strokeLinejoin="round"
        pathLength={100}
        className="landing-ecg"
        style={{ animationDuration: `${seconds}s` }}
      />
    </svg>
  );
}

function LiveStrip() {
  const t = useTelemetryStore();
  const severity = getAlertSeverity(t);
  const st = STATUS[severity];
  const items = [
    { label: 'FC', value: `${t.heartRate}`, unit: 'bpm' },
    { label: 'SpO2', value: `${t.spO2}`, unit: '%' },
    { label: 'CO2', value: `${t.co2Level}`, unit: 'ppm' },
    { label: 'Radiación', value: `${t.radiationRate}`, unit: 'µSv/h' },
  ];

  return (
    <div className="w-full max-w-xl rounded-2xl border border-cyan-500/20 bg-slate-950/60 backdrop-blur-md p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider sm:tracking-widest">
        <span className="text-slate-400 whitespace-nowrap">Telemetría en vivo · 1 Hz</span>
        <span className={`inline-flex items-center gap-2 whitespace-nowrap ${st.text}`}>
          <span className={`h-2 w-2 rounded-full ${st.dot} animate-pulse`} />
          {st.label}
        </span>
      </div>
      <HeartTrace heartRate={t.heartRate} />
      <dl className="grid grid-cols-4 gap-2 font-mono">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="text-[10px] uppercase text-slate-500">{i.label}</dt>
            <dd className="text-base sm:text-lg font-bold text-slate-100 tabular-nums">
              {i.value}
              <span className="ml-1 text-[10px] font-normal text-slate-500">{i.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const FACTS = [
  {
    value: 'hasta 22 min',
    label: 'tarda un mensaje en llegar de Marte a la Tierra',
    detail: 'Una consulta y su respuesta pueden tardar más de 40 minutos: la tripulación necesita decidir a bordo.',
    source: 'NASA · retraso de la luz Tierra–Marte',
  },
  {
    value: '1–1,5 %',
    label: 'de masa ósea perdida al mes en microgravedad',
    detail: 'El calcio liberado del hueso sobrecarga el riñón y favorece cálculos renales.',
    source: 'NASA Human Research Program',
  },
  {
    value: '≈ 0,66 Sv',
    label: 'de radiación solo en el viaje de ida y vuelta a Marte',
    detail: 'La medida del detector RAD de Curiosity; deprime el sistema inmunitario.',
    source: 'Zeitlin et al., Science 2013',
  },
];

const FLOW = [
  {
    icon: Satellite,
    title: 'Sensores',
    text: 'Biomarcadores (cistatina C, linfocitos, SpO2…) y entorno (CO2, radiación) llegan cada segundo.',
  },
  {
    icon: Gauge,
    title: 'Motor RIDGE',
    text: 'Cruza cuerpo y entorno con reglas clínicas explicables, sin depender de la conexión con la Tierra.',
  },
  {
    icon: BrainCircuit,
    title: 'Copiloto médico',
    text: 'Una IA de triaje traduce los síntomas en pasos claros para la tripulación.',
  },
  {
    icon: Activity,
    title: 'Centro de misión',
    text: 'Evaluación diaria, contramedidas, calendario y tendencias del cuerpo durante toda la misión.',
  },
];

const RULES = [
  {
    icon: ShieldCheck,
    code: 'R1',
    title: 'Nefropatía oculta',
    text: 'La creatinina sigue normal, pero la cistatina C y el calcio suben: el riñón sufre antes de que lo diga el análisis clásico.',
    rule: `Cr ≤ ${T.renal.maxCreatinina} · CisC > ${T.renal.minCistatinaC} · Ca²⁺ > ${T.renal.minCalcioIonico}`,
  },
  {
    icon: Radiation,
    code: 'R2',
    title: 'Inmunosupresión por radiación',
    text: 'Una tormenta solar coincide con linfocitos bajos y un ratio neutrófilos/linfocitos alto.',
    rule: `Rad > ${T.radiation.minRadiationRate} µSv/h · Linf < ${T.radiation.maxLinfocitos} · NLR > ${T.radiation.minNlr}`,
  },
  {
    icon: Wind,
    code: 'R3',
    title: 'Bolsillo de CO2',
    text: 'Sin convección, el CO2 se acumula junto a la cabeza. La SpO2 normal no lo delata: RIDGE sí.',
    rule: `CO2 > ${T.co2.minCo2Level} ppm · SpO2 ≥ ${T.co2.minSpO2} %`,
  },
];

/* ------------------------------------------------------------------ */

/**
 * Portada de ExoVitals. Se muestra sobre el panel al abrir la app (una vez
 * por sesión del navegador; `?intro` la fuerza) y desaparece con un salto
 * a velocidad warp al entrar.
 */
export function Landing() {
  const seen = useSyncExternalStore(noopSubscribe, readSeen, () => false);
  const [phase, setPhase] = useState<'show' | 'leaving' | 'gone'>('show');
  const scroller = useRef<HTMLDivElement>(null);
  const visible = !seen && phase !== 'gone';

  const enter = useCallback(() => {
    setPhase((p) => (p === 'show' ? 'leaving' : p));
    try {
      window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* almacenamiento no disponible: no pasa nada */
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => setPhase('gone'), reduced ? 0 : EXIT_MS);
  }, []);

  // Bloquea el scroll del panel mientras la portada está encima.
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') enter();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [visible, enter]);

  if (!visible) return null;

  const leaving = phase === 'leaving';
  const scrollTo = (id: string) =>
    scroller.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div
      ref={scroller}
      role="dialog"
      aria-modal="true"
      aria-label="Portada de ExoVitals"
      className={`landing fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden bg-slate-950 text-slate-100 font-sans ${
        leaving ? 'landing-leave' : 'landing-enter'
      }`}
    >
      <div className="fixed inset-0">
        <Starfield warp={leaving} />
        <div className="landing-planet" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(8,145,178,0.18),transparent_60%)]" aria-hidden />
      </div>

      {/* ---------------- Hero ---------------- */}
      <section className="relative min-h-[100svh] flex flex-col">
        <header className="relative z-10 flex items-center justify-between px-5 sm:px-10 py-5 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
            ExoVitals
          </span>
          <span className="hidden sm:inline">NASA Space Apps Challenge 2026</span>
          <button
            type="button"
            onClick={enter}
            className="normal-case tracking-normal text-xs text-slate-400 hover:text-cyan-300 transition cursor-pointer"
          >
            Saltar portada (Esc)
          </button>
        </header>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5 gap-7 pb-16">
          <p className="landing-rise font-mono text-xs uppercase tracking-[0.35em] text-cyan-400" style={{ animationDelay: '0.1s' }}>
            Medicina de vuelo autónoma
          </p>
          <h1
            className="landing-rise text-6xl sm:text-8xl lg:text-9xl font-black tracking-tighter leading-none bg-gradient-to-b from-white via-cyan-100 to-cyan-500 bg-clip-text text-transparent"
            style={{ animationDelay: '0.25s' }}
          >
            ExoVitals
          </h1>
          <p className="landing-rise max-w-2xl text-lg sm:text-2xl text-slate-300 leading-snug" style={{ animationDelay: '0.45s' }}>
            El médico de a bordo para misiones en las que un mensaje a la Tierra tarda{' '}
            <span className="text-cyan-300 font-semibold">hasta 22 minutos</span>.
          </p>

          <div className="landing-rise w-full flex justify-center" style={{ animationDelay: '0.65s' }}>
            <LiveStrip />
          </div>

          <div className="landing-rise flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '0.85s' }}>
            <button
              type="button"
              onClick={enter}
              autoFocus
              className="group inline-flex items-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 text-base font-bold text-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.45)] hover:bg-cyan-300 hover:shadow-[0_0_60px_rgba(34,211,238,0.65)] transition cursor-pointer"
            >
              Entrar al centro de mando
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => scrollTo('como-funciona')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-950/40 px-6 py-3.5 text-base font-semibold text-slate-200 hover:border-cyan-400 hover:text-cyan-200 transition cursor-pointer"
            >
              Cómo funciona
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollTo('el-reto')}
          className="relative z-10 mx-auto mb-6 text-slate-500 hover:text-cyan-300 transition cursor-pointer"
          aria-label="Bajar a la siguiente sección"
        >
          <ChevronDown className="h-7 w-7 animate-bounce" />
        </button>
      </section>

      {/* ---------------- El reto ---------------- */}
      <section id="el-reto" className="relative z-10 px-5 sm:px-10 py-24 bg-gradient-to-b from-transparent via-slate-950/85 to-slate-950">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-400">El reto</p>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
              Lejos de la Tierra, el cuerpo cambia más rápido de lo que llegan las respuestas.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {FACTS.map((f) => (
              <article key={f.value} className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur p-6 space-y-3 hover:border-cyan-500/40 transition">
                <p className="text-4xl sm:text-5xl font-black tracking-tight text-cyan-300 tabular-nums">{f.value}</p>
                <p className="text-base font-semibold text-slate-100">{f.label}</p>
                <p className="text-sm text-slate-400">{f.detail}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{f.source}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Cómo funciona ---------------- */}
      <section id="como-funciona" className="relative z-10 px-5 sm:px-10 py-24 bg-slate-950">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-400">Cómo funciona</p>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
              De la señal al diagnóstico, todo a bordo.
            </h2>
          </div>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FLOW.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-cyan-300" aria-hidden />
                  </span>
                  <span className="font-mono text-xs text-slate-600">0{i + 1}</span>
                </div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="text-sm text-slate-400">{text}</p>
                {i < FLOW.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute -right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500/60" aria-hidden />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- RIDGE ---------------- */}
      <section className="relative z-10 px-5 sm:px-10 py-24 bg-slate-950">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-400">Motor clínico RIDGE</p>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
              Tres riesgos silenciosos que un análisis aislado no ve.
            </h2>
            <p className="text-slate-400">
              Cada regla cruza un biomarcador con el entorno de la nave. Son explicables: la
              tripulación sabe siempre por qué salta una alerta.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {RULES.map(({ icon: Icon, code, title, text, rule }) => (
              <article key={code} className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-amber-300" aria-hidden />
                  </span>
                  <div>
                    <p className="font-mono text-xs text-amber-400">{code}</p>
                    <h3 className="text-lg font-bold leading-tight">{title}</h3>
                  </div>
                </div>
                <p className="text-sm text-slate-300">{text}</p>
                <p className="font-mono text-xs text-slate-500 border-t border-slate-800 pt-3">{rule}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Cierre ---------------- */}
      <section className="relative z-10 px-5 sm:px-10 py-28 bg-gradient-to-b from-slate-950 to-cyan-950/40 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">La tripulación te espera.</h2>
          <p className="text-slate-400">
            Prueba el panel en vivo: provoca una tormenta solar o una fuga de CO2 desde el God
            Mode y mira cómo responde RIDGE.
          </p>
          <button
            type="button"
            onClick={enter}
            className="group inline-flex items-center gap-2 rounded-full bg-cyan-400 px-8 py-4 text-lg font-bold text-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.45)] hover:bg-cyan-300 transition cursor-pointer"
          >
            Entrar al centro de mando
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
          </button>
        </div>
        <footer className="mt-24 font-mono text-[11px] uppercase tracking-widest text-slate-600">
          ExoVitals · NASA Space Apps Challenge 2026 · Prototipo de investigación, no es un dispositivo médico
        </footer>
      </section>
    </div>
  );
}

export default Landing;
