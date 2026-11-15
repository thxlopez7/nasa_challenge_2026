'use client';

import { useEffect } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Siren } from 'lucide-react';
import { useMissionStore } from '../../store/useMissionStore';
import { useScenarioStore } from '../../store/useScenarioStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { useVitalsHistory, type VitalSample } from '../../store/useVitalsHistory';
import type { DayRecord } from '../../types/mission';
import { formatDay } from '../../utils/missionPlan';
import {
  BAND_LABEL,
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

function Trend({ dir, text }: { dir: -1 | 0 | 1; text: string }) {
  const Icon = dir === 1 ? ArrowUpRight : dir === -1 ? ArrowDownRight : ArrowRight;
  const cls = dir === 1 ? 'text-emerald-300' : dir === -1 ? 'text-red-300' : 'text-slate-400';
  const word = dir === 1 ? 'mejora' : dir === -1 ? 'empeora' : 'estable';
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {text} · {word}
    </span>
  );
}

/* ------------------------------------------------------------------ */

function VitalCard({ def, samples }: { def: VitalDef; samples: VitalSample[] }) {
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
        <p className="text-xs uppercase tracking-wider text-slate-400">{def.label}</p>
        {status !== 'ok' && (
          <span className={`text-[10px] font-black uppercase ${status === 'crit' ? 'text-red-300' : 'text-amber-300'}`}>
            {status === 'crit' ? 'Crítico' : 'Fuera de rango'}
          </span>
        )}
      </div>
      <p className="text-3xl font-thin tabular-nums text-slate-100">
        {value.toFixed(def.digits)} <span className="text-sm text-slate-500">{def.unit}</span>
      </p>
      <Trend dir={dir} text={`${delta >= 0 ? '+' : ''}${delta.toFixed(def.digits)} en ${COMPARE_S} s`} />
      <MiniChart
        points={points}
        tone={tone}
        threshold={def.threshold}
        thresholdLabel={def.thresholdLabel}
        unit={def.unit}
        digits={def.digits}
        live
        ariaLabel={`${def.label}: últimos ${LIVE_WINDOW_S} segundos, ahora ${value.toFixed(def.digits)} ${def.unit}`}
      />
      <p className="text-[10px] text-slate-500">Umbral · {def.thresholdLabel}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type DailyKey = 'score' | 'heartRate' | 'linfocitos' | 'cistatinaC';

const DAILY: { key: DailyKey; label: string; unit: string; digits: number; def?: VitalDef }[] = [
  { key: 'score', label: 'Índice de salud', unit: '/100', digits: 0 },
  { key: 'heartRate', label: 'Frecuencia cardíaca', unit: 'lpm', digits: 0, def: VITALS[0] },
  { key: 'linfocitos', label: 'Linfocitos', unit: '/µL', digits: 0, def: VITALS[4] },
  { key: 'cistatinaC', label: 'Cistatina C', unit: 'mg/L', digits: 2, def: VITALS[5] },
];

function dailyValue(r: DayRecord, key: DailyKey): number | undefined {
  if (!r.vitals) return undefined;
  return key === 'score' ? healthScore(r.vitals) : r.vitals[key];
}

function DailyChart({ meta, records, live }: {
  meta: (typeof DAILY)[number];
  records: DayRecord[];
  live: number;
}) {
  const days = records
    .map((r) => ({ r, v: dailyValue(r, meta.key) }))
    .filter((d): d is { r: DayRecord; v: number } => d.v !== undefined)
    .slice(-DAYS);
  const points: ChartPoint[] = [
    ...days.map(({ r, v }) => ({ label: `Día ${r.missionDay} · ${formatDay(r.date)}`, y: v })),
    { label: 'Hoy · en vivo', y: live },
  ];
  const weekAgo = days.length >= 7 ? days[days.length - 7].v : days[0]?.v;
  const defForDir: VitalDef =
    meta.def ?? { ...VITALS[1], key: 'spO2', better: 'up' };
  const dir = weekAgo === undefined ? 0 : direction(defForDir, weekAgo, live, meta.key === 'score' ? 4 : TOLERANCE[meta.key as keyof typeof TOLERANCE]);
  const status = meta.def ? meta.def.status(live) : live >= SCORE_STABLE ? 'ok' : live >= SCORE_CRISIS ? 'warn' : 'crit';
  const tone: ChartTone = status === 'ok' ? 'ok' : status === 'warn' ? 'warn' : 'crit';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-1">
      <p className="text-xs uppercase tracking-wider text-slate-400">{meta.label}</p>
      <p className="text-xl font-thin tabular-nums">
        {live.toFixed(meta.digits)} <span className="text-xs text-slate-500">{meta.unit} hoy</span>
      </p>
      {weekAgo !== undefined && (
        <Trend dir={dir} text={`vs hace 7 días ${weekAgo.toFixed(meta.digits)}`} />
      )}
      <MiniChart
        points={points}
        tone={tone}
        threshold={meta.def?.threshold ?? SCORE_CRISIS}
        unit={meta.unit}
        digits={meta.digits}
        live
        domain={meta.key === 'score' ? [0, 100] : undefined}
        ariaLabel={`${meta.label}: últimos ${days.length} días y hoy en vivo`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Evolución del tripulante: índice de salud y signos vitales segundo a
 * segundo, y la tendencia día a día con el día de hoy en vivo. Cuando entra
 * en crisis vital, las tarjetas afectadas se ponen en rojo y laten.
 */
export function LiveEvolution() {
  const samples = useVitalsHistory((s) => s.samples);
  const records = useMissionStore((s) => s.records);
  const t = useTelemetryStore();

  // Graba una lectura por segundo (también si el God Mode congela los datos).
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
  }, []);

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
          <h2 id="evo-title" className="text-lg font-black uppercase tracking-wider text-cyan-400">Evolución del tripulante</h2>
          <p className="font-lead text-base text-slate-300">Segundo a segundo y día a día: ¿mejora o empeora?</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded border px-3 py-1 text-xs font-black uppercase tracking-wider ${style.cls}`}>
          <Activity className="h-4 w-4" aria-hidden /> {BAND_LABEL[band]}
        </span>
      </div>

      {band === 'critical' && (
        <div role="alert" className="vital-crisis flex items-start gap-3 rounded-lg border-2 border-red-500 bg-red-500/15 p-4">
          <Siren className="h-6 w-6 shrink-0 text-red-300" aria-hidden />
          <div>
            <p className="font-black uppercase tracking-wider text-red-100">Crisis vital</p>
            <p className="text-sm text-red-100/90">
              {critical.length > 0
                ? `Fuera de rango crítico: ${critical.map((d) => `${d.label} ${t[d.key].toFixed(d.digits)} ${d.unit}`).join(' · ')}.`
                : `El índice de salud ha caído por debajo de ${SCORE_CRISIS}.`}
            </p>
          </div>
        </div>
      )}

      {/* Índice de salud en vivo */}
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-slate-400">Índice de salud</p>
          <p className="text-6xl font-thin tabular-nums text-white">
            {score}<span className="text-xl text-slate-500">/100</span>
          </p>
          <Trend dir={scoreDir} text={`${scoreDelta >= 0 ? '+' : ''}${scoreDelta} en ${COMPARE_S} s`} />
          <p className="text-[11px] text-slate-500">
            ≥ {SCORE_STABLE} estable · {SCORE_CRISIS}–{SCORE_STABLE - 1} en riesgo · &lt; {SCORE_CRISIS} crisis vital
          </p>
        </div>
        <MiniChart
          points={recent.map((s) => ({ label: clock(s.t), y: s.score }))}
          tone={style.tone}
          threshold={SCORE_CRISIS}
          thresholdLabel={`Crisis < ${SCORE_CRISIS}`}
          unit="/100"
          digits={0}
          height={120}
          live
          area
          domain={[0, 100]}
          ariaLabel={`Índice de salud de los últimos ${LIVE_WINDOW_S} segundos: ${score} de 100`}
        />
      </div>

      {/* Signos vitales en vivo */}
      <div>
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-300">
          En vivo · últimos {LIVE_WINDOW_S / 60} min
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {VITALS.map((d) => (
            <VitalCard key={d.key} def={d} samples={samples} />
          ))}
        </div>
      </div>

      {/* Día a día */}
      <div>
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-300">
          Día a día · últimos {DAYS} días y hoy en vivo
        </h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500">
            Todavía no hay días registrados. Cierra la evaluación diaria o carga la demo del Centro de misión.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {DAILY.map((m) => (
              <DailyChart
                key={m.key}
                meta={m}
                records={sorted}
                live={m.key === 'score' ? score : t[m.key]}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default LiveEvolution;
