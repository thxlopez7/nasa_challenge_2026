'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardPlus,
  Clock,
  MinusCircle,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';
import { INDICATORS_EN } from '../../content/indicators.en';
import { INDICATORS_ES } from '../../content/indicators.es';
import { useT } from '../../i18n/I18nContext';
import {
  type CommandSystemId,
  useCommandUiStore,
} from '../../store/useCommandUiStore';
import { useMissionStore } from '../../store/useMissionStore';
import type { DayRecord } from '../../types/mission';
import { computeNlr } from '../../utils/clinicalEngine';
import {
  formatDecimal,
  formatNumber,
  formatRelativeAgeHours,
} from '../../utils/formatters';
import type { SystemTileData, TileStatus } from '../../utils/nextAction';
import RuleTrace from '../RuleTrace';

const GUIDE_MAP = {
  es: INDICATORS_ES,
  en: INDICATORS_EN,
} as const;

const STATUS_BADGE: Record<TileStatus, { className: string }> = {
  green: {
    className:
      'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
  },
  amber: {
    className: 'bg-amber-500/20 text-amber-200 border border-amber-500/50',
  },
  red: {
    className: 'bg-red-500/25 text-red-100 border border-red-400/60',
  },
  missing: {
    className: 'bg-slate-800 text-slate-300 border border-slate-700',
  },
};

function StatusIcon({ status }: { status: TileStatus }) {
  if (status === 'red') return <AlertOctagon className="h-3.5 w-3.5" aria-hidden />;
  if (status === 'amber') return <AlertTriangle className="h-3.5 w-3.5" aria-hidden />;
  if (status === 'missing') return <MinusCircle className="h-3.5 w-3.5" aria-hidden />;
  return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />;
}

interface TrendPoint {
  day: number;
  value: number;
}

function extractMetricValue(
  systemId: CommandSystemId,
  record: DayRecord
): number | null {
  const v = record.vitals;
  switch (systemId) {
    case 'cardio':
      return typeof v?.heartRate === 'number' ? v.heartRate : null;
    case 'cabin':
      return typeof v?.co2Level === 'number' ? v.co2Level : null;
    case 'radiation':
      return typeof v?.radiationRate === 'number' ? v.radiationRate : null;
    case 'renal':
      return typeof v?.cistatinaC === 'number' ? v.cistatinaC : null;
    case 'immune': {
      if (!v) return null;
      const nlr = computeNlr(v);
      return Number.isFinite(nlr) ? nlr : null;
    }
    case 'bone':
      return typeof v?.ctxNtxIndex === 'number' ? v.ctxNtxIndex : null;
    case 'metabolic':
      return typeof v?.glucoseMgDl === 'number' ? v.glucoseMgDl : null;
    case 'neural':
      if (typeof v?.behavioralCheckIn?.behavioralRiskIndex === 'number') {
        return v.behavioralCheckIn.behavioralRiskIndex;
      }
      if (typeof record.selfReport?.mood === 'number') {
        return record.selfReport.mood;
      }
      return null;
  }
}

export function SystemDetailDrawer({ tiles }: { tiles: SystemTileData[] }) {
  const { lang, t } = useT();
  const selectedSystemId = useCommandUiStore((s) => s.selectedSystemId);
  const focusGuideOnOpen = useCommandUiStore((s) => s.focusGuideOnOpen);
  const closeSystemDrawer = useCommandUiStore((s) => s.closeSystemDrawer);
  const openLogSection = useCommandUiStore((s) => s.openLogSection);
  const records = useMissionStore((s) => s.records);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const guideSectionRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const tile = useMemo(
    () => tiles.find((item) => item.id === selectedSystemId) ?? null,
    [tiles, selectedSystemId]
  );

  const trendPoints = useMemo<TrendPoint[]>(() => {
    if (!selectedSystemId) return [];
    const sorted = Object.values(records).sort(
      (a, b) => a.missionDay - b.missionDay
    );
    const tail = sorted.slice(-7);
    const pts: TrendPoint[] = [];
    for (const rec of tail) {
      const val = extractMetricValue(selectedSystemId, rec);
      if (val !== null) {
        pts.push({ day: rec.missionDay, value: val });
      }
    }
    return pts;
  }, [records, selectedSystemId]);

  useEffect(() => {
    if (!tile) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const timer = window.setTimeout(() => {
      if (focusGuideOnOpen && guideSectionRef.current) {
        guideSectionRef.current.focus();
        guideSectionRef.current.scrollIntoView({ block: 'start' });
      } else {
        closeBtnRef.current?.focus();
      }
    }, 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSystemDrawer();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [tile, focusGuideOnOpen, closeSystemDrawer]);

  if (!tile) return null;

  const guide = GUIDE_MAP[lang][tile.guideId];
  const statusWord = t.command.mosaic.statuses[tile.status];

  const sparkline = (() => {
    if (trendPoints.length < 2) return null;
    const width = 260;
    const height = 56;
    const pad = 6;
    const vals = trendPoints.map((p) => p.value);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const span = maxVal - minVal || 1;
    const coords = trendPoints.map((p, idx) => {
      const x =
        pad + (idx / (trendPoints.length - 1)) * (width - pad * 2);
      const y =
        height - pad - ((p.value - minVal) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { width, height, pointsAttr: coords.join(' ') };
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSystemDrawer();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-drawer-title"
        className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-[100dvh] overflow-y-auto shadow-2xl flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${STATUS_BADGE[tile.status].className}`}
              >
                <StatusIcon status={tile.status} />
                <span>{statusWord}</span>
              </span>
              {tile.isStale && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                  <Clock className="h-3 w-3" aria-hidden />
                  <span>{t.command.mosaic.staleTag}</span>
                </span>
              )}
            </div>
            <h2
              id="system-drawer-title"
              className="text-lg font-bold text-slate-100 mt-1 truncate"
            >
              {tile.title}
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={closeSystemDrawer}
            aria-label={t.command.drawer.closeAria}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer shrink-0 transition"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* 1. Valor actual y frescura */}
          <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                  {t.command.drawer.currentValueTitle}
                </p>
                <p className="text-3xl font-bold text-slate-100 mt-1">
                  {tile.primaryValue}
                  {tile.unit ? (
                    <span className="text-sm font-normal text-slate-400 ml-1.5">
                      {tile.unit}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {tile.secondarySummary}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openLogSection(tile.logSection)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-3.5 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer transition"
              >
                <ClipboardPlus className="h-4 w-4" aria-hidden />
                <span>{t.command.drawer.logNewBtn}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>
                <strong className="text-slate-300">
                  {t.command.drawer.freshnessTitle}:
                </strong>{' '}
                {tile.staleAgeHours !== null
                  ? formatRelativeAgeHours(tile.staleAgeHours, lang)
                  : t.command.mosaic.noReading}
              </span>
              <span>·</span>
              <span>
                <strong className="text-slate-300">
                  {t.command.drawer.sourceLabel}:
                </strong>{' '}
                {tile.sourceLabel}
              </span>
            </div>
          </section>

          {/* 2. Tendencia de 7 días */}
          <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <TrendingUp className="h-4 w-4" aria-hidden />
              <h3>{t.command.drawer.trend7dTitle}</h3>
            </div>

            {sparkline ? (
              <div className="space-y-2">
                <svg
                  viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                  className="w-full h-14 overflow-visible"
                  role="img"
                  aria-label={t.command.drawer.trend7dTitle}
                >
                  <polyline
                    fill="none"
                    stroke="rgb(34 211 238)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparkline.pointsAttr}
                  />
                </svg>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-center">
                  {trendPoints.map((pt) => (
                    <div
                      key={pt.day}
                      className="rounded border border-slate-800 bg-slate-900/90 px-1.5 py-1"
                    >
                      <p className="text-[10px] text-slate-400">
                        D{formatNumber(pt.day, lang)}
                      </p>
                      <p className="text-xs font-semibold text-slate-200 font-mono">
                        {formatDecimal(pt.value, 1, lang)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                {t.command.drawer.trendEmpty}
              </p>
            )}
          </section>

          {/* 3. ¿Por qué alerta o regla? */}
          <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              {t.command.drawer.whyTitle}
            </h3>

            {tile.relatedTraces.length > 0 ? (
              <RuleTrace traces={tile.relatedTraces} />
            ) : (
              <p className="text-xs text-slate-400">
                {t.command.drawer.noRulesForSystem} ·{' '}
                {t.command.drawer.allNominal}
              </p>
            )}
          </section>

          {/* 4. Guía "¿Qué mide / Cómo / Cuándo preocuparse?" */}
          <section
            ref={guideSectionRef}
            tabIndex={-1}
            className="rounded-xl border border-cyan-500/30 bg-slate-950/80 p-4 space-y-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                <BookOpen className="h-4 w-4" aria-hidden />
                <h3>{t.command.drawer.guideTitle}</h3>
              </div>

              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  guide.verified
                    ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {guide.verified
                  ? t.command.drawer.verifiedBadge
                  : t.command.drawer.prototypeBadge}
              </span>
            </div>

            <p className="text-sm font-semibold text-slate-100">
              {guide.title}{' '}
              <span className="text-xs font-normal text-slate-400">
                ({t.command.drawer.unitsLabel}: {guide.unit})
              </span>
            </p>

            <dl className="space-y-2.5 text-xs">
              <div>
                <dt className="font-bold text-slate-300">
                  {t.command.drawer.whatMeasures}
                </dt>
                <dd className="text-slate-400 mt-0.5">
                  {guide.whatItMeasures}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-300">
                  {t.command.drawer.whySpace}
                </dt>
                <dd className="text-slate-400 mt-0.5">{guide.whyInSpace}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-300">
                  {t.command.drawer.howMeasure}
                </dt>
                <dd className="text-slate-400 mt-0.5">{guide.howToMeasure}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-300">
                  {t.command.drawer.refRange}
                </dt>
                <dd className="text-slate-400 mt-0.5">
                  {guide.referenceRange}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-amber-300">
                  {t.command.drawer.whenWorry}
                </dt>
                <dd className="text-slate-300 mt-0.5">{guide.whenToWorry}</dd>
              </div>
              <div>
                <dt className="font-bold text-red-300">
                  {t.command.drawer.whenEscalate}
                </dt>
                <dd className="text-slate-300 mt-0.5">
                  {guide.whenToEscalate}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-emerald-300">
                  {t.command.drawer.prevention}
                </dt>
                <dd className="text-slate-300 mt-0.5">{guide.prevention}</dd>
              </div>
            </dl>

            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
              {t.command.drawer.protocolTitle}: {guide.sourceNote}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SystemDetailDrawer;
