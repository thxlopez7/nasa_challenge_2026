'use client';

import { useT } from '../../i18n/I18nContext';
import { IconAlert, IconCheck, IconOctagon } from './icons';

/** Estado operativo de un sistema o lectura. */
export type EvStatus = 'nominal' | 'caution' | 'critical';

/** Color, forma e icono de cada estado: nunca se distingue solo por color. */
export const STATUS_STYLE: Record<EvStatus, { text: string; border: string; bg: string; hex: string; Icon: typeof IconCheck }> = {
  nominal: { text: 'text-ev-cyan', border: 'border-ev-cyan/40', bg: 'bg-ev-cyan/10', hex: '#00E5FF', Icon: IconCheck },
  caution: { text: 'text-ev-amber', border: 'border-ev-amber/50', bg: 'bg-ev-amber/10', hex: '#FFB703', Icon: IconAlert },
  critical: { text: 'text-ev-red', border: 'border-ev-red/60', bg: 'bg-ev-red/15', hex: '#FF3B4E', Icon: IconOctagon },
};

/** Pastilla de estado: icono + etiqueta (+ punto que late si `live`). */
export function StatusBadge({
  status,
  label,
  live = false,
  size = 'md',
}: {
  status: EvStatus;
  /** Texto propio; por defecto el nombre del estado en el idioma activo */
  label?: string;
  live?: boolean;
  size?: 'sm' | 'md';
}) {
  const { t } = useT();
  const s = STATUS_STYLE[status];
  const Icon = s.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-mono uppercase tracking-[0.14em] ${s.text} ${s.border} ${s.bg} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
      } ${status === 'critical' && live ? 'vital-crisis' : ''}`}
    >
      {live ? (
        <span className="ev-dot-live h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      ) : (
        <Icon size={size === 'sm' ? 12 : 14} />
      )}
      {label ?? t.ui.status[status]}
    </span>
  );
}

export default StatusBadge;
