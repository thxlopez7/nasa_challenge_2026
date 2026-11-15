'use client';

import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Bone,
  Brain,
  CheckCircle2,
  Droplets,
  Flame,
  HelpCircle,
  MinusCircle,
  Radiation,
  Shield,
  Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import {
  type CommandSystemId,
  useCommandUiStore,
} from '../../store/useCommandUiStore';
import type { SystemTileData, TileStatus } from '../../utils/nextAction';

const SYSTEM_ICON: Record<CommandSystemId, LucideIcon> = {
  cardio: Activity,
  cabin: Wind,
  radiation: Radiation,
  renal: Droplets,
  immune: Shield,
  bone: Bone,
  metabolic: Flame,
  neural: Brain,
};

const TILE_STYLE: Record<
  TileStatus,
  { border: string; badge: string; StatusIcon: LucideIcon; labelClass: string; bar: string }
> = {
  green: {
    bar: 'bg-emerald-400/70',
    border: 'border-[var(--cc-line)] hover:border-emerald-400/50 bg-[var(--cc-panel)]',
    badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
    StatusIcon: CheckCircle2,
    labelClass: 'text-emerald-300',
  },
  amber: {
    bar: 'bg-amber-400',
    border: 'border-amber-400/35 hover:border-amber-300/70 bg-[var(--cc-panel)]',
    badge: 'bg-amber-500/20 text-amber-200 border border-amber-500/50',
    StatusIcon: AlertTriangle,
    labelClass: 'text-amber-300',
  },
  red: {
    bar: 'bg-red-500',
    border: 'border-red-500/70 hover:border-red-400 bg-red-950/30',
    badge: 'bg-red-500/25 text-red-100 border border-red-400/60',
    StatusIcon: AlertOctagon,
    labelClass: 'text-red-300',
  },
  missing: {
    bar: 'bg-slate-600',
    border: 'border-[var(--cc-line)] border-dashed hover:border-slate-500 bg-[var(--cc-panel)]/60',
    badge: 'bg-slate-800 text-slate-300 border border-slate-700',
    StatusIcon: MinusCircle,
    labelClass: 'text-slate-400',
  },
};

export function SystemMosaic({ tiles }: { tiles: SystemTileData[] }) {
  const { t } = useT();
  const openSystemDrawer = useCommandUiStore((s) => s.openSystemDrawer);

  return (
    <section aria-labelledby="system-mosaic-title" className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id="system-mosaic-title" className="cc-eyebrow">
          {t.command.mosaic.title}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile) => {
          const Icon = SYSTEM_ICON[tile.id];
          const style = TILE_STYLE[tile.status];
          const StatusIcon = style.StatusIcon;
          const statusWord = t.command.mosaic.statuses[tile.status];

          return (
            <div
              key={tile.id}
              className={`group relative overflow-hidden rounded-xl border p-4 pt-[18px] transition flex flex-col justify-between gap-3 ${style.border}`}
            >
              <span aria-hidden className={`absolute inset-x-0 top-0 h-[3px] ${style.bar}`} />
              <div className="flex items-start justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => openSystemDrawer(tile.id, false)}
                  aria-label={`${t.command.mosaic.openDetailAria} ${tile.title}`}
                  className="min-h-[44px] flex-1 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md -m-1 p-1"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <Icon className={`h-4 w-4 shrink-0 ${style.labelClass}`} aria-hidden />
                    <span className="truncate">{tile.shortTitle}</span>
                  </div>

                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="cc-num text-3xl font-medium text-white leading-none">
                      {tile.primaryValue}
                    </span>
                    {tile.unit && (
                      <span className="text-sm text-slate-400">{tile.unit}</span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => openSystemDrawer(tile.id, true)}
                  aria-label={`${t.command.mosaic.guideButtonAria}: ${tile.title}`}
                  title={t.command.mosaic.guideButtonAria}
                  className="min-h-[44px] min-w-[44px] -mr-1.5 -mt-1.5 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 cursor-pointer transition"
                >
                  <HelpCircle className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs border-t border-[var(--cc-line)] pt-2.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${style.badge}`}
                >
                  <StatusIcon className="h-3 w-3 shrink-0" aria-hidden />
                  <span>{statusWord}</span>
                </span>

                <span className="text-slate-400 truncate tabular-nums">
                  {tile.isStale && tile.status !== 'missing'
                    ? `${t.command.mosaic.staleTag}`
                    : tile.secondarySummary}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
