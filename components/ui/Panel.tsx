'use client';

import type { ReactNode } from 'react';
import { useT } from '../../i18n/I18nContext';
import StatusBadge, { type EvStatus } from './StatusBadge';

/**
 * Tarjeta contenedora EXOVITALS: superficie de cristal, esquinas técnicas y
 * cabecera con código de sistema, título, subtítulo, estado y acciones.
 * Con `loading` muestra el barrido de adquisición en lugar del contenido.
 */
export function Panel({
  code,
  title,
  subtitle,
  status,
  statusLabel,
  icon,
  actions,
  loading = false,
  children,
  className = '',
  as: Tag = 'section',
}: {
  /** Código técnico corto, p. ej. «SYS-04 · RAD» */
  code?: string;
  title: string;
  subtitle?: string;
  status?: EvStatus;
  statusLabel?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  const { t } = useT();
  return (
    <Tag className={`ev-glass ev-corners rounded-xl p-4 sm:p-5 text-white ${className}`} aria-busy={loading || undefined}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-ev-line/70 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ev-cyan/30 bg-ev-cyan/5 text-ev-cyan">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            {code && <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ev-cyan/80">{code}</p>}
            <h3 className="text-lg font-black leading-tight text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 font-mono text-xs text-ev-label">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && <StatusBadge status={status} label={statusLabel} live={status !== 'nominal'} />}
          {actions}
        </div>
      </header>
      {loading ? (
        <div className="space-y-2.5" role="status">
          <span className="sr-only">{t.ui.loading}</span>
          <div className="ev-skeleton h-8 w-1/2 rounded" />
          <div className="ev-skeleton h-3 w-full rounded" />
          <div className="ev-skeleton h-3 w-5/6 rounded" />
          <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ev-label">{t.ui.loading}</p>
        </div>
      ) : (
        children
      )}
    </Tag>
  );
}

export default Panel;
