'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertOctagon, CheckCircle2, Download, Radio, Satellite, ShieldAlert, X } from 'lucide-react';
import { useScenarioStore } from '../../store/useScenarioStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import type { CrewProfile } from '../../types/profile';
import type { TelemetryData } from '../../types/telemetry';
import { MISSION_CHOICES, type MissionSlug } from '../../utils/missionChoice';
import {
  GROUND_RECOMMENDATIONS,
  SCENARIO_EVENTS,
  SIGNAL_DELAY_S,
  isLifeThreatening,
  presumptiveDiagnosis,
  type PresumptiveFinding,
} from '../../utils/scenarios';
import CrewAvatar from '../profile/CrewAvatar';

/** Segundos que se espera a que el tripulante confirme que está consciente. */
const CHECK_SECONDS = 15;
const HISTORY = 180;

type Phase = 'idle' | 'checking' | 'sending' | 'sent';

function snapshot(): TelemetryData {
  const s = useTelemetryStore.getState();
  return {
    heartRate: s.heartRate, spO2: s.spO2, cistatinaC: s.cistatinaC, creatinina: s.creatinina,
    calcioIonico: s.calcioIonico, linfocitos: s.linfocitos, neutrofilos: s.neutrofilos,
    cortisol: s.cortisol, co2Level: s.co2Level, radiationRate: s.radiationRate,
    radiationAccumulated: s.radiationAccumulated, isEmergency: s.isEmergency,
    isRenalWarning: s.isRenalWarning, isRadiationWarning: s.isRadiationWarning, isCo2Warning: s.isCo2Warning,
  };
}

interface EarthReport {
  id: string;
  generatedAt: string;
  trigger: string;
  crew: CrewProfile;
  mission: string;
  voiceLink: string;
  vitals: TelemetryData;
  trend: { metric: string; first: number; last: number; min: number; max: number; unit: string }[];
  ridge: { r1: boolean; r2: boolean; r3: boolean; codeRed: boolean };
  diagnosis: PresumptiveFinding[];
  recommendations: string[];
  timeline: { at: number; title: string }[];
  readings: number;
}

function buildReport(crew: CrewProfile, mision: MissionSlug | undefined, history: TelemetryData[], trigger: string): EarthReport {
  const v = history[history.length - 1] ?? snapshot();
  const series = (k: keyof TelemetryData) => history.map((h) => Number(h[k]));
  const trendOf = (k: keyof TelemetryData, metric: string, unit: string) => {
    const xs = series(k);
    return { metric, unit, first: xs[0], last: xs[xs.length - 1], min: Math.min(...xs), max: Math.max(...xs) };
  };
  const elapsed = useScenarioStore.getState().elapsed;
  const events = crew.scenario === 'live' ? [] : SCENARIO_EVENTS[crew.scenario].filter((e) => e.at <= elapsed);
  return {
    id: `EXV-${Date.now().toString(36).toUpperCase()}`,
    generatedAt: new Date().toISOString(),
    trigger,
    crew,
    mission: mision ? `Misión ${MISSION_CHOICES[mision].label} · ${MISSION_CHOICES[mision].tagline}` : 'Sin misión seleccionada',
    voiceLink: 'Sin respuesta del tripulante: la alerta se generó y envió de forma autónoma.',
    vitals: v,
    trend: [
      trendOf('heartRate', 'Frecuencia cardíaca', 'lpm'),
      trendOf('spO2', 'SpO2', '%'),
      trendOf('co2Level', 'CO2 del módulo', 'ppm'),
      trendOf('linfocitos', 'Linfocitos', 'cél/µL'),
      trendOf('cistatinaC', 'Cistatina C', 'mg/L'),
      trendOf('radiationRate', 'Radiación', 'µSv/h'),
    ],
    ridge: { r1: v.isRenalWarning, r2: v.isRadiationWarning, r3: v.isCo2Warning, codeRed: v.isEmergency },
    diagnosis: presumptiveDiagnosis(v),
    recommendations: GROUND_RECOMMENDATIONS,
    timeline: events.map((e) => ({ at: e.at, title: e.title })),
    readings: history.length,
  };
}

function formatDelay(s: number): string {
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m} min ${r} s`;
}

/* ------------------------------------------------------------------ */

const STEPS = [
  { icon: ShieldAlert, text: 'Empaquetando signos vitales, tendencias y diagnóstico' },
  { icon: Radio, text: 'Cifrando y priorizando como emergencia médica' },
  { icon: Satellite, text: 'Transmitiendo por la Red de Espacio Profundo (DSN)' },
  { icon: CheckCircle2, text: 'Recibido en Control de Misión · cirujano de vuelo avisado' },
];

/**
 * Vigila la telemetría del tripulante. Si las lecturas ponen en riesgo su
 * vida y no responde a la comprobación de consciencia, genera una alerta
 * con todos los datos y un diagnóstico presuntivo, y la envía a Tierra sola.
 */
export function EarthAlert({ profile, mision }: { profile: CrewProfile; mision?: MissionSlug }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [left, setLeft] = useState(CHECK_SECONDS);
  const [stepIdx, setStepIdx] = useState(0);
  const [report, setReport] = useState<EarthReport | null>(null);
  const [open, setOpen] = useState(true);
  const history = useRef<TelemetryData[]>([]);
  const cooldownUntil = useRef(0);
  const phaseRef = useRef<Phase>('idle');

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  function send(trigger: string) {
    setReport(buildReport(profile, mision, history.current, trigger));
    setStepIdx(0);
    setOpen(true);
    go('sending');
  }
  // La cuenta atrás llama a la versión actual de `send` (perfil y misión al día).
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  // Guarda el historial y detecta la crisis en cada lectura.
  useEffect(() => {
    history.current = [snapshot()];
    return useTelemetryStore.subscribe(() => {
      const v = snapshot();
      history.current = [...history.current.slice(-(HISTORY - 1)), v];
      if (phaseRef.current === 'idle' && Date.now() > cooldownUntil.current && isLifeThreatening(v)) {
        setLeft(CHECK_SECONDS);
        go('checking');
      }
    });
  }, []);

  // Cuenta atrás de la comprobación de consciencia.
  useEffect(() => {
    if (phase !== 'checking') return;
    const deadline = Date.now() + CHECK_SECONDS * 1000;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(id);
        sendRef.current('Sin respuesta del tripulante tras la comprobación de consciencia');
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase]);

  // Animación de la transmisión.
  useEffect(() => {
    if (phase !== 'sending') return;
    const id = window.setInterval(() => {
      setStepIdx((i) => {
        if (i >= STEPS.length - 1) {
          window.clearInterval(id);
          go('sent');
          return i;
        }
        return i + 1;
      });
    }, 1300);
    return () => window.clearInterval(id);
  }, [phase]);


  const confirmConscious = () => {
    cooldownUntil.current = Date.now() + 60_000;
    go('idle');
  };

  const download = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}-alerta-medica.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const delay = SIGNAL_DELAY_S[mision ?? 'luna'];

  /* ---------- Comprobación de consciencia ---------- */
  if (phase === 'checking') {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-red-950/80 backdrop-blur-sm p-4" role="alertdialog" aria-modal="true" aria-labelledby="check-title">
        <div className="earth-pulse w-full max-w-lg rounded-2xl border-2 border-red-500 bg-slate-950 p-6 text-center space-y-5 shadow-[0_0_80px_rgba(239,68,68,0.45)]">
          <AlertOctagon className="mx-auto h-12 w-12 text-red-400" aria-hidden />
          <div className="space-y-2">
            <h2 id="check-title" className="text-3xl font-black uppercase text-white">Situación crítica detectada</h2>
            <p className="font-lead text-lg text-slate-200">
              {profile.name}, ¿estás consciente? Si no respondes, ExoVitals enviará una alerta médica a Tierra con todos tus datos.
            </p>
          </div>
          <p className="text-6xl font-thin tabular-nums text-red-300" aria-live="assertive">{left}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={confirmConscious} className="rounded-lg bg-white px-6 py-3 text-base font-black uppercase tracking-wider text-black hover:bg-slate-200 transition cursor-pointer">
              Estoy consciente
            </button>
            <button type="button" onClick={() => send('Enviada manualmente por el tripulante')} className="rounded-lg border border-red-400 px-6 py-3 text-base font-black uppercase tracking-wider text-red-200 hover:bg-red-500/20 transition cursor-pointer">
              Enviar alerta ya
            </button>
          </div>
        </div>
      </div>
    );
  }

  if ((phase !== 'sending' && phase !== 'sent') || !report) return null;

  /* ---------- Chip minimizado ---------- */
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[140] inline-flex items-center gap-2 rounded-full border border-red-400 bg-red-600 px-4 py-2 text-sm font-black uppercase tracking-wider text-white shadow-lg hover:bg-red-500 transition cursor-pointer"
      >
        <Satellite className="h-4 w-4" aria-hidden /> Alerta enviada a Tierra
      </button>
    );
  }

  const v = report.vitals;
  const sent = phase === 'sent';

  /* ---------- Informe enviado ---------- */
  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="earth-title">
      <div className="mx-auto my-6 w-full max-w-4xl rounded-2xl border border-red-500/70 bg-slate-950 text-slate-100 shadow-[0_0_60px_rgba(239,68,68,0.35)]">
        <header className="flex items-start justify-between gap-4 border-b border-red-500/40 bg-red-600/15 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-300">Alerta automática · {report.id}</p>
            <h2 id="earth-title" className="mt-1 text-2xl sm:text-3xl font-black uppercase text-white">
              {sent ? 'Alerta médica enviada a Tierra' : 'Enviando alerta médica a Tierra…'}
            </h2>
            <p className="text-sm text-slate-300 mt-1">{report.trigger}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Minimizar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="space-y-6 p-5">
          {/* Transmisión */}
          <ol className="grid gap-2 sm:grid-cols-4" aria-label="Estado de la transmisión">
            {STEPS.map(({ icon: Icon, text }, i) => {
              const done = sent || i < stepIdx;
              const active = !sent && i === stepIdx;
              return (
                <li key={text} className={`rounded-lg border p-3 text-xs ${done ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100' : active ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100 animate-pulse' : 'border-slate-800 text-slate-500'}`}>
                  <Icon className="mb-1 h-4 w-4" aria-hidden />
                  {text}
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-slate-400">
            Retraso de la señal hasta la Tierra: <span className="text-slate-200">{formatDelay(delay)}</span>
            {delay > 60 && ' (la demo acelera la transmisión)'} · Enlace de voz: {report.voiceLink}
          </p>

          {/* Tripulante */}
          <section className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <CrewAvatar profile={report.crew} className="h-16 w-16 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black">{report.crew.name} · <span className="font-normal">{report.crew.role}</span></p>
              <p className="text-sm text-slate-400">{report.mission}</p>
            </div>
            <dl className="grid grid-cols-3 gap-x-5 gap-y-1 text-sm">
              <dt className="text-slate-500">Edad</dt><dt className="text-slate-500">Grupo</dt><dt className="text-slate-500">Alergias</dt>
              <dd>{report.crew.age} años</dd><dd className="font-black text-red-300">{report.crew.bloodType}</dd><dd>{report.crew.allergies}</dd>
            </dl>
          </section>

          {/* Signos vitales */}
          <section className="space-y-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">Signos vitales al enviar</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['FC', `${v.heartRate} lpm`, v.heartRate > 120],
                ['SpO2', `${v.spO2} %`, v.spO2 < 94],
                ['CO2', `${v.co2Level} ppm`, v.co2Level > 3500],
                ['Radiación', `${v.radiationRate} µSv/h`, v.radiationRate > 50],
                ['Linfocitos', `${v.linfocitos} /µL`, v.linfocitos < 1000],
                ['Cistatina C', `${v.cistatinaC} mg/L`, v.cistatinaC > 1.15],
                ['Ca²⁺', `${v.calcioIonico} mmol/L`, v.calcioIonico > 1.25],
                ['Cortisol', `${v.cortisol} ng/mL`, v.cortisol > 30],
              ].map(([k, val, bad]) => (
                <div key={String(k)} className={`rounded-lg border p-3 ${bad ? 'border-red-500/60 bg-red-500/10' : 'border-slate-800 bg-slate-900/60'}`}>
                  <dt className="text-xs uppercase text-slate-400">{k}</dt>
                  <dd className="text-2xl font-thin tabular-nums">{val}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Diagnóstico */}
          <section className="space-y-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">Diagnóstico presuntivo</h3>
            <ul className="space-y-2">
              {report.diagnosis.map((d) => (
                <li key={d.title} className={`rounded-lg border-l-4 bg-slate-900/60 p-3 ${d.severity === 'critical' ? 'border-red-500' : 'border-amber-400'}`}>
                  <p className="font-black">{d.title}</p>
                  <p className="text-sm text-slate-400">{d.basis}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs italic text-slate-400">
              Generado automáticamente a partir de las reglas RIDGE y los signos vitales. Debe confirmarlo el cirujano de vuelo.
            </p>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">Evolución ({report.readings} lecturas)</h3>
              <table className="w-full text-sm tabular-nums">
                <thead className="text-xs text-slate-500">
                  <tr><th className="text-left font-normal py-1">Métrica</th><th className="text-right font-normal">Inicio</th><th className="text-right font-normal">Ahora</th></tr>
                </thead>
                <tbody>
                  {report.trend.map((t) => (
                    <tr key={t.metric} className="border-t border-slate-800">
                      <td className="py-1">{t.metric}</td>
                      <td className="text-right text-slate-400">{t.first}</td>
                      <td className="text-right">{t.last} <span className="text-xs text-slate-500">{t.unit}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">Pedido al equipo médico en Tierra</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
                {report.recommendations.map((r) => <li key={r}>{r}</li>)}
              </ol>
            </section>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-4">
            <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-cyan-400 transition cursor-pointer">
              <Download className="h-4 w-4" aria-hidden /> Descargar informe
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm uppercase tracking-wider text-slate-300 hover:border-white hover:text-white transition cursor-pointer">
              Volver al panel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EarthAlert;
