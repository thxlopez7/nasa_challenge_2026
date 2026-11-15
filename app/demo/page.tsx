'use client';

import { Suspense, use, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bone,
  CheckCircle2,
  Compass,
  FileText,
  Moon,
  Orbit,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  WifiOff,
  Wind,
  Zap,
} from 'lucide-react';
import AppNav from '../../components/AppNav';
import OutboxPanel from '../../components/OutboxPanel';
import RuleTrace from '../../components/RuleTrace';
import RulesAndLimitationsSection from '../../components/RulesAndLimitationsSection';
import SbarReportModal from '../../components/SbarReportModal';
import TodayCountermeasures from '../../components/mission/TodayCountermeasures';
import { formatOneWayLatency } from '../../config/missionComms';
import { useT } from '../../i18n/I18nContext';
import { useClinicalSnapshot } from '../../store/selectors';
import { useOutboxStore } from '../../store/useOutboxStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import type { SimulationScenario } from '../../types/telemetry';
import { runLocalTriage } from '../../utils/localTriage';
import {
  parseMissionSlug,
  readChoice,
  saveChoice,
  type MissionSlug,
} from '../../utils/missionChoice';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
const noopSubscribe = () => () => {};

function DemoWithMission({ searchParams }: { searchParams: SearchParams }) {
  const fromUrl = parseMissionSlug(use(searchParams).mision);
  const saved = useSyncExternalStore(noopSubscribe, readChoice, () => undefined);
  return <GuidedDemoContent mision={fromUrl ?? saved ?? 'marte'} />;
}

const SCENARIO_BUTTONS: {
  id: SimulationScenario;
  es: string;
  en: string;
  tone: string;
}[] = [
  {
    id: 'RENAL_DAMAGE',
    es: 'Daño renal oculto (R1)',
    en: 'Masked Renal Risk (R1)',
    tone: 'border-amber-500/40 bg-amber-950/30 text-amber-200 hover:bg-amber-900/40',
  },
  {
    id: 'BONE_LOSS',
    es: 'Resorción ósea 0G (P6)',
    en: '0G Bone Resorption (P6)',
    tone: 'border-amber-500/40 bg-amber-950/30 text-amber-200 hover:bg-amber-900/40',
  },
  {
    id: 'CO2_LEAK',
    es: 'Fuga CO₂ subclínica (R3)',
    en: 'Subclinical CO₂ Leak (R3)',
    tone: 'border-orange-500/40 bg-orange-950/30 text-orange-200 hover:bg-orange-900/40',
  },
  {
    id: 'SOLAR_STORM',
    es: 'Tormenta solar GCR (R2)',
    en: 'Solar Storm GCR (R2)',
    tone: 'border-rose-500/40 bg-rose-950/30 text-rose-200 hover:bg-rose-900/40',
  },
  {
    id: 'CARDIO_DECONDITIONING',
    es: 'Decondicionamiento CV (P6)',
    en: 'Cardio Deconditioning (P6)',
    tone: 'border-sky-500/40 bg-sky-950/30 text-sky-200 hover:bg-sky-900/40',
  },
  {
    id: 'RESET',
    es: 'Restaurar nominal',
    en: 'Restore Nominal',
    tone: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-900/40',
  },
];

function GuidedDemoContent({ mision }: { mision: MissionSlug }) {
  const { lang } = useT();
  const snapshot = useClinicalSnapshot(mision);
  const simulateScenario = useTelemetryStore((s) => s.simulateScenario);
  const setSimulateOffline = useTelemetryStore((s) => s.setSimulateOffline);
  const triggerCodeRed = useTelemetryStore((s) => s.triggerCodeRed);
  const setSpeedup = useOutboxStore((s) => s.setSpeedup);
  const setConjunctionBlackout = useOutboxStore((s) => s.setConjunctionBlackout);
  const [sbarOpen, setSbarOpen] = useState(false);

  const es = lang === 'es';
  const localReport = useMemo(
    () =>
      runLocalTriage(
        {
          ...snapshot.biomarkers,
          ...snapshot.environment,
          ...snapshot.alerts,
          behavioralCheckIn: snapshot.behavioralCheckIn,
        },
        snapshot.ruleTraces,
        lang
      ),
    [snapshot, lang]
  );

  const triggeredCount = snapshot.ruleTraces.filter((r) => r.triggered).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AppNav mision={mision} />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-8">
        {/* Hero */}
        <header className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-cyan-200">
                <Compass className="h-3.5 w-3.5" aria-hidden />
                {es
                  ? 'NASA Space Apps Challenge 2026 · Recorrido guiado para jurados'
                  : 'NASA Space Apps Challenge 2026 · Judge Walkthrough'}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {es
                  ? 'ExoVitals: Del sensor autónomo al triaje determinista sin conexión'
                  : 'ExoVitals: Autonomous Crew Monitoring to Zero-Network Deterministic Triage'}
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                {es
                  ? 'Este recorrido de 6 pasos activa datos reales del store local para demostrar los 5 riesgos NASA HRP (RIDGE): distancia a la Tierra, microgravedad, ambiente cerrado, radiación e impacto conductual/aislamiento — sin asumir que el astronauta sea médico.'
                  : 'This 6-step walkthrough drives live local store state across all five NASA HRP RIDGE hazards — distance from Earth, gravity fields, hostile closed environments, radiation, and isolation — designed for non-physician flight crew.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                href={`/panel?mision=${mision}`}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-200 transition"
              >
                {es ? 'Abrir panel completo' : 'Open Full Panel'}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/test"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-xs text-slate-300 hover:border-slate-500 hover:text-white transition"
              >
                {es ? 'Consola QA /test' : 'QA Suite /test'}
              </Link>
            </div>
          </div>

          {/* Live Status Strip */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] text-slate-400">
                {es ? 'Estado global' : 'Global Severity'}
              </div>
              <div
                className={`mt-1 font-bold ${
                  snapshot.globalSeverity === 'CRITICAL'
                    ? 'text-rose-300'
                    : snapshot.globalSeverity === 'WARNING'
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                }`}
              >
                {snapshot.globalSeverity} ({triggeredCount}/8)
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] text-slate-400">
                {es ? 'Latencia luz (ida)' : 'One-Way Light Delay'}
              </div>
              <div className="mt-1 font-bold text-cyan-200">
                {formatOneWayLatency(snapshot.missionProfileId, lang)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] text-slate-400">
                {es ? 'Enlace IA / Tierra' : 'AI / Earth Link'}
              </div>
              <div
                className={`mt-1 font-bold ${
                  snapshot.simulateOffline ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {snapshot.simulateOffline
                  ? es
                    ? 'SIMULADO SIN RED'
                    : 'SIMULATED OFFLINE'
                  : es
                    ? 'CONECTADO (EDGE READY)'
                    : 'CONNECTED (EDGE READY)'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] text-slate-400">
                {es ? 'Escalamiento' : 'Escalation Level'}
              </div>
              <div className="mt-1 font-bold text-slate-100">{snapshot.escalationLevel}</div>
            </div>
          </div>
        </header>

        {/* Quick Scenario Ribbon */}
        <section
          aria-label={es ? 'Controles rápidos de escenario' : 'Quick scenario controls'}
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-slate-300">
              {es
                ? 'Inyector de eventos fisiológicos en vivo (afecta todos los pasos)'
                : 'Live Physiological Scenario Injector (drives all steps below)'}
            </span>
            <button
              type="button"
              onClick={triggerCodeRed}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-rose-500/60 bg-rose-950/60 px-3 py-2 font-mono text-xs font-semibold text-rose-200 hover:bg-rose-900/60 transition cursor-pointer"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {es ? 'Activar Código Rojo' : 'Trigger Code Red'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SCENARIO_BUTTONS.map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => simulateScenario(btn.id)}
                className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-xs font-medium transition cursor-pointer ${btn.tone}`}
              >
                {btn.id === 'RESET' && <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                {es ? btn.es : btn.en}
              </button>
            ))}
          </div>
        </section>

        {/* Step 1: Mission & Latency */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-cyan-300">
                {es ? 'Paso 1 · Distancia a la Tierra' : 'Step 1 · Distance from Earth'}
              </p>
              <h2 className="font-display text-xl font-bold text-white">
                {es
                  ? 'Latencia óptica y autonomía en órbita lunar vs Marte'
                  : 'Light-Time Delay & Autonomy: Artemis Moon vs Mars Transit'}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/demo?mision=luna"
                onClick={() => saveChoice('luna')}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-xs transition ${
                  mision === 'luna'
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                }`}
              >
                <Moon className="h-4 w-4" aria-hidden />
                {es ? 'Artemis Luna (~1.3 s)' : 'Artemis Moon (~1.3 s)'}
              </Link>
              <Link
                href="/demo?mision=marte"
                onClick={() => saveChoice('marte')}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-xs transition ${
                  mision === 'marte'
                    ? 'border-orange-400 bg-orange-500/15 text-orange-100'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                }`}
              >
                <Orbit className="h-4 w-4" aria-hidden />
                {es ? 'Tránsito a Marte (~20 min)' : 'Mars Transit (~20 min)'}
              </Link>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {es
              ? 'En la Luna la telemetría tarda ~1.3 s por trayecto; en Marte hasta ~20 minutos (40 min ida y vuelta) más apagones solares de conjunción. Por eso las reglas clínicas y protocolos críticos corren en milisegundos dentro del navegador sin depender de Houston ni de la nube.'
              : 'Lunar one-way delay is ~1.3 s; Mars deep-space transit reaches ~20 minutes each way (40 min round trip) plus solar-conjunction blackouts. Clinical alerts and triage must evaluate in under 1 ms locally before any cloud call.'}
          </p>
        </section>

        {/* Step 2: Microgravity Renal & Bone */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-amber-300">
                {es ? 'Paso 2 · Campos gravitatorios (0G)' : 'Step 2 · Gravity Fields (0G)'}
              </p>
              <h2 className="font-display text-xl font-bold text-white">
                {es
                  ? 'Nefropatía oculta por sarcopenia (R1) y resorción ósea sin DXA a bordo'
                  : 'Sarcopenia-Masked Renal Risk (R1) & Bone Turnover Without Onboard DXA'}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => simulateScenario('RENAL_DAMAGE')}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 font-mono text-xs text-amber-200 hover:bg-amber-900/40 cursor-pointer"
              >
                <Activity className="h-3.5 w-3.5" aria-hidden />
                {es ? 'Inyectar Daño Renal' : 'Inject Renal Damage'}
              </button>
              <button
                type="button"
                onClick={() => simulateScenario('BONE_LOSS')}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 font-mono text-xs text-amber-200 hover:bg-amber-900/40 cursor-pointer"
              >
                <Bone className="h-3.5 w-3.5" aria-hidden />
                {es ? 'Inyectar Resorción Ósea' : 'Inject Bone Loss'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">{es ? 'Cistatina C' : 'Cystatin C'}</div>
              <div className="mt-1 text-base font-bold text-white">
                {snapshot.biomarkers.cistatinaC.toFixed(2)} mg/L
              </div>
              <div className="text-[11px] text-slate-400">
                {es ? 'Cr:' : 'Cr:'} {snapshot.biomarkers.creatinina.toFixed(2)} mg/dL ·{' '}
                {es ? 'Razón' : 'Ratio'} {snapshot.cisCRatio.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">{es ? 'Calcio iónico' : 'Ionized Ca²⁺'}</div>
              <div className="mt-1 text-base font-bold text-white">
                {snapshot.biomarkers.calcioIonico.toFixed(2)} mmol/L
              </div>
              <div className="text-[11px] text-slate-400">
                {es ? 'Umbral prototipo > 1.32' : 'Prototype > 1.32 mmol/L'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">CTX/NTX · P1NP</div>
              <div className="mt-1 text-base font-bold text-white">
                {(snapshot.biomarkers.ctxNtxIndex ?? 1).toFixed(2)}x ·{' '}
                {(snapshot.biomarkers.p1npIndex ?? 1).toFixed(2)}x
              </div>
              <div className="text-[11px] text-amber-300/90">
                {es ? 'DXA: no disponible a bordo' : 'DXA: unavailable onboard'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">{es ? 'Carga ARED · ΔFC' : 'ARED Load · ΔHR'}</div>
              <div className="mt-1 text-base font-bold text-white">
                {Math.round(snapshot.biomarkers.aredLoadPct ?? 100)}% · +
                {Math.round(snapshot.biomarkers.orthostaticDeltaHr ?? 10)} bpm
              </div>
              <div className="text-[11px] text-slate-400">
                RMSSD {Math.round(snapshot.biomarkers.hrvRmssdMs ?? 45)} ms
              </div>
            </div>
          </div>
        </section>

        {/* Step 3: Subclinical CO2 + RuleTrace */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-orange-300">
                {es
                  ? 'Paso 3 · Ambiente cerrado hostil y explicabilidad'
                  : 'Step 3 · Hostile Closed Environment & Rule Explainability'}
              </p>
              <h2 className="font-display text-xl font-bold text-white">
                {es
                  ? 'Hipercapnia subclínica (R3: 3500 ppm prototipo) con SpO₂ normal y trazabilidad'
                  : 'Subclinical CO₂ (R3: 3500 ppm Prototype) with Normal SpO₂ & Live Rule Trace'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => simulateScenario('CO2_LEAK')}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-950/40 px-4 py-2 font-mono text-xs text-orange-200 hover:bg-orange-900/40 cursor-pointer"
            >
              <Wind className="h-3.5 w-3.5" aria-hidden />
              {es ? 'Simular Fuga CO₂ (> 3500 ppm)' : 'Simulate CO₂ Leak (> 3500 ppm)'}
            </button>
          </div>
          <p className="text-sm text-slate-300">
            {es
              ? 'Un tripulante puede sufrir deterioro cognitivo por acumulación local de CO₂ antes de que baje la SpO₂. Expande cualquier regla para ver criterio, valor real, diferencial clínico y fuente:'
              : 'Localized CO₂ pockets degrade cognition before arterial SpO₂ drops. Expand any rule below to inspect live values, prototype vs NASA operational thresholds (4–5.3 mmHg), differentials, and sources:'}
          </p>
          <RuleTrace traces={snapshot.ruleTraces} />
        </section>

        {/* Step 4: Solar Storm GCR */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-rose-300">
                {es ? 'Paso 4 · Radiación espacial (GCR/SPE)' : 'Step 4 · Space Radiation (GCR/SPE)'}
              </p>
              <h2 className="font-display text-xl font-bold text-white">
                {es
                  ? 'Inmunosupresión por radiación (R2: NLR > 3.5 + Linfopenia) y diagnóstico diferencial'
                  : 'Radiation Immunosuppression (R2: NLR > 3.5 + Lymphopenia) & Differential Context'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => simulateScenario('SOLAR_STORM')}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-2 font-mono text-xs text-rose-200 hover:bg-rose-900/40 cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" aria-hidden />
              {es ? 'Simular Tormenta Solar' : 'Simulate Solar Storm'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">NLR (Neutr./Linf.)</div>
              <div className="mt-1 text-base font-bold text-white">
                {snapshot.nlr.toFixed(2)} ({es ? 'Linf:' : 'Lymph:'}{' '}
                {Math.round(snapshot.biomarkers.linfocitos)}/µL)
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">
                {es ? 'Tasa / Acumulada' : 'Rate / Accumulated'}
              </div>
              <div className="mt-1 text-base font-bold text-white">
                {snapshot.environment.radiationRate.toFixed(1)} µSv/h ·{' '}
                {snapshot.environment.radiationAccumulated.toFixed(1)} mSv
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-slate-400">{es ? 'Cortisol' : 'Cortisol'}</div>
              <div className="mt-1 text-base font-bold text-white">
                {snapshot.biomarkers.cortisol.toFixed(1)} ng/mL
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {es
              ? 'Nota diferencial: un NLR alto también ocurre en infección aguda o respuesta a cortisol/estrés; R2 evita falsas alarmas exigiendo confirmación hematológica junto con el flujo de radiación.'
              : 'Differential note: elevated NLR also occurs in acute infection or glucocorticoid stress; R2 pairs hematologic shift with ionizing exposure context rather than treating NLR in isolation.'}
          </p>
        </section>

        {/* Step 5: Link Loss, Deterministic Local Triage, SBAR & Earth Outbox */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-cyan-300">
                {es
                  ? 'Paso 5 · Operación 100% sin red + Bandeja Tierra (Outbox)'
                  : 'Step 5 · Zero-Network Local Triage + Earth Outbox & SBAR'}
              </p>
              <h2 className="font-display text-xl font-bold text-white">
                {es
                  ? 'Triaje determinista local (< 1 ms), reporte SBAR de 1 página y latencia ×600'
                  : 'Sub-millisecond Local Triage, 1-Page Printable SBAR & ×600 Time Warp'}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSimulateOffline(!snapshot.simulateOffline)}
                className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-xs transition cursor-pointer ${
                  snapshot.simulateOffline
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                }`}
              >
                <WifiOff className="h-3.5 w-3.5" aria-hidden />
                {snapshot.simulateOffline
                  ? es
                    ? 'Restaurar enlace IA'
                    : 'Restore AI Link'
                  : es
                    ? 'Simular pérdida total de enlace'
                    : 'Simulate Full Link Loss'}
              </button>

              <button
                type="button"
                onClick={() => setSpeedup(600)}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-2 font-mono text-xs text-cyan-200 hover:bg-cyan-900/40 cursor-pointer"
              >
                <Radio className="h-3.5 w-3.5" aria-hidden />
                {es ? 'Outbox ×600 (20 min en 2 s)' : 'Outbox ×600 (20 min in 2 s)'}
              </button>

              <button
                type="button"
                onClick={() => setConjunctionBlackout(false)}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300 hover:border-slate-500 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {es ? 'Asegurar ventana sin conjunción' : 'Clear Conjunction Hold'}
              </button>

              <button
                type="button"
                onClick={() => setSbarOpen(true)}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 font-mono text-xs text-emerald-200 hover:bg-emerald-900/40 cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {es ? 'Abrir SBAR (JSON / PDF)' : 'Open SBAR (JSON / PDF)'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <ShieldAlert className="h-4 w-4 text-cyan-300" aria-hidden />
              <span className="font-semibold text-cyan-200">
                {es
                  ? 'Motor determinista local activo (no depende de Gemini):'
                  : 'Deterministic Local Triage Engine (zero network dependency):'}
              </span>
              <span className="text-slate-300">{localReport.headline}</span>
            </div>
            <ul className="list-disc pl-5 text-xs text-slate-300 space-y-1">
              {localReport.immediateSteps.slice(0, 4).map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
            <p className="pt-1 text-[11px] font-mono text-slate-400">
              {es
                ? 'Nota: La IA (/api/triage) solo actúa como copiloto auxiliar etiquetado "Sugerencia de IA, no es una alerta". Privacidad: el check-in psicológico permanece local salvo opt-in explícito.'
                : 'Note: Gemini (/api/triage) is strictly advisory ("AI suggestion, not an alert"). Privacy: psychological check-in stays local onboard unless explicitly opted in.'}
            </p>
          </div>

          <OutboxPanel mision={mision} />
        </section>

        {/* Step 6: Daily Countermeasures + Rules Matrix */}
        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-300" aria-hidden />
              <p className="font-mono text-[11px] uppercase tracking-wider text-emerald-300">
                {es
                  ? 'Paso 6 · Contramedidas adaptativas, hábitos y transparencia científica'
                  : 'Step 6 · Adaptive Countermeasures, Habits & Evidence Matrix'}
              </p>
            </div>
            <TodayCountermeasures mision={mision} />
          </div>

          <RulesAndLimitationsSection />
        </section>
      </main>

      <SbarReportModal open={sbarOpen} onClose={() => setSbarOpen(false)} mision={mision} />
    </div>
  );
}

export default function DemoPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <DemoWithMission searchParams={searchParams} />
    </Suspense>
  );
}
