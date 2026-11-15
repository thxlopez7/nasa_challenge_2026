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
  { border: string; badge: string; StatusIcon: LucideIcon; labelClass: string }
> = {
  green: {
    border: 'border-emerald-500/35 hover:border-emerald-400/70 bg-slate-900/90',
    badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
    StatusIcon: CheckCircle2,
    labelClass: 'text-emerald-300',
  },
  amber: {
    border: 'border-amber-500/70 hover:border-amber-400 bg-amber-950/20',
    badge: 'bg-amber-500/20 text-amber-200 border border-amber-500/50',
    StatusIcon: AlertTriangle,
    labelClass: 'text-amber-300',
  },
  red: {
    border: 'border-red-500 hover:border-red-400 bg-red-950/30',
    badge: 'bg-red-500/25 text-red-100 border border-red-400/60',
    StatusIcon: AlertOctagon,
    labelClass: 'text-red-300',
  },
  missing: {
    border: 'border-slate-700/80 border-dashed hover:border-slate-500 bg-slate-900/60',
    badge: 'bg-slate-800 text-slate-300 border border-slate-700',
    StatusIcon: MinusCircle,
    labelClass: 'text-slate-400',
  },
};

export function SystemMosaic({ tiles }: { tiles: SystemTileData[] }) {
  const { t } = useT();
  const openSystemDrawer = useCommandUiStore((s) => s.openSystemDrawer);

  return (
    <section aria-labelledby="system-mosaic-title" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="system-mosaic-title"
          className="text-xs font-bold uppercase tracking-wider text-cyan-400"
        >
          {t.command.mosaic.title}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {tiles.map((tile) => {
          const Icon = SYSTEM_ICON[tile.id];
          const style = TILE_STYLE[tile.status];
          const StatusIcon = style.StatusIcon;
          const statusWord = t.command.mosaic.statuses[tile.status];

          return (
            <div
              key={tile.id}
              className={`relative rounded-xl border p-3 transition flex flex-col justify-between gap-1.5 ${style.border}`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => openSystemDrawer(tile.id, false)}
                  aria-label={`${t.command.mosaic.openDetailAria} ${tile.title}`}
                  className="min-h-[44px] flex-1 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md -m-1 p-1"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${style.labelClass}`} aria-hidden />
                    <span className="truncate">{tile.shortTitle}</span>
                  </div>

                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-bold text-slate-100 tabular-nums leading-none">
                      {tile.primaryValue}
                    </span>
                    {tile.unit && (
                      <span className="text-[11px] text-slate-400">{tile.unit}</span>
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

              <div className="flex items-center justify-between gap-1.5 text-[10px]">
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold uppercase ${style.badge}`}
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
