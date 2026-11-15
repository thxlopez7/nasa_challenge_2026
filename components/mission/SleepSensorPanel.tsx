'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Moon,
  Radar,
  RefreshCw,
  Ruler,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import type { SleepNight, SleepStage } from '../../types/sleep';
import { formatDecimal } from '../../utils/formatters';
import {
  EPOCH_MIN,
  OUT_OF_BED_CM,
  SLEEP_THRESHOLDS as S,
  clockAt,
} from '../../utils/sleepSensing';

const STAGES: SleepStage[] = ['AWAKE', 'REM', 'LIGHT', 'DEEP'];
const STAGE_COLOR: Record<SleepStage, string> = {
  AWAKE: '#94a3b8',
  REM: '#67e8f9',
  LIGHT: '#06b6d4',
  DEEP: '#0e7490',
};

function Sonar({ active }: { active: boolean }) {
  return (
    <div className="relative h-24 w-24 shrink-0" aria-hidden>
      {[0, 0.6, 1.2].map((delay) => (
        <span
          key={delay}
          className={`absolute inset-0 rounded-full border border-cyan-400/60 ${
            active ? 'animate-ping motion-reduce:animate-none' : 'opacity-30'
          }`}
          style={{ animationDelay: `${delay}s`, animationDuration: '1.8s' }}
        />
      ))}
      <span className="absolute inset-[30%] rounded-full bg-cyan-500/15 border border-cyan-400 flex items-center justify-center">
        <Radar className="h-5 w-5 text-cyan-300" />
      </span>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  alert,
}: {
  icon: typeof Moon;
  label: string;
  value: string;
  sub?: string;
  alert?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-3 bg-slate-950/60 ${
        alert ? 'border-amber-500/60' : 'border-slate-800'
      }`}
    >
      <dt className="text-[11px] uppercase text-slate-500 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
      </dt>
      <dd className="text-base font-bold text-slate-100 tabular-nums">{value}</dd>
      {sub && <dd className="text-[11px] text-slate-500 tabular-nums">{sub}</dd>}
      {alert && (
        <dd className="text-[11px] text-amber-300 flex items-center gap-1 mt-0.5">
          <AlertTriangle className="h-3 w-3" aria-hidden /> {alert}
        </dd>
      )}
    </div>
  );
}

const W = 640;
const PAD_L = 78;
const PAD_R = 8;
const HYP_TOP = 8;
const ROW_H = 18;
const HYP_H = ROW_H * STAGES.length;
const BR_TOP = HYP_TOP + HYP_H + 30;
const BR_H = 64;
const AXIS_Y = BR_TOP + BR_H + 14;
const H = AXIS_Y + 6;
const BR_MIN = 8;
const BR_MAX = 24;

function NightChart({ night }: { night: SleepNight }) {
  const { t, lang } = useT();
  const s = t.missionUi.sleep;
  const { epochs, summary } = night;
  const [hover, setHover] = useState<number | null>(null);
  const plotW = W - PAD_L - PAD_R;
  const step = plotW / epochs.length;
  const x = (i: number) => PAD_L + i * step;
  const yBr = (v: number) =>
    BR_TOP + BR_H - ((Math.min(BR_MAX, Math.max(BR_MIN, v)) - BR_MIN) / (BR_MAX - BR_MIN)) * BR_H;

  const breathPath = epochs
    .map((e, i) => `${i === 0 ? 'M' : 'L'}${(x(i) + step / 2).toFixed(1)},${yBr(e.breathingRate).toFixed(1)}`)
    .join(' ');

  const [bh, bm] = summary.bedtime.split(':').map(Number);
  const firstTick = (60 - bm) % 60;
  const ticks: number[] = [];
  for (let m = firstTick; m <= epochs.length * EPOCH_MIN; m += 60) ticks.push(m);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * plotW;
    setHover(Math.max(0, Math.min(epochs.length - 1, Math.floor(px / step))));
  };

  const h = hover !== null ? epochs[hover] : null;
  const tipLeft = hover !== null ? ((x(hover) + step / 2) / W) * 100 : 0;

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold text-slate-200">
        {s.chartTitle}
        <span className="block text-xs font-normal text-slate-500">
          {s.chartHint} {EPOCH_MIN} {s.minutesUnit}
        </span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`${s.chartTitle}: ${summary.deepPct}% ${s.stages.DEEP}, ${summary.remPct}% ${s.stages.REM}, ${formatDecimal(summary.breathingRate, 1, lang)} rpm`}
        >
          {STAGES.map((st, r) => (
            <g key={st}>
              <text x={PAD_L - 8} y={HYP_TOP + r * ROW_H + ROW_H / 2 + 4} textAnchor="end" className="fill-slate-400" fontSize="11">
                {s.stages[st]}
              </text>
              <line x1={PAD_L} x2={W - PAD_R} y1={HYP_TOP + (r + 1) * ROW_H} y2={HYP_TOP + (r + 1) * ROW_H} stroke="#1e293b" strokeWidth="1" />
            </g>
          ))}
          {epochs.map((e, i) => {
            const r = STAGES.indexOf(e.stage);
            return (
              <rect
                key={e.minute}
                x={x(i) + 0.5}
                y={HYP_TOP + r * ROW_H + 3}
                width={Math.max(1, step - 1)}
                height={ROW_H - 6}
                rx={2}
                fill={STAGE_COLOR[e.stage]}
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
            );
          })}

          <text x={PAD_L} y={BR_TOP - 8} className="fill-slate-400" fontSize="11">
            {s.breathAxis} {S.breathingRate.min}–{S.breathingRate.max}
          </text>
          <rect
            x={PAD_L}
            width={plotW}
            y={yBr(S.breathingRate.max)}
            height={yBr(S.breathingRate.min) - yBr(S.breathingRate.max)}
            fill="#0891b2"
            opacity={0.08}
          />
          {[BR_MIN, S.breathingRate.min, S.breathingRate.max, BR_MAX].map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yBr(v)} y2={yBr(v)} stroke="#1e293b" strokeWidth="1" />
              <text x={PAD_L - 8} y={yBr(v) + 3} textAnchor="end" className="fill-slate-500" fontSize="9">{v}</text>
            </g>
          ))}
          <path d={breathPath} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />

          {ticks.map((m) => (
            <text key={m} x={PAD_L + (m / EPOCH_MIN) * step} y={AXIS_Y} textAnchor="middle" className="fill-slate-500" fontSize="10">
              {String((bh + Math.round((bm + m) / 60)) % 24).padStart(2, '0')}:00
            </text>
          ))}

          {h && hover !== null && (
            <>
              <line x1={x(hover) + step / 2} x2={x(hover) + step / 2} y1={HYP_TOP} y2={BR_TOP + BR_H} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={x(hover) + step / 2} cy={yBr(h.breathingRate)} r={4} fill="#22d3ee" stroke="#020617" strokeWidth="2" />
            </>
          )}
          <rect
            x={PAD_L}
            y={HYP_TOP}
            width={plotW}
            height={BR_TOP + BR_H - HYP_TOP}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>

        {h && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-44 rounded-lg border border-slate-700 bg-slate-900/95 p-2 text-xs shadow-lg"
            style={{ left: `clamp(0px, calc(${tipLeft}% - 88px), calc(100% - 176px))` }}
          >
            <p className="font-semibold text-slate-100 tabular-nums">
              {clockAt(summary.bedtime, h.minute)} · {s.stages[h.stage]}
            </p>
            <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 text-slate-400 tabular-nums">
              <dt>{s.ttBreath}</dt><dd className="text-slate-200">{formatDecimal(h.breathingRate, 1, lang)} rpm</dd>
              <dt>{s.ttMovement}</dt><dd className="text-slate-200">{h.movement}/100</dd>
              <dt>{s.ttDistance}</dt>
              <dd className="text-slate-200">{h.distanceCm > OUT_OF_BED_CM ? s.outOfBedText : `${h.distanceCm} cm`}</dd>
              <dt>{s.ttRoom}</dt><dd className="text-slate-200">{formatDecimal(h.roomTempC, 1, lang)} °C</dd>
            </dl>
          </div>
        )}
      </div>

      <details className="text-xs text-slate-400">
        <summary className="cursor-pointer select-none">{s.tableToggle}</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1">{s.colHour}</th>
              <th>{s.colPhase}</th>
              <th>{s.colResp}</th>
              <th>{s.colMov}</th>
              <th>{s.colTemp}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil(epochs.length / 12) }, (_, k) => {
              const slice = epochs.slice(k * 12, k * 12 + 12);
              const counts = STAGES.map((st) => slice.filter((e) => e.stage === st).length);
              const dominant = STAGES[counts.indexOf(Math.max(...counts))];
              const avg = (f: (e: (typeof slice)[number]) => number) =>
                slice.reduce((a, e) => a + f(e), 0) / slice.length;
              return (
                <tr key={k} className="border-t border-slate-800">
                  <td className="py-1">{clockAt(summary.bedtime, k * 60)}</td>
                  <td>{s.stages[dominant]}</td>
                  <td>{formatDecimal(avg((e) => e.breathingRate), 1, lang)}</td>
                  <td>{Math.round(avg((e) => e.movement))}</td>
                  <td>{formatDecimal(avg((e) => e.roomTempC), 1, lang)} °C</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function NightReport({ night }: { night: SleepNight }) {
  const { t, lang } = useT();
  const sl = t.missionUi.sleep;
  const s = night.summary;
  const end = clockAt(s.bedtime, Math.round(s.inBedHours * 60));
  const tempOut = s.roomTempC < S.roomTemp.min || s.roomTempC > S.roomTemp.max;
  const brOut = s.breathingRate < S.breathingRate.min || s.breathingRate > S.breathingRate.max;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile
          icon={Moon}
          label={sl.tiles.sleep}
          value={`${formatDecimal(s.totalHours, 1, lang)} h`}
          sub={`${s.bedtime} → ${end} · ${sl.efficiencyPrefix} ${s.efficiency}%`}
          alert={
            s.totalHours < S.minHours
              ? sl.alerts.shortSleep
              : s.efficiency < S.minEfficiency
                ? sl.alerts.fragmented
                : undefined
          }
        />
        <Tile
          icon={Wind}
          label={sl.tiles.breathing}
          value={`${formatDecimal(s.breathingRate, 1, lang)} rpm`}
          sub={`${sl.normalPrefix} ${S.breathingRate.min}–${S.breathingRate.max} rpm`}
          alert={brOut ? sl.alerts.outOfRange : undefined}
        />
        <Tile
          icon={Activity}
          label={sl.tiles.pauses}
          value={`${formatDecimal(s.breathingPauses, 1, lang)} /h`}
          sub={`${sl.warnFromPrefix} ${S.maxBreathingPauses} /h`}
          alert={s.breathingPauses >= S.maxBreathingPauses ? sl.alerts.checkVent : undefined}
        />
        <Tile
          icon={Thermometer}
          label={sl.tiles.room}
          value={`${formatDecimal(s.roomTempC, 1, lang)} °C`}
          sub={`${sl.minPrefix} ${formatDecimal(s.roomTempMinC, 1, lang)} · ${sl.maxPrefix} ${formatDecimal(s.roomTempMaxC, 1, lang)} °C`}
          alert={tempOut ? `${sl.alerts.comfortablePrefix} ${S.roomTemp.min}–${S.roomTemp.max} °C` : undefined}
        />
        <Tile
          icon={RefreshCw}
          label={sl.tiles.movement}
          value={`${s.movementIndex}/100`}
          sub={`${s.awakenings} ${sl.awakeningsSuffix}`}
        />
        <Tile
          icon={BedDouble}
          label={sl.tiles.bedExits}
          value={`${s.outOfBed}`}
          sub={`${sl.latencyPrefix} ${s.latencyMin} min`}
        />
        <Tile icon={Ruler} label={sl.tiles.proximity} value={`${s.distanceCm} cm`} sub={sl.proximitySub} />
        <Tile icon={Moon} label={sl.tiles.phases} value={`${s.deepPct}% · ${s.remPct}%`} sub={sl.phasesSub} />
      </dl>
      <NightChart night={night} />
    </div>
  );
}

export function SleepSensorPanel({
  night,
  onSync,
}: {
  night: SleepNight | null;
  onSync: () => void;
}) {
  const { t } = useT();
  const s = t.missionUi.sleep;
  const [progress, setProgress] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    []
  );

  const sync = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const total = reduced ? 300 : 2400;
    const start = performance.now();
    setProgress(0);
    timer.current = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / total);
      setProgress(p);
      if (p >= 1) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setProgress(null);
        onSync();
      }
    }, 80);
  };

  const syncSteps = [s.syncSteps.s1, s.syncSteps.s2, s.syncSteps.s3];
  const syncing = progress !== null;
  const stepText = syncing
    ? syncSteps[Math.min(syncSteps.length - 1, Math.floor(progress * syncSteps.length))]
    : null;

  return (
    <section
      className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4"
      aria-label={s.title}
    >
      <div className="flex flex-wrap items-center gap-4">
        <Sonar active={syncing || !night} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-slate-100">{s.title}</p>
          <p className="text-xs text-slate-400 max-w-prose">{s.desc}</p>
          {syncing && (
            <div className="space-y-1 pt-1" role="status">
              <p className="text-xs text-cyan-300">{stepText}</p>
              <div className="h-1.5 w-full max-w-xs rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        {!syncing && (
          <button
            type="button"
            onClick={sync}
            className={
              night
                ? 'inline-flex items-center gap-2 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition cursor-pointer'
                : 'inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-cyan-400 transition cursor-pointer'
            }
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {night ? s.resyncBtn : s.syncBtn}
          </button>
        )}
      </div>

      {night && !syncing && <NightReport night={night} />}
    </section>
  );
}

export default SleepSensorPanel;
