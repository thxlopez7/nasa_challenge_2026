'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  Bot,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { useCommandUiStore } from '../../store/useCommandUiStore';
import type { MissionSlug } from '../../utils/missionChoice';
import MedicalCopilot from '../MedicalCopilot';

const XL_QUERY = '(min-width: 1280px)';

function subscribeXl(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(XL_QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

function getXlSnapshot(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia(XL_QUERY).matches;
}

function getXlServerSnapshot(): boolean {
  return true;
}

export function CopilotDock({ mision }: { mision?: MissionSlug }) {
  const { t } = useT();
  const isXl = useSyncExternalStore(
    subscribeXl,
    getXlSnapshot,
    getXlServerSnapshot
  );

  const copilotCollapsed = useCommandUiStore((s) => s.copilotCollapsed);
  const toggleCopilotCollapsed = useCommandUiStore(
    (s) => s.toggleCopilotCollapsed
  );
  const hydrateCopilotCollapsed = useCommandUiStore(
    (s) => s.hydrateCopilotCollapsed
  );
  const mobileCopilotOpen = useCommandUiStore((s) => s.mobileCopilotOpen);
  const setMobileCopilotOpen = useCommandUiStore(
    (s) => s.setMobileCopilotOpen
  );

  const mobileCloseRef = useRef<HTMLButtonElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    hydrateCopilotCollapsed();
  }, [hydrateCopilotCollapsed]);

  useEffect(() => {
    if (!mobileCopilotOpen) return;

    prevFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const timer = window.setTimeout(() => {
      mobileCloseRef.current?.focus();
    }, 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileCopilotOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      prevFocusRef.current?.focus?.();
    };
  }, [mobileCopilotOpen, setMobileCopilotOpen]);

  if (isXl) {
    return (
      <aside
        aria-label={t.command.copilotDock.panelLabel}
        className={`hidden xl:block shrink-0 sticky top-3 ${
          copilotCollapsed ? 'w-auto' : 'w-[370px] 2xl:w-[400px]'
        }`}
      >
        {copilotCollapsed ? (
          <button
            type="button"
            onClick={toggleCopilotCollapsed}
            aria-label={t.command.copilotDock.expandAria}
            aria-expanded={false}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-slate-900 hover:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-cyan-200 shadow-lg cursor-pointer transition"
          >
            <PanelRightOpen className="h-4 w-4 text-cyan-400" aria-hidden />
            <span>{t.command.copilotDock.panelLabel}</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" aria-hidden />
                <span>{t.command.copilotDock.panelLabel}</span>
              </span>
              <button
                type="button"
                onClick={toggleCopilotCollapsed}
                aria-label={t.command.copilotDock.collapseAria}
                aria-expanded={true}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer transition"
              >
                <PanelRightClose className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <MedicalCopilot mision={mision} compactHeight />
          </div>
        )}
      </aside>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileCopilotOpen(true)}
        className="fixed bottom-4 right-4 z-40 min-h-[44px] inline-flex items-center gap-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-2.5 text-xs font-bold shadow-xl shadow-cyan-950/50 cursor-pointer transition"
      >
        <Bot className="h-4 w-4" aria-hidden />
        <span>{t.command.copilotDock.floatingLabel}</span>
      </button>

      {mobileCopilotOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileCopilotOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.command.copilotDock.panelLabel}
            className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full overflow-y-auto p-4 flex flex-col gap-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Bot className="h-4 w-4" aria-hidden />
                <span>{t.command.copilotDock.panelLabel}</span>
              </span>
              <button
                ref={mobileCloseRef}
                type="button"
                onClick={() => setMobileCopilotOpen(false)}
                aria-label={t.sbar.close}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 cursor-pointer transition"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <MedicalCopilot mision={mision} />
          </div>
        </div>
      )}
    </>
  );
}

export default CopilotDock;
