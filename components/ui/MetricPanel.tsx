'use client';

import type { ReactNode } from 'react';
import { useT } from '../../i18n/I18nContext';
import MiniChart, { type ChartPoint } from '../vitals/MiniChart';
import ProgressBar from './ProgressBar';
import StatusBadge, { STATUS_STYLE, type EvStatus } from './StatusBadge';

const TONE = { nominal: 'ok', caution: 'warn', critical: 'crit' } as const;

/**
 * Panel de métrica biométrica: código y nombre, valor grande, estado, cambio
 * reciente, rango (barra con umbrales) y tendencia de la sesión.
 */
export function MetricPanel({
  code,
  label,
  icon,
  value,
  unit,
  digits = 0,
  status,
  delta,
  range,
  trend,
  threshold,
  footnote,
  loading = false,
}: {
  code?: string;
  label: string;
  icon?: ReactNode;
  value: number;
  unit: string;
  digits?: number;
  status: EvStatus;
  /** Texto de cambio, p. ej. «▲ +4 lpm en 30 s» */
  delta?: string;
  range?: { min: number; max: number; cautionAt?: number; criticalAt?: number };
  trend?: ChartPoint[];
  threshold?: number;
  footnote?: string;
  loading?: boolean;
}) {
  const { t } = useT();
  const s = STATUS_STYLE[status];
  return (
    <article
      className={`ev-glass rounded-lg p-4 space-y-3 transition-colors ${status === 'critical' ? 'border-ev-red/70! vital-crisis' : status === 'caution' ? 'border-ev-amber/50!' : ''}`}
      aria-busy={loading || undefined}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className={s.text}>{icon}</span>}
          <div className="min-w-0">
            {code && <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-ev-label/80">{code}</p>}
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-ev-label">{label}</p>
          </div>
        </div>
        <StatusBadge status={status} size="sm" />
      </header>

      {loading ? (
        <div className="space-y-2">
          <div className="ev-skeleton h-9 w-2/3 rounded" />
          <div className="ev-skeleton h-10 w-full rounded" />
        </div>
      ) : (
        <>
          <p className="flex items-baseline gap-1.5">
            <span className="text-4xl font-thin tabular-nums text-white">{value.toFixed(digits)}</span>
            <span className="font-mono text-xs text-ev-label">{unit}</span>
          </p>
          {delta && <p className={`font-mono text-[11px] ${s.text}`}>{delta}</p>}
          {range && (
            <ProgressBar
              value={value}
              min={range.min}
              max={range.max}
              cautionAt={range.cautionAt}
              criticalAt={range.criticalAt}
              status={status}
              label={t.ui.range}
              valueText={`${range.min}–${range.max} ${unit}`}
              segments={20}
            />
          )}
          {trend && trend.length > 0 && (
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ev-label">{t.ui.sessionTrend}</p>
              <MiniChart
                points={trend}
                tone={TONE[status]}
                threshold={threshold}
                unit={unit}
                digits={digits}
                height={48}
                live
                area
                ariaLabel={`${label}: ${t.ui.sessionTrend}`}
                waitingText={t.ui.loading}
              />
            </div>
          )}
          {footnote && <p className="font-mono text-[10px] text-ev-label/80">{footnote}</p>}
        </>
      )}
    </article>
  );
}

export default MetricPanel;
