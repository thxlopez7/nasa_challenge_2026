'use client';

import { AlertOctagon, AlertTriangle, CheckCircle2, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import type { ClinicalSnapshot } from '../../store/selectors';
import { deriveOverallLevel } from '../../utils/nextAction';
import type {
  NextActionRecommendation,
  SystemTileData,
  TileStatus,
  OverallLevel,
} from '../../utils/nextAction';
import { NextActionBanner } from './NextActionBanner';

type HeroLevel = OverallLevel;

const LEVEL_STYLE: Record<
  HeroLevel,
  { ring: string; glow: string; icon: LucideIcon; iconCls: string; title: string }
> = {
  nominal: {
    ring: 'border-ev-cyan/30',
    glow: 'from-ev-cyan/15',
    icon: CheckCircle2,
    iconCls: 'text-ev-cyan bg-ev-cyan/10 ring-ev-cyan/40',
    title: 'text-white',
  },
  watch: {
    ring: 'border-amber-400/30',
    glow: 'from-amber-500/12',
    icon: Eye,
    iconCls: 'text-amber-200 bg-amber-500/10 ring-amber-400/40',
    title: 'text-slate-50',
  },
  warning: {
    ring: 'border-amber-400/60',
    glow: 'from-amber-500/20',
    icon: AlertTriangle,
    iconCls: 'text-amber-200 bg-amber-500/15 ring-amber-400/60',
    title: 'text-amber-100',
  },
  critical: {
    ring: 'border-red-500/70',
    glow: 'from-red-500/25',
    icon: AlertOctagon,
    iconCls: 'text-red-200 bg-red-500/15 ring-red-400/70',
    title: 'text-red-100',
  },
};

const DOT: Record<TileStatus, string> = {
  green: 'bg-ev-cyan',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
  missing: 'bg-slate-500',
};

/**
 * Cabecera única de la pestaña Hoy: una sola lectura del estado (motor clínico
 * + vigilancia temprana del mosaico) y un único próximo paso.
 */
export function StatusHero({
  snapshot,
  tiles,
  recommendation,
}: {
  snapshot: ClinicalSnapshot;
  tiles: SystemTileData[];
  recommendation: NextActionRecommendation;
}) {
  const { t } = useT();
  const h = t.command.hero;

  const byStatus = (s: TileStatus) => tiles.filter((tile) => tile.status === s);
  const red = byStatus('red');
  const amber = byStatus('amber');
  const missing = byStatus('missing');
  const names = (list: SystemTileData[]) => list.map((x) => x.shortTitle).join(', ');

  const level: HeroLevel = deriveOverallLevel(snapshot, tiles);

  const title =
    level === 'critical'
      ? h.criticalTitle
      : level === 'warning'
        ? h.warningTitle
        : level === 'watch'
          ? h.watchTitle
          : h.nominalTitle;

  const detail =
    level === 'critical'
      ? h.criticalDetail(names(red.length ? red : amber))
      : level === 'warning'
        ? h.warningDetail(names(amber.length ? amber : red) || '—')
        : level === 'watch'
          ? h.watchDetail(amber.length, names(amber))
          : h.nominalDetail;

  const style = LEVEL_STYLE[level];
  const Icon = style.icon;
  const counts: Array<[TileStatus, number]> = [
    ['green', byStatus('green').length],
    ['amber', amber.length],
    ['red', red.length],
    ['missing', missing.length],
  ];

  return (
    <section
      aria-labelledby="status-hero-title"
      className={`ev-corners relative overflow-hidden rounded-2xl border ${style.ring} bg-[var(--cc-panel)]`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${style.glow} via-transparent to-transparent`}
      />
      <div className="relative grid gap-4 p-4 sm:gap-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <span
            className={`grid h-11 w-11 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-xl sm:rounded-2xl ring-1 ${style.iconCls}`}
          >
            <Icon className="h-5 w-5 sm:h-7 sm:w-7" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1 sm:space-y-1.5">
            <p className="cc-eyebrow">{h.eyebrow}</p>
            <h2
              id="status-hero-title"
              className={`text-xl sm:text-3xl font-semibold leading-tight ${style.title}`}
            >
              {title}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              {detail}
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 lg:flex-col lg:items-stretch" aria-label={t.command.mosaic.title}>
          {counts.map(([status, n]) => (
            <li
              key={status}
              className={`flex items-center gap-2 rounded-lg border border-[var(--cc-line)] bg-black/20 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm ${
                n === 0 ? 'opacity-45' : ''
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[status]}`} aria-hidden />
              <span className="cc-num text-sm sm:text-base font-semibold text-slate-50 w-4 sm:w-5 text-right">{n}</span>
              <span className="text-slate-400 truncate">{h.counts[status]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative border-t border-[var(--cc-line)] bg-black/20 px-4 py-3 sm:px-6">
        <NextActionBanner recommendation={recommendation} embedded label={h.nextLabel} />
      </div>
    </section>
  );
}
