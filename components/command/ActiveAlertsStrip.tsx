'use client';

import {
  AlertOctagon,
  AlertTriangle,
  FileText,
  HelpCircle,
} from 'lucide-react';
import type { RuleEvaluationTrace } from '../../config/rules';
import { useT } from '../../i18n/I18nContext';
import { useCommandUiStore } from '../../store/useCommandUiStore';
import { formatNumber } from '../../utils/formatters';
import { mapRuleToSystemId } from '../../utils/nextAction';

export function ActiveAlertsStrip({
  traces,
  onOpenSbar,
}: {
  traces: RuleEvaluationTrace[];
  onOpenSbar: () => void;
}) {
  const { lang, t } = useT();
  const openSystemDrawer = useCommandUiStore((s) => s.openSystemDrawer);

  const activeTraces = traces.filter((tr) => tr.triggered);

  // Sin reglas disparadas: la cabecera de estado ya lo dice.
  if (activeTraces.length === 0) return null;

  const hasCritical = activeTraces.some(
    (tr) => tr.configuredSeverity === 'CRITICAL'
  );
  const visible = activeTraces.slice(0, 3);
  const overflowCount = Math.max(0, activeTraces.length - 3);

  return (
    <section
      aria-label={t.command.alertsStrip.activeAlertsTitle}
      className={`rounded-xl border px-3.5 py-2.5 flex flex-col justify-between gap-2 ${
        hasCritical
          ? 'border-red-500/75 bg-red-950/25'
          : 'border-amber-500/70 bg-amber-950/20'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {hasCritical ? (
            <AlertOctagon className="h-4 w-4 text-red-300 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle
              className="h-4 w-4 text-amber-300 shrink-0"
              aria-hidden
            />
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
            {t.command.alertsStrip.activeAlertsTitle}
          </span>
          <span
            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              hasCritical
                ? 'bg-red-500/20 text-red-200 border-red-500/50'
                : 'bg-amber-500/20 text-amber-200 border-amber-500/50'
            }`}
          >
            {formatNumber(activeTraces.length, lang)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              openSystemDrawer(mapRuleToSystemId(activeTraces[0].ruleId), false)
            }
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 cursor-pointer transition"
          >
            <HelpCircle className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
            <span>{t.command.alertsStrip.whyBtn}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSbar}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/15 hover:bg-cyan-500/25 px-3 py-1.5 text-xs font-semibold text-cyan-100 cursor-pointer transition"
          >
            <FileText className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
            <span>{t.command.alertsStrip.sbarBtn}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((trace) => {
          const isCrit = trace.configuredSeverity === 'CRITICAL';
          const severityLabel = isCrit ? t.rulesUi.critical : t.rulesUi.active;
          return (
            <button
              key={trace.ruleId}
              type="button"
              onClick={() =>
                openSystemDrawer(mapRuleToSystemId(trace.ruleId), false)
              }
              className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer transition ${
                isCrit
                  ? 'border-red-500/60 bg-red-900/40 hover:bg-red-900/60 text-red-100'
                  : 'border-amber-500/60 bg-amber-900/35 hover:bg-amber-900/55 text-amber-100'
              }`}
            >
              <span className="font-mono font-bold text-[11px]">
                {trace.shortCode}
              </span>
              <span className="truncate max-w-[160px]">
                {trace.title[lang]}
              </span>
              <span className="text-[10px] font-bold uppercase opacity-90">
                · {severityLabel}
              </span>
            </button>
          );
        })}

        {overflowCount > 0 && (
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-200">
            +{formatNumber(overflowCount, lang)}
          </span>
        )}
      </div>
    </section>
  );
}

export default ActiveAlertsStrip;
