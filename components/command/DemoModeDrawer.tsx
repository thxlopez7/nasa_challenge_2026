'use client';

import { useEffect, useRef } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { useCommandUiStore } from '../../store/useCommandUiStore';
import GodModePanel from '../GodModePanel';

export function DemoModeDrawer() {
  const { t } = useT();
  const demoDrawerOpen = useCommandUiStore((s) => s.demoDrawerOpen);
  const setDemoDrawerOpen = useCommandUiStore((s) => s.setDemoDrawerOpen);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!demoDrawerOpen) return;

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
        setDemoDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [demoDrawerOpen, setDemoDrawerOpen]);

  if (!demoDrawerOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setDemoDrawerOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-drawer-title"
        className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-[100dvh] overflow-y-auto shadow-2xl flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 sm:px-5 py-3.5 sm:py-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
              <SlidersHorizontal className="h-3 w-3" aria-hidden />
              <span>{t.command.demoDrawer.badge}</span>
            </span>
            <h2
              id="demo-drawer-title"
              className="text-base font-bold text-slate-100"
            >
              {t.command.demoDrawer.title}
            </h2>
            <p className="text-xs text-slate-400">
              {t.command.demoDrawer.subtitle}
            </p>
            <p className="text-[11px] font-mono text-cyan-300/90">
              {t.command.demoDrawer.shortcutHint}
            </p>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => setDemoDrawerOpen(false)}
            aria-label={t.command.demoDrawer.closeAria}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer shrink-0 transition"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="p-5 flex-1">
          <GodModePanel />
        </div>
      </div>
    </div>
  );
}

export default DemoModeDrawer;
