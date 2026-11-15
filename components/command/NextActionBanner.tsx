'use client';

import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardEdit,
} from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { useCommandUiStore } from '../../store/useCommandUiStore';
import type { ActionUrgency, NextActionRecommendation } from '../../utils/nextAction';

const BANNER_STYLE: Record<
  ActionUrgency,
  { wrap: string; badge: string; cta: string; badgeKey: keyof ReturnType<typeof useT>['t']['command']['nextAction'] }
> = {
  critical: {
    wrap: 'border-red-500 bg-red-950/50 text-red-100',
    badge: 'bg-red-500/25 text-red-200 border border-red-400/50',
    cta: 'bg-red-500 hover:bg-red-400 text-slate-950',
    badgeKey: 'urgencyCritical',
  },
  warning: {
    wrap: 'border-amber-500/80 bg-amber-950/35 text-amber-100',
    badge: 'bg-amber-500/20 text-amber-200 border border-amber-400/50',
    cta: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
    badgeKey: 'urgencyWarning',
  },
  due: {
    wrap: 'border-cyan-500/60 bg-cyan-950/30 text-slate-100',
    badge: 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40',
    cta: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950',
    badgeKey: 'urgencyDue',
  },
  routine: {
    wrap: 'border-cyan-500/40 bg-slate-900 text-slate-100',
    badge: 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30',
    cta: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950',
    badgeKey: 'urgencyRoutine',
  },
  nominal: {
    wrap: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-100',
    badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40',
    cta: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
    badgeKey: 'urgencyNominal',
  },
};

export function NextActionBanner({
  recommendation,
}: {
  recommendation: NextActionRecommendation;
}) {
  const { t } = useT();
  const setActiveTab = useCommandUiStore((s) => s.setActiveTab);
  const openLogSection = useCommandUiStore((s) => s.openLogSection);
  const openSystemDrawer = useCommandUiStore((s) => s.openSystemDrawer);
  const setShowFullPanelInEmergency = useCommandUiStore(
    (s) => s.setShowFullPanelInEmergency
  );

  const style = BANNER_STYLE[recommendation.urgency];
  const Icon =
    recommendation.urgency === 'critical'
      ? AlertOctagon
      : recommendation.urgency === 'warning'
        ? AlertTriangle
        : recommendation.urgency === 'due'
          ? ClipboardEdit
          : recommendation.urgency === 'routine'
            ? CalendarCheck
            : CheckCircle2;

  const handleAction = () => {
    if (recommendation.openEmergencyCard) {
      setShowFullPanelInEmergency(false);
      setActiveTab('hoy');
      return;
    }
    if (recommendation.targetSystemId) {
      setActiveTab('hoy');
      openSystemDrawer(recommendation.targetSystemId, false);
      return;
    }
    if (recommendation.targetLogSection) {
      openLogSection(recommendation.targetLogSection);
      return;
    }
    setActiveTab(recommendation.targetTab);
  };

  return (
    <section
      aria-label={t.command.nextAction.label}
      className={`rounded-xl border px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 ${style.wrap}`}
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        <Icon className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" aria-hidden />
        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${style.badge}`}
          >
            {t.command.nextAction[style.badgeKey]}
          </span>
          <p className="text-xs sm:text-sm font-semibold leading-snug truncate">
            {recommendation.title}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAction}
        className={`min-h-[44px] shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer transition ${style.cta}`}
      >
        <span>{recommendation.ctaLabel}</span>
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </section>
  );
}
