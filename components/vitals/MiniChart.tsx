'use client';

import { useId, useState } from 'react';

export interface ChartPoint {
  /** Texto para el tooltip (hora, día…) */
  label: string;
  y: number;
}

const COLOR = { ok: '#22d3ee', warn: '#f59e0b', crit: '#ef4444' } as const;
export type ChartTone = keyof typeof COLOR;

/**
 * Línea compacta con umbral, último punto destacado y lectura al pasar el
 * cursor. `live` marca el último punto como lectura en vivo (con halo).
 */
export function MiniChart({
  points,
  tone,
  threshold,
  thresholdLabel,
  unit,
  digits,
  height = 56,
  live = false,
  area = false,
  domain,
  ariaLabel,
  waitingText = '…',
}: {
  points: ChartPoint[];
  tone: ChartTone;
  threshold?: number;
  thresholdLabel?: string;
  unit: string;
  digits: number;
  height?: number;
  live?: boolean;
  area?: boolean;
  /** Rango fijo del eje vertical (si no, se ajusta a los datos y al umbral) */
  domain?: [number, number];
  ariaLabel: string;
  /** Texto mientras no hay lecturas */
  waitingText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  const W = 240;
  const H = height;
  const PAD = 6;

  if (points.length === 0) {
    return <div style={{ height }} className="flex items-center text-xs text-slate-600">{waitingText}</div>;
  }

  const ys = points.map((p) => p.y);
  let lo = domain ? domain[0] : Math.min(...ys, threshold ?? Infinity);
  let hi = domain ? domain[1] : Math.max(...ys, threshold ?? -Infinity);
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  if (!domain) {
    lo -= span * 0.12;
    hi += span * 0.12;
  }
  const x = (i: number) => (points.length === 1 ? W - PAD : PAD + (i / (points.length - 1)) * (W - PAD * 2));
  const y = (v: number) => PAD + (1 - (v - lo) / (hi - lo)) * (H - PAD * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  const h = hover !== null ? points[hover] : null;
  const color = COLOR[tone];

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - PAD) / (W - PAD * 2)) * (points.length - 1));
    setHover(Math.max(0, Math.min(last, i)));
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label={ariaLabel}>
        {area && (
          <>
            <defs>
              <linearGradient id={`a-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.28" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${path} L${x(last).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`} fill={`url(#a-${gid})`} />
          </>
        )}
        {threshold !== undefined && threshold >= lo && threshold <= hi && (
          <line x1={0} x2={W} y1={y(threshold)} y2={y(threshold)} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        )}
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        )}
        <rect x={0} y={0} width={W} height={H} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {/* Puntos en HTML para que no se deformen con el SVG estirado */}
      <span
        className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 ${live ? 'vital-live' : ''}`}
        style={{ left: `${(x(last) / W) * 100}%`, top: `${(y(points[last].y) / H) * 100}%`, background: color, ['--live' as string]: color }}
        aria-hidden
      />
      {h && hover !== null && (
        <span
          className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.y) / H) * 100}%` }}
          aria-hidden
        />
      )}
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute -top-9 z-10 whitespace-nowrap rounded-md border border-slate-700 bg-slate-900/95 px-2 py-1 text-xs"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 50px), calc(100% - 100px))` }}
        >
          <span className="text-slate-400">{h.label}</span>{' '}
          <span className="font-black tabular-nums text-slate-100">{h.y.toFixed(digits)} {unit}</span>
        </div>
      )}
      {thresholdLabel && <span className="sr-only">Umbral: {thresholdLabel}</span>}
    </div>
  );
}

export default MiniChart;
