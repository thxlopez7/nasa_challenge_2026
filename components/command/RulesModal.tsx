'use client';

import { useEffect, useRef } from 'react';
import { BookOpen, X } from 'lucide-react';
import type { RuleEvaluationTrace } from '../../config/rules';
import { useT } from '../../i18n/I18nContext';
import { useCommandUiStore } from '../../store/useCommandUiStore';
import RuleTrace from '../RuleTrace';
import RulesAndLimitationsSection from '../RulesAndLimitationsSection';

export function RulesModal({ traces }: { traces?: RuleEvaluationTrace[] }) {
  const { t } = useT();
  const rulesModalOpen = useCommandUiStore((s) => s.rulesModalOpen);
  const setRulesModalOpen = useCommandUiStore((s) => s.setRulesModalOpen);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!rulesModalOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const timer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setRulesModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [rulesModalOpen, setRulesModalOpen]);

  if (!rulesModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setRulesModalOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-modal-title"
        className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-5 w-5 text-cyan-400 shrink-0" aria-hidden />
            <h2
              id="rules-modal-title"
              className="text-base font-bold text-slate-100 truncate"
            >
              {t.rulesUi.rulesTitlePrefix}
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => setRulesModalOpen(false)}
            aria-label={t.sbar.close}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer shrink-0 transition"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {traces && traces.length > 0 && <RuleTrace traces={traces} />}
          <RulesAndLimitationsSection defaultExpanded />
        </div>
      </div>
    </div>
  );
}

export default RulesModal;
