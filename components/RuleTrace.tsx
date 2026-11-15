'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Minus,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { CriterionTrace, RuleEvaluationTrace } from '../config/rules';
import type { SupportedLang } from '../config/missionComms';
import { useT } from '../i18n/I18nContext';
import { formatDecimal } from '../utils/formatters';

function formatCriterionValue(
  c: CriterionTrace,
  missingLabel: string,
  lang: SupportedLang
): string {
  if (c.missing || c.actualValue === null) return missingLabel;
  if (!Number.isFinite(c.actualValue)) return '∞';
  return `${formatDecimal(c.actualValue, c.decimals, lang)} ${c.unit}`.trim();
}

function formatThreshold(c: CriterionTrace, lang: SupportedLang): string {
  const num = Number.isInteger(c.threshold)
    ? String(c.threshold)
    : formatDecimal(c.threshold, Math.min(c.decimals, 2), lang);
  return `${c.operator} ${num} ${c.unit}`.trim();
}

export function RuleTrace({ traces }: { traces: RuleEvaluationTrace[] }) {
  const { t, lang } = useT();
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [activeTabByRule, setActiveTabByRule] = useState<
    Record<string, 'criteria' | 'evidence'>
  >({});

  const toggleRule = (ruleId: string) => {
    setExpandedRuleId((prev) => (prev === ruleId ? null : ruleId));
  };

  const setTab = (ruleId: string, tab: 'criteria' | 'evidence') => {
    setActiveTabByRule((prev) => ({ ...prev, [ruleId]: tab }));
  };

  const labels = t.rulesUi;

  return (
    <div className="space-y-3">
      {traces.map((rule) => {
        const isOpen = expandedRuleId === rule.ruleId;
        const tab = activeTabByRule[rule.ruleId] ?? 'criteria';

        const cardStyle = rule.triggered
          ? rule.configuredSeverity === 'CRITICAL'
            ? 'border-red-500/80 bg-red-950/25'
            : 'border-amber-500/70 bg-amber-950/20'
          : 'border-slate-800 bg-slate-950/60';

        const badgeStyle = rule.triggered
          ? rule.configuredSeverity === 'CRITICAL'
            ? 'border-red-500/60 bg-red-500/20 text-red-200'
            : 'border-amber-500/60 bg-amber-500/20 text-amber-200'
          : rule.hasMissingInputs
          ? 'border-slate-600 bg-slate-800/70 text-slate-200'
          : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200';

        const badgeText = rule.triggered
          ? rule.configuredSeverity === 'CRITICAL'
            ? labels.critical
            : labels.active
          : rule.hasMissingInputs
          ? labels.partial
          : labels.nominal;

        return (
          <div
            key={rule.ruleId}
            className={`rounded-xl border p-4 transition-colors ${cardStyle}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                    {rule.shortCode} · v{rule.version}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {rule.title[lang]}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 font-mono">
                  {rule.summary[lang]}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase px-2.5 py-1 rounded-md border ${badgeStyle}`}
                >
                  {rule.triggered ? (
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : rule.hasMissingInputs ? (
                    <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  {badgeText}
                </span>

                <button
                  type="button"
                  onClick={() => toggleRule(rule.ruleId)}
                  aria-expanded={isOpen}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                  <span>{isOpen ? labels.hide : labels.why}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                <div role="tablist" className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'criteria'}
                    onClick={() => setTab(rule.ruleId, 'criteria')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      tab === 'criteria'
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {labels.criteriaTab}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'evidence'}
                    onClick={() => setTab(rule.ruleId, 'evidence')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      tab === 'evidence'
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {labels.evidenceTab}
                  </button>
                </div>

                {tab === 'criteria' ? (
                  <ul className="space-y-2">
                    {rule.criteria.map((c) => {
                      const statusIcon = c.missing ? (
                        <Minus
                          className="w-4 h-4 text-slate-400 shrink-0"
                          aria-label={labels.missingVal}
                        />
                      ) : c.passed ? (
                        <Check
                          className="w-4 h-4 text-emerald-400 shrink-0"
                          aria-label={labels.active}
                        />
                      ) : (
                        <X
                          className="w-4 h-4 text-slate-400 shrink-0"
                          aria-label={labels.nominal}
                        />
                      );

                      const rowBorder = c.passed
                        ? 'border-amber-500/50 bg-amber-950/20'
                        : 'border-slate-800 bg-slate-900/70';

                      return (
                        <li
                          key={c.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 text-xs ${rowBorder}`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="mt-0.5">{statusIcon}</span>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-100">
                                {c.label[lang]}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                <span>
                                  {c.group === 'all' ? labels.andTag : labels.orTag}
                                </span>
                                {c.thresholdNote && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                    {c.thresholdNote[lang]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                            <span
                              className={
                                c.missing
                                  ? 'text-slate-400 italic'
                                  : c.passed
                                  ? 'text-amber-300 font-bold'
                                  : 'text-slate-200'
                              }
                            >
                              {formatCriterionValue(c, labels.missingVal, lang)}
                            </span>
                            <span className="text-slate-500">|</span>
                            <span className="text-slate-400">
                              {formatThreshold(c, lang)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="space-y-3 text-xs text-slate-200 bg-slate-900/80 border border-slate-800 rounded-lg p-4">
                    <div>
                      <p className="font-bold text-cyan-300 uppercase tracking-wider text-[11px]">
                        {labels.rationaleTitle}
                      </p>
                      <p className="mt-1 leading-relaxed text-slate-200">
                        {rule.rationale[lang]}
                      </p>
                    </div>

                    <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3">
                      <p className="font-bold text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                        {labels.limitationsTitle}
                      </p>
                      <p className="mt-1 leading-relaxed text-slate-200">
                        {rule.limitations[lang]}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
                        {labels.actionTitle}
                      </p>
                      <p className="mt-1 leading-relaxed text-slate-200">
                        {rule.actionSummary[lang]}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-400">
                        <strong className="text-slate-300">{labels.sourceTitle}:</strong>{' '}
                        {rule.source}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold shrink-0 ${
                          rule.verified
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {rule.verified ? labels.verified : labels.unverified}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default RuleTrace;
