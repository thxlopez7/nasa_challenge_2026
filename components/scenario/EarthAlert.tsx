'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertOctagon, CheckCircle2, Download, Radio, Satellite, ShieldAlert, X } from 'lucide-react';
import { formatOneWayLatency, getMissionComms } from '../../config/missionComms';
import { useT } from '../../i18n/I18nContext';
import type { TranslationDict } from '../../i18n/es';
import { useOutboxStore } from '../../store/useOutboxStore';
import { useScenarioStore } from '../../store/useScenarioStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import type { CrewProfile } from '../../types/profile';
import type { TelemetryData } from '../../types/telemetry';
import { MISSION_CHOICES, type MissionSlug } from '../../utils/missionChoice';
import {
  GROUND_RECOMMENDATIONS,
  SCENARIO_EVENTS,
  isLifeThreatening,
  presumptiveDiagnosis,
} from '../../utils/scenarios';
import CrewAvatar from '../profile/CrewAvatar';
import { crewText } from '../profile/crewText';

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
  } as TelemetryData;
}

interface EarthReport {
  id: string;
  generatedAt: string;
  trigger: string;
  crew: CrewProfile;
  crewRole: string;
  crewAllergies: string;
  mission: string;
  voiceLink: string;
  vitals: TelemetryData;
  trend: { metric: string; first: number; last: number; min: number; max: number; unit: string }[];
  ridge: { r1: boolean; r2: boolean; r3: boolean; codeRed: boolean };
  diagnosis: { title: string; basis: string; severity: 'critical' | 'warning' }[];
  recommendations: string[];
  timeline: { at: number; title: string }[];
  readings: number;
}

/** Explicación de cada hallazgo con los valores que lo justifican. */
function describeDx(id: string, v: TelemetryData, t: TranslationDict): { title: string; basis: string } {
  const d = t.earthAlert.dx;
  const nlr = v.linfocitos > 0 ? v.neutrofilos / v.linfocitos : 0;
  switch (id) {
    case 'hypoxemia': return { title: d.hypoxemia, basis: `SpO2 ${v.spO2} %` };
    case 'hypercapnia': return { title: d.hypercapnia, basis: `CO2 ${v.co2Level} ppm ${d.inModule}` };
    case 'tachycardia': return { title: d.tachycardia, basis: `${t.earthAlert.vitals.hr} ${v.heartRate} bpm` };
    case 'radiation': return { title: d.radiation, basis: `${d.radiationWord} ${v.radiationRate} µSv/h · ${d.lymph} ${v.linfocitos}/µL · NLR ${nlr.toFixed(1)}` };
    case 'renal': return { title: d.renal, basis: `${t.earthAlert.vitals.cys} ${v.cistatinaC} mg/L · Ca²⁺ ${v.calcioIonico} mmol/L · ${d.creatinine} ${v.creatinina} mg/dL` };
    default: return { title: d.stress, basis: `${d.cortisol} ${v.cortisol} ng/mL` };
  }
}

function buildReport(
  crew: CrewProfile,
  mision: MissionSlug | undefined,
  history: TelemetryData[],
  trigger: string,
  t: TranslationDict
): EarthReport {
  const v = history[history.length - 1] ?? snapshot();
  const series = (k: keyof TelemetryData) => history.map((h) => Number(h[k]));
  const trendOf = (k: keyof typeof t.earthAlert.trend, unit: string) => {
    const xs = series(k);
    return { metric: t.earthAlert.trend[k], unit, first: xs[0], last: xs[xs.length - 1], min: Math.min(...xs), max: Math.max(...xs) };
  };
  const elapsed = useScenarioStore.getState().elapsed;
  const events = crew.scenario === 'live' ? [] : SCENARIO_EVENTS[crew.scenario].filter((e) => e.at <= elapsed);
  const info = crewText(crew, t);
  const missionLabel = mision === 'marte' ? t.common.mars : t.common.moon;
  const tagline = mision === 'marte' ? t.coverIntro.marsTagline : t.coverIntro.moonTagline;
  return {
    id: `EXV-${Date.now().toString(36).toUpperCase()}`,
    generatedAt: new Date().toISOString(),
    trigger,
    crew,
    crewRole: info.role,
    crewAllergies: info.allergies,
    mission: mision ? `${missionLabel} · ${tagline}` : t.earthAlert.missionNone,
    voiceLink: t.earthAlert.voiceLink,
    vitals: v,
    trend: [
      trendOf('heartRate', 'bpm'),
      trendOf('spO2', '%'),
      trendOf('co2Level', 'ppm'),
      trendOf('linfocitos', '/µL'),
      trendOf('cistatinaC', 'mg/L'),
      trendOf('radiationRate', 'µSv/h'),
    ],
    ridge: { r1: v.isRenalWarning, r2: v.isRadiationWarning, r3: v.isCo2Warning, codeRed: v.isEmergency },
    diagnosis: presumptiveDiagnosis(v).map((f) => ({ ...describeDx(f.id, v, t), severity: f.severity })),
    recommendations: GROUND_RECOMMENDATIONS.map((k) => t.earthAlert.ground[k]),
    timeline: events.map((e) => ({ at: e.at, title: t.scenarioText[e.id].title })),
    readings: history.length,
  };
}

/* ------------------------------------------------------------------ */

const STEP_ICONS = [ShieldAlert, Radio, Satellite, CheckCircle2];
const STEP_KEYS = ['pack', 'encrypt', 'transmit', 'received'] as const;

/**
 * Vigila la telemetría del tripulante. Si las lecturas ponen en riesgo su
 * vida y no responde a la comprobación de consciencia, genera una alerta
 * con todos los datos y un diagnóstico presuntivo, la envía a Tierra sola y
 * la deja en la cola de envíos (pestaña «Tierra»).
 */
export function EarthAlert({ profile, mision }: { profile: CrewProfile; mision?: MissionSlug }) {
  const { t, lang } = useT();
  const [phase, setPhase] = useState<Phase>('idle');
  const [left, setLeft] = useState(CHECK_SECONDS);
  const [stepIdx, setStepIdx] = useState(0);
  const [report, setReport] = useState<EarthReport | null>(null);
  const [open, setOpen] = useState(true);
  const history = useRef<TelemetryData[]>([]);
  const cooldownUntil = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  const missionProfileId = MISSION_CHOICES[mision ?? 'luna'].profileId;

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  function send(trigger: string) {
    const built = buildReport(profile, mision, history.current, trigger, t);
    setReport(built);
    // Entra en la cola real de envíos a Tierra (pestaña «Tierra»), con su latencia.
    useOutboxStore.getState().enqueuePacket({
      kind: 'TELEMETRY_SNAPSHOT',
      title: `${t.earthAlert.chip} · ${profile.name}`,
      missionProfileId,
      priority: 'emergency',
      payload: built as unknown as Record<string, unknown>,
    });
    setStepIdx(0);
    setOpen(true);
    go('sending');
  }
  // La cuenta atrás llama a la versión actual de `send` (perfil, misión e idioma al día).
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
        sendRef.current(t.earthAlert.triggerNoAnswer);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, t]);

  // Animación de la transmisión.
  useEffect(() => {
    if (phase !== 'sending') return;
    const id = window.setInterval(() => {
      setStepIdx((i) => {
        if (i >= STEP_KEYS.length - 1) {
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
    a.download = `${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- Comprobación de consciencia ---------- */
  if (phase === 'checking') {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-red-950/80 backdrop-blur-sm p-4" role="alertdialog" aria-modal="true" aria-labelledby="check-title">
        <div className="earth-pulse w-full max-w-lg rounded-2xl border-2 border-red-500 bg-slate-950 p-6 text-center space-y-5 shadow-[0_0_80px_rgba(239,68,68,0.45)]">
          <AlertOctagon className="mx-auto h-12 w-12 text-red-400" aria-hidden />
          <div className="space-y-2">
            <h2 id="check-title" className="text-3xl font-black uppercase text-white">{t.earthAlert.checkTitle}</h2>
            <p className="font-lead text-lg text-slate-200">{t.earthAlert.checkBody(profile.name)}</p>
          </div>
          <p className="text-6xl font-thin tabular-nums text-red-300" aria-live="assertive">{left}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={confirmConscious} className="rounded-lg bg-white px-6 py-3 text-base font-black uppercase tracking-wider text-black hover:bg-slate-200 transition cursor-pointer">
              {t.earthAlert.conscious}
            </button>
            <button type="button" onClick={() => send(t.earthAlert.triggerManual)} className="rounded-lg border border-red-400 px-6 py-3 text-base font-black uppercase tracking-wider text-red-200 hover:bg-red-500/20 transition cursor-pointer">
              {t.earthAlert.sendNow}
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
        <Satellite className="h-4 w-4" aria-hidden /> {t.earthAlert.chip}
      </button>
    );
  }

  const v = report.vitals;
  const sent = phase === 'sent';
  const slowLink = getMissionComms(missionProfileId).oneWayLatencyNominalSec > 60;
  const vitalRows: [string, string, boolean][] = [
    [t.earthAlert.vitals.hr, `${v.heartRate} bpm`, v.heartRate > 120],
    [t.earthAlert.vitals.spo2, `${v.spO2} %`, v.spO2 < 94],
    [t.earthAlert.vitals.co2, `${v.co2Level} ppm`, v.co2Level > 3500],
    [t.earthAlert.vitals.rad, `${v.radiationRate} µSv/h`, v.radiationRate > 50],
    [t.earthAlert.vitals.lymph, `${v.linfocitos} /µL`, v.linfocitos < 1000],
    [t.earthAlert.vitals.cys, `${v.cistatinaC} mg/L`, v.cistatinaC > 1.15],
    [t.earthAlert.vitals.ca, `${v.calcioIonico} mmol/L`, v.calcioIonico > 1.25],
    [t.earthAlert.vitals.cortisol, `${v.cortisol} ng/mL`, v.cortisol > 30],
  ];

  /* ---------- Informe enviado ---------- */
  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="earth-title">
      <div className="mx-auto my-6 w-full max-w-4xl rounded-2xl border border-red-500/70 bg-slate-950 text-slate-100 shadow-[0_0_60px_rgba(239,68,68,0.35)]">
        <header className="flex items-start justify-between gap-4 border-b border-red-500/40 bg-red-600/15 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-300">{t.earthAlert.kicker(report.id)}</p>
            <h2 id="earth-title" className="mt-1 text-2xl sm:text-3xl font-black uppercase text-white">
              {sent ? t.earthAlert.sentTitle : t.earthAlert.sendingTitle}
            </h2>
            <p className="text-sm text-slate-300 mt-1">{report.trigger}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label={t.earthAlert.minimize} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="space-y-6 p-5">
          <ol className="grid gap-2 sm:grid-cols-4" aria-label={t.earthAlert.stepsAria}>
            {STEP_KEYS.map((key, i) => {
              const Icon = STEP_ICONS[i];
              const done = sent || i < stepIdx;
              const active = !sent && i === stepIdx;
              return (
                <li key={key} className={`rounded-lg border p-3 text-xs ${done ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100' : active ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100 animate-pulse' : 'border-slate-800 text-slate-500'}`}>
                  <Icon className="mb-1 h-4 w-4" aria-hidden />
                  {t.earthAlert.steps[key]}
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-slate-400">
            {t.earthAlert.signalDelay} <span className="text-slate-200">{formatOneWayLatency(missionProfileId, lang)}</span>
            {slowLink && ` ${t.earthAlert.accelerated}`} · {t.earthAlert.voiceLabel} {report.voiceLink}
          </p>
          <p className="text-xs text-slate-400">{t.earthAlert.queued}</p>

          <section className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <CrewAvatar profile={report.crew} className="h-16 w-16 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black">{report.crew.name} · <span className="font-normal">{report.crewRole}</span></p>
              <p className="text-sm text-slate-400">{report.mission}</p>
            </div>
            <dl className="grid grid-cols-3 gap-x-5 gap-y-1 text-sm">
              <dt className="text-slate-500">{t.crew.age}</dt><dt className="text-slate-500">{t.crew.blood}</dt><dt className="text-slate-500">{t.crew.allergies}</dt>
              <dd>{t.earthAlert.ageYears(report.crew.age)}</dd><dd className="font-black text-red-300">{report.crew.bloodType}</dd><dd>{report.crewAllergies}</dd>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">{t.earthAlert.vitalsTitle}</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {vitalRows.map(([k, val, bad]) => (
                <div key={k} className={`rounded-lg border p-3 ${bad ? 'border-red-500/60 bg-red-500/10' : 'border-slate-800 bg-slate-900/60'}`}>
                  <dt className="text-xs uppercase text-slate-400">{k}</dt>
                  <dd className="text-2xl font-thin tabular-nums">{val}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">{t.earthAlert.dxTitle}</h3>
            <ul className="space-y-2">
              {report.diagnosis.map((d) => (
                <li key={d.title} className={`rounded-lg border-l-4 bg-slate-900/60 p-3 ${d.severity === 'critical' ? 'border-red-500' : 'border-amber-400'}`}>
                  <p className="font-black">{d.title}</p>
                  <p className="text-sm text-slate-400">{d.basis}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs italic text-slate-400">{t.earthAlert.dxNote}</p>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">{t.earthAlert.trendTitle(report.readings)}</h3>
              <table className="w-full text-sm tabular-nums">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="text-left font-normal py-1">{t.earthAlert.trendMetric}</th>
                    <th className="text-right font-normal">{t.earthAlert.trendStart}</th>
                    <th className="text-right font-normal">{t.earthAlert.trendNow}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.trend.map((row) => (
                    <tr key={row.metric} className="border-t border-slate-800">
                      <td className="py-1">{row.metric}</td>
                      <td className="text-right text-slate-400">{row.first}</td>
                      <td className="text-right">{row.last} <span className="text-xs text-slate-500">{row.unit}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">{t.earthAlert.groundTitle}</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
                {report.recommendations.map((r) => <li key={r}>{r}</li>)}
              </ol>
            </section>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-4">
            <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-cyan-400 transition cursor-pointer">
              <Download className="h-4 w-4" aria-hidden /> {t.earthAlert.download}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm uppercase tracking-wider text-slate-300 hover:border-white hover:text-white transition cursor-pointer">
              {t.earthAlert.backToPanel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EarthAlert;
