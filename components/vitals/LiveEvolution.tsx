'use client';

import { useEffect } from 'react';
import { useT } from '../../i18n/I18nContext';
import type { TranslationDict } from '../../i18n/es';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Siren } from 'lucide-react';
import { useMissionStore } from '../../store/useMissionStore';
import { useScenarioStore } from '../../store/useScenarioStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { useVitalsHistory, type VitalSample } from '../../store/useVitalsHistory';
import type { DayRecord } from '../../types/mission';
import { formatDay } from '../../utils/missionPlan';
import {
  TOLERANCE,
  VITALS,
  bandOf,
  direction,
  healthScore,
  SCORE_CRISIS,
  SCORE_STABLE,
  type VitalDef,
} from '../../utils/vitalsScore';
import MiniChart, { type ChartPoint, type ChartTone } from './MiniChart';

/** Ventana para comparar "ahora" con "hace un rato", en segundos. */
const COMPARE_S = 30;
const LIVE_WINDOW_S = 120;
const DAYS = 14;

const BAND_STYLE = {
  stable: { tone: 'ok' as ChartTone, cls: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200' },
  risk: { tone: 'warn' as ChartTone, cls: 'border-amber-500/70 bg-amber-500/10 text-amber-200' },
  critical: { tone: 'crit' as ChartTone, cls: 'border-red-500 bg-red-500/15 text-red-200' },
};

const clock = (t: number) =>
  new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function Trend({ dir, text, t }: { dir: -1 | 0 | 1; text: string; t: TranslationDict }) {
  const Icon = dir === 1 ? ArrowUpRight : dir === -1 ? ArrowDownRight : ArrowRight;
  const cls = dir === 1 ? 'text-emerald-300' : dir === -1 ? 'text-red-300' : 'text-slate-400';
  const word = dir === 1 ? t.evolution.better : dir === -1 ? t.evolution.worse : t.evolution.steady;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {text} · {word}
    </span>
  );
}

/** Nombre y umbral de cada métrica en el idioma activo. */
const metricLabel = (d: VitalDef, t: TranslationDict) => t.evolution.metrics[d.key];
const thresholdText = (d: VitalDef, t: TranslationDict) =>
  d.key === 'heartRate' ? t.evolution.thresholds.heartRate : d.key === 'spO2' ? t.evolution.thresholds.spO2 : d.thresholdLabel;

/* ------------------------------------------------------------------ */

function VitalCard({ def, samples, t }: { def: VitalDef; samples: VitalSample[]; t: TranslationDict }) {
  const recent = samples.slice(-LIVE_WINDOW_S);
  const now = recent[recent.length - 1];
  if (!now) return null;
  const ref = recent[Math.max(0, recent.length - 1 - COMPARE_S)];
  const value = now[def.key];
  const delta = value - ref[def.key];
  const dir = direction(def, ref[def.key], value, TOLERANCE[def.key]);
  const status = def.status(value);
  const tone: ChartTone = status === 'ok' ? 'ok' : status === 'warn' ? 'warn' : 'crit';
  const border =
    status === 'crit' ? 'border-red-500 bg-red-500/10 vital-crisis' : status === 'warn' ? 'border-amber-500/60' : 'border-slate-800';
  const points: ChartPoint[] = recent.map((s) => ({ label: clock(s.t), y: s[def.key] }));

  return (
    <div className={`rounded-lg border bg-slate-950/60 p-3 space-y-1 ${border}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-slate-400">{metricLabel(def, t)}</p>
        {status !== 'ok' && (
          <span className={`text-[10px] font-black uppercase ${status === 'crit' ? 'text-red-300' : 'text-amber-300'}`}>
            {status === 'crit' ? t.evolution.critical : t.evolution.outOfRange}
          </span>
        )}
      </div>
      <p className="text-3xl font-thin tabular-nums text-slate-100">
        {value.toFixed(def.digits)} <span className="text-sm text-slate-500">{def.unit}</span>
      </p>
      <Trend t={t} dir={dir} text={t.evolution.deltaIn(`${delta >= 0 ? '+' : ''}${delta.toFixed(def.digits)}`, COMPARE_S)} />
      <MiniChart
        points={points}
        tone={tone}
        threshold={def.threshold}
        thresholdLabel={thresholdText(def, t)}
        unit={def.unit}
        digits={def.digits}
        live
        ariaLabel={t.evolution.cardAria(metricLabel(def, t), LIVE_WINDOW_S, `${value.toFixed(def.digits)} ${def.unit}`)}
        waitingText={t.evolution.waiting}
      />
      <p className="text-[10px] text-slate-500">{t.evolution.threshold} · {thresholdText(def, t)}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type DailyKey = 'score' | 'heartRate' | 'linfocitos' | 'cistatinaC';

const DAILY: { key: DailyKey; unit: string; digits: number; def?: VitalDef }[] = [
  { key: 'score', unit: '/100', digits: 0 },
  { key: 'heartRate', unit: 'bpm', digits: 0, def: VITALS[0] },
  { key: 'linfocitos', unit: '/µL', digits: 0, def: VITALS[4] },
  { key: 'cistatinaC', unit: 'mg/L', digits: 2, def: VITALS[5] },
];

function dailyValue(r: DayRecord, key: DailyKey): number | undefined {
  if (!r.vitals) return undefined;
  return key === 'score' ? healthScore(r.vitals) : r.vitals[key];
}

function DailyChart({ meta, records, live, t }: {
  meta: (typeof DAILY)[number];
  records: DayRecord[];
  live: number;
  t: TranslationDict;
}) {
  const label = t.evolution.metrics[meta.key];
  const days = records
    .map((r) => ({ r, v: dailyValue(r, meta.key) }))
    .filter((d): d is { r: DayRecord; v: number } => d.v !== undefined)
    .slice(-DAYS);
  const points: ChartPoint[] = [
    ...days.map(({ r, v }) => ({ label: t.evolution.dayLabel(r.missionDay, formatDay(r.date)), y: v })),
    { label: t.evolution.todayLive, y: live },
  ];
  const weekAgo = days.length >= 7 ? days[days.length - 7].v : days[0]?.v;
  const defForDir: VitalDef =
    meta.def ?? { ...VITALS[1], key: 'spO2', better: 'up' };
  const dir = weekAgo === undefined ? 0 : direction(defForDir, weekAgo, live, meta.key === 'score' ? 4 : TOLERANCE[meta.key as keyof typeof TOLERANCE]);
  const status = meta.def ? meta.def.status(live) : live >= SCORE_STABLE ? 'ok' : live >= SCORE_CRISIS ? 'warn' : 'crit';
  const tone: ChartTone = status === 'ok' ? 'ok' : status === 'warn' ? 'warn' : 'crit';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-1">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-xl font-thin tabular-nums">
        {live.toFixed(meta.digits)} <span className="text-xs text-slate-500">{meta.unit} {t.evolution.today}</span>
      </p>
      {weekAgo !== undefined && (
        <Trend t={t} dir={dir} text={t.evolution.vsWeek(weekAgo.toFixed(meta.digits))} />
      )}
      <MiniChart
        points={points}
        tone={tone}
        threshold={meta.def?.threshold ?? SCORE_CRISIS}
        unit={meta.unit}
        digits={meta.digits}
        live
        domain={meta.key === 'score' ? [0, 100] : undefined}
        ariaLabel={t.evolution.dailyAria(label, days.length)}
        waitingText={t.evolution.waiting}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Graba una lectura por segundo (también si el God Mode congela los datos).
 * Vive en el Centro de mando para que la historia siga corriendo aunque la
 * gráfica esté en otra pestaña.
 */
export function useLiveVitalsRecorder(resetKey?: string) {
  useEffect(() => {
    const { push, clear } = useVitalsHistory.getState();
    clear();
    const id = window.setInterval(() => push(useTelemetryStore.getState()), 1000);
    // Si el guion vuelve a empezar (nuevo historial, otro tripulante), la gráfica también.
    const unsub = useScenarioStore.subscribe((st, prev) => {
      if (st.elapsed < prev.elapsed) clear();
    });
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, [resetKey]);
}

/**
 * Evolución del tripulante: índice de salud y signos vitales segundo a
 * segundo, y la tendencia día a día con el día de hoy en vivo. Cuando entra
 * en crisis vital, las tarjetas afectadas se ponen en rojo y laten.
 */
export function LiveEvolution() {
  const { t: dict } = useT();
  const samples = useVitalsHistory((s) => s.samples);
  const records = useMissionStore((s) => s.records);
  const t = useTelemetryStore();
  const e = dict.evolution;


  const score = healthScore(t);
  const band = bandOf(score);
  const style = BAND_STYLE[band];
  const recent = samples.slice(-LIVE_WINDOW_S);
  const ref = recent[Math.max(0, recent.length - 1 - COMPARE_S)];
  const scoreDelta = ref ? score - ref.score : 0;
  const scoreDir: -1 | 0 | 1 = Math.abs(scoreDelta) < 3 ? 0 : scoreDelta > 0 ? 1 : -1;
  const critical = VITALS.filter((d) => d.status(t[d.key]) === 'crit');
  const sorted = Object.values(records).sort((a, b) => a.missionDay - b.missionDay);

  return (
    <section aria-labelledby="evo-title" className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="evo-title" className="text-lg font-black uppercase tracking-wider text-cyan-400">{e.title}</h2>
          <p className="font-lead text-base text-slate-300">{e.subtitle}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded border px-3 py-1 text-xs font-black uppercase tracking-wider ${style.cls}`}>
          <Activity className="h-4 w-4" aria-hidden /> {e.bands[band]}
        </span>
      </div>

      {band === 'critical' && (
        <div role="alert" className="vital-crisis flex items-start gap-3 rounded-lg border-2 border-red-500 bg-red-500/15 p-4">
          <Siren className="h-6 w-6 shrink-0 text-red-300" aria-hidden />
          <div>
            <p className="font-black uppercase tracking-wider text-red-100">{e.crisis}</p>
            <p className="text-sm text-red-100/90">
              {critical.length > 0
                ? e.crisisList(critical.map((d) => `${metricLabel(d, dict)} ${t[d.key].toFixed(d.digits)} ${d.unit}`).join(' · '))
                : e.crisisScore(SCORE_CRISIS)}
            </p>
          </div>
        </div>
      )}

      {/* Índice de salud en vivo */}
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-slate-400">{e.scoreLabel}</p>
          <p className="text-6xl font-thin tabular-nums text-white">
            {score}<span className="text-xl text-slate-500">/100</span>
          </p>
          <Trend t={dict} dir={scoreDir} text={e.deltaIn(`${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`, COMPARE_S)} />
          <p className="text-[11px] text-slate-500">{e.scoreLegend(SCORE_STABLE, SCORE_CRISIS)}</p>
        </div>
        <MiniChart
          points={recent.map((s) => ({ label: clock(s.t), y: s.score }))}
          tone={style.tone}
          threshold={SCORE_CRISIS}
          thresholdLabel={`< ${SCORE_CRISIS}`}
          unit="/100"
          digits={0}
          height={120}
          live
          area
          domain={[0, 100]}
          ariaLabel={e.scoreAria(LIVE_WINDOW_S, score)}
          waitingText={e.waiting}
        />
      </div>

      {/* Signos vitales en vivo */}
      <div>
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-300">
          {e.liveTitle(LIVE_WINDOW_S / 60)}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {VITALS.map((d) => (
            <VitalCard key={d.key} def={d} samples={samples} t={dict} />
          ))}
        </div>
      </div>

      {/* Día a día */}
      <div>
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-300">
          {e.dailyTitle(DAYS)}
        </h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500">{e.noDays}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {DAILY.map((m) => (
              <DailyChart
                key={m.key}
                meta={m}
                records={sorted}
                live={m.key === 'score' ? score : t[m.key]}
                t={dict}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default LiveEvolution;
