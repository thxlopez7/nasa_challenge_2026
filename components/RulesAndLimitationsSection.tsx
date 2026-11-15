'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ShieldAlert, ShieldCheck } from 'lucide-react';
import { CLINICAL_RULES, RULES_VERSION } from '../config/rules';
import { useT } from '../i18n/I18nContext';

export function RulesAndLimitationsSection({
  defaultExpanded = false,
}: {
  defaultExpanded?: boolean;
}) {
  const { t, lang } = useT();
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  return (
    <section
      id="rules-and-limitations"
      className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-bold tracking-widest uppercase text-cyan-400">
            {t.rulesUi.rulesEyebrow}
          </p>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400 shrink-0" aria-hidden="true" />
            <span>
              {t.rulesUi.rulesTitlePrefix} (v{RULES_VERSION})
            </span>
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          <span>
            {expanded
              ? t.rulesUi.toggleOpen
              : `${t.rulesUi.toggleClosedPrefix} ${CLINICAL_RULES.length} ${t.rulesUi.toggleClosedSuffix}`}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3.5 text-xs text-amber-100 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">{t.rulesUi.rulesDisclaimer}</p>
      </div>

      {expanded && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 uppercase text-[11px] tracking-wider">
                <th className="p-3 font-semibold">{t.rulesUi.colRule}</th>
                <th className="p-3 font-semibold">{t.rulesUi.colThreshold}</th>
                <th className="p-3 font-semibold">{t.rulesUi.colLimitations}</th>
                <th className="p-3 font-semibold">{t.rulesUi.colSource}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
              {CLINICAL_RULES.map((rule) => (
                <tr key={rule.id} className="align-top hover:bg-slate-800/30">
                  <td className="p-3 min-w-[180px]">
                    <div className="font-mono font-bold text-cyan-300">
                      {rule.shortCode} · v{rule.version}
                    </div>
                    <div className="font-semibold text-slate-100 mt-0.5">
                      {rule.title[lang]}
                    </div>
                  </td>
                  <td className="p-3 min-w-[220px] text-slate-200 font-mono leading-relaxed">
                    {rule.summary[lang]}
                  </td>
                  <td className="p-3 min-w-[260px] text-slate-300 leading-relaxed">
                    {rule.limitations[lang]}
                  </td>
                  <td className="p-3 min-w-[200px] space-y-2">
                    <p className="text-slate-300 leading-relaxed">{rule.source}</p>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                        rule.verified
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {rule.verified ? (
                        <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                      )}
                      {rule.verified ? t.rulesUi.verifiedLong : t.rulesUi.unverifiedLong}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default RulesAndLimitationsSection;
