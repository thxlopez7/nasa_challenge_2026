'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';

const SESSION_SECONDS = 60;
const PHASE_SECONDS = 5;

/** Respiración guiada a 6 ciclos/min: 5 s inhalar · 5 s exhalar. */
export function CoherencePacer({ onComplete }: { onComplete: () => void }) {
  const { t } = useT();
  const [elapsed, setElapsed] = useState<number | null>(null);
  const running = elapsed !== null;
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!running) return;
    let seconds = 0;
    const id = setInterval(() => {
      seconds += 1;
      if (seconds >= SESSION_SECONDS) {
        clearInterval(id);
        setElapsed(null);
        onCompleteRef.current();
      } else {
        setElapsed(seconds);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const inhaling = running && Math.floor(elapsed / PHASE_SECONDS) % 2 === 0;
  const remaining = running ? SESSION_SECONDS - elapsed : SESSION_SECONDS;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-24 w-24 shrink-0 flex items-center justify-center" aria-hidden>
        <div className="absolute inset-0 rounded-full border border-cyan-500/30" />
        <div
          className="h-24 w-24 rounded-full bg-cyan-500/25 border border-cyan-400 ease-in-out"
          style={{
            transform: `scale(${running && inhaling ? 1 : 0.4})`,
            transitionProperty: 'transform',
            transitionDuration: `${PHASE_SECONDS * 1000}ms`,
          }}
        />
      </div>
      <div className="flex-1 min-w-40">
        <p className="text-lg font-semibold text-slate-100" aria-live="polite">
          {running
            ? inhaling
              ? t.missionUi.coherence.inhale
              : t.missionUi.coherence.exhale
            : t.missionUi.coherence.ready}
        </p>
        <p className="text-xs text-slate-400 tabular-nums mt-1">
          {running
            ? `${remaining} ${t.missionUi.coherence.secRemaining}`
            : t.missionUi.coherence.subtitle}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setElapsed(running ? null : 0)}
        className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-cyan-500/60 bg-cyan-500/10 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/20 transition cursor-pointer"
      >
        {running ? (
          <>
            <Square className="h-4 w-4" aria-hidden /> {t.missionUi.coherence.stopBtn}
          </>
        ) : (
          <>
            <Play className="h-4 w-4" aria-hidden /> {t.missionUi.coherence.startBtn}
          </>
        )}
      </button>
    </div>
  );
}

export default CoherencePacer;
