'use client';

import { STATUS_STYLE, type EvStatus } from './StatusBadge';

/**
 * Barra de progreso segmentada con marcas de umbral. El color sigue al
 * estado; las marcas de precaución y crítico se dibujan sobre la pista.
 */
export function ProgressBar({
  value,
  min = 0,
  max = 100,
  status = 'nominal',
  label,
  valueText,
  cautionAt,
  criticalAt,
  segments = 24,
  loading = false,
}: {
  value: number;
  min?: number;
  max?: number;
  status?: EvStatus;
  label?: string;
  /** Texto del valor (p. ej. «82 %»); por defecto el valor numérico */
  valueText?: string;
  cautionAt?: number;
  criticalAt?: number;
  segments?: number;
  loading?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const filled = Math.round(pct * segments);
  const s = STATUS_STYLE[status];
  const mark = (v?: number) => (v === undefined ? undefined : `${((v - min) / (max - min)) * 100}%`);

  return (
    <div className="space-y-1.5">
      {(label || valueText) && (
        <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          <span className="text-ev-label">{label}</span>
          <span className={`tabular-nums ${s.text}`}>{valueText ?? value}</span>
        </div>
      )}
      <div
        className="relative"
        role="progressbar"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        aria-busy={loading || undefined}
      >
        {loading ? (
          <div className="ev-skeleton h-2.5 rounded-sm" />
        ) : (
          <div className="flex h-2.5 gap-[2px]">
            {Array.from({ length: segments }, (_, i) => (
              <span
                key={i}
                className="flex-1 rounded-[1px] transition-colors duration-300"
                style={{
                  background: i < filled ? s.hex : 'rgba(42, 58, 94, 0.6)',
                  boxShadow: i === filled - 1 ? `0 0 8px ${s.hex}` : undefined,
                }}
              />
            ))}
          </div>
        )}
        {[{ at: mark(cautionAt), c: '#FFB703' }, { at: mark(criticalAt), c: '#FF3B4E' }].map(
          (m, i) => m.at && <span key={i} className="absolute -top-1 h-[18px] w-px" style={{ left: m.at, background: m.c }} aria-hidden />
        )}
      </div>
    </div>
  );
}

export default ProgressBar;
