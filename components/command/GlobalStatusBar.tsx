'use client';

import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Settings,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import type { ClinicalSnapshot } from '../../store/selectors';
import { useMissionStore } from '../../store/useMissionStore';
import { useOutboxStore } from '../../store/useOutboxStore';
import { useCommandUiStore } from '../../store/useCommandUiStore';
import type { AlertSeverity } from '../../types/telemetry';
import { missionDayOf, toDayKey } from '../../utils/missionPlan';
import { deriveOverallLevel, type SystemTileData } from '../../utils/nextAction';

const STATUS_STYLE: Record<AlertSeverity, string> = {
  OPTIMAL: 'border-ev-cyan/50 bg-ev-cyan/10 text-ev-cyan',
  WARNING: 'border-amber-500/70 bg-amber-500/15 text-amber-200',
  CRITICAL: 'border-red-500 bg-red-500/20 text-red-100',
};

export function GlobalStatusBar({
  snapshot,
  tiles,
}: {
  snapshot: ClinicalSnapshot;
  tiles: SystemTileData[];
}) {
  const { lang, t } = useT();
  const packets = useOutboxStore((s) => s.packets);
  const conjunctionBlackout = useOutboxStore((s) => s.conjunctionBlackout);
  const mission = useMissionStore((s) => s.mission);

  const setActiveTab = useCommandUiStore((s) => s.setActiveTab);
  const toggleDemoDrawer = useCommandUiStore((s) => s.toggleDemoDrawer);
  const demoDrawerOpen = useCommandUiStore((s) => s.demoDrawerOpen);

  const queuedCount = packets.filter((p) => p.status !== 'delivered').length;
  const isOffline = snapshot.simulateOffline || conjunctionBlackout;

  const missionLabel =
    snapshot.missionProfileId === 'LUNAR_ARTEMIS'
      ? t.common.moon
      : snapshot.missionProfileId === 'MARS_CONJUNCTION'
        ? t.common.mars
        : t.common.iss;

  // Latencia en el mismo formato que el copiloto: nominal + rango.
  const { oneWayLatencyNominalSec: nom, oneWayLatencySecMin: lo, oneWayLatencySecMax: hi } =
    snapshot.comms;
  const latencyText =
    nom >= 60
      ? `~${Math.round(nom / 60)} min (${Math.round(lo / 60)}–${Math.round(hi / 60)})`
      : `${nom.toLocaleString(lang, { maximumFractionDigits: 1 })} s`;

  const missionDay = mission ? missionDayOf(mission, toDayKey(new Date())) : null;

  // Mismo nivel que la cabecera de Hoy (motor + Código Rojo + mosaico).
  const level = deriveOverallLevel(snapshot, tiles);
  const severity: AlertSeverity =
    level === 'critical' ? 'CRITICAL' : level === 'warning' || level === 'watch' ? 'WARNING' : 'OPTIMAL';
  const StatusIcon =
    level === 'critical' ? AlertOctagon : level === 'nominal' ? CheckCircle2 : AlertTriangle;

  const statusWord =
    level === 'critical'
      ? t.common.critical
      : level === 'warning'
        ? t.common.warning
        : level === 'watch'
          ? `${t.common.green} · ${t.command.hero.counts.amber}`
          : t.common.green;

  return (
    <header
      aria-label={t.nav.sectionCommand}
      className="ev-glass flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-slate-900 px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {/* Global Status Pill: Icon + Word + Color */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider ${STATUS_STYLE[severity]}`}
        >
          <StatusIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span>{statusWord}</span>
        </span>

        {/* Active Mission & Day */}
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-200 font-semibold">
          <span>{missionLabel}</span>
          {missionDay !== null && (
            <span className="text-cyan-300 tabular-nums">
              · {t.missionUi.header.dayPrefix} {missionDay}
            </span>
          )}
        </span>

        {/* 1 Hz vs Manual Indicator */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase ${
            snapshot.isManualOverride
              ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
              : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
          }`}
        >
          {snapshot.isManualOverride ? (
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Radio className="h-3.5 w-3.5 shrink-0 motion-safe:animate-pulse" aria-hidden />
          )}
          <span>
            {snapshot.isManualOverride
              ? t.command.statusBar.manualMode
              : t.command.statusBar.live1Hz}
          </span>
        </span>

        {/* Visible DEMO badge whenever drawer open or manual override/scenario active */}
        {(demoDrawerOpen || snapshot.isManualOverride) && (
          <span className="inline-flex items-center rounded-lg border border-amber-400/60 bg-amber-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">
            {t.command.statusBar.demoModeActive}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
        {/* Earth Link Chip -> navigates to #tierra */}
        <button
          type="button"
          onClick={() => setActiveTab('tierra')}
          aria-label={t.command.statusBar.earthLinkAria}
          className={`min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center sm:justify-start gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer transition ${
            isOffline
              ? 'border-amber-500/70 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
              : 'border-slate-700 bg-slate-950/70 text-slate-200 hover:border-cyan-500/60 hover:text-cyan-200'
          }`}
        >
          {isOffline ? (
            <WifiOff className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          ) : (
            <Wifi className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
          )}
          <span className="hidden sm:inline">{t.command.statusBar.latencyLabel}:</span>
          <span className="tabular-nums">
            {isOffline
              ? t.command.statusBar.offlineTag
              : latencyText}
          </span>
          {queuedCount > 0 && (
            <span className="ml-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200 tabular-nums">
              {queuedCount} {t.command.statusBar.queuedSuffix}
            </span>
          )}
        </button>

        {/* Gear button for Demo Mode & God Mode */}
        <button
          type="button"
          onClick={toggleDemoDrawer}
          aria-expanded={demoDrawerOpen}
          aria-label={t.command.statusBar.demoGearAria}
          title={t.command.statusBar.demoGearAria}
          className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border cursor-pointer transition ${
            demoDrawerOpen
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500 hover:text-white'
          }`}
        >
          <Settings className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}
