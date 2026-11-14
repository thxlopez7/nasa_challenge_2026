'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Brain,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  HeartPulse,
  Pill,
  Play,
  Sparkles,
  Square,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  MissionDefinition,
  MissionId,
  WellnessEvent,
} from '../types/wellness';
import {
  MISSIONS,
  XP_PER_LEVEL,
  getLevel,
  getMission,
  toDayKey,
  useWellnessStore,
} from '../store/useWellnessStore';
import { useTelemetryStore } from '../store/useTelemetryStore';

const MISSION_ICONS: Record<MissionId, LucideIcon> = {
  ared: Dumbbell,
  hydration: Droplets,
  citrate: Pill,
  coherence: HeartPulse,
};

/** Misiones que se priorizan cuando la Regla 1 (renal) está activa */
const RENAL_PRIORITY: readonly MissionId[] = ['hydration', 'citrate'];

const COHERENCE_SESSION_SECONDS = 60;
const BREATH_PHASE_SECONDS = 5;
const TOAST_MS = 3500;

type Toast = { id: number; tone: 'xp' | 'success' | 'level' | 'streak'; text: string };

function eventToToast(event: WellnessEvent, id: number): Toast {
  switch (event.type) {
    case 'XP':
      return { id, tone: 'xp', text: `+${event.amount} XP · ${getMission(event.missionId).title}` };
    case 'MISSION_COMPLETE':
      return {
        id,
        tone: 'success',
        text: `Misión completada: ${getMission(event.missionId).title} (+${event.bonus} XP)`,
      };
    case 'LEVEL_UP':
      return { id, tone: 'level', text: `¡Nivel ${event.level} alcanzado!` };
    case 'STREAK':
      return {
        id,
        tone: 'streak',
        text: `Todas las misiones del día completas · racha de ${event.streak} ${
          event.streak === 1 ? 'día' : 'días'
        }`,
      };
  }
}

const TOAST_STYLES: Record<Toast['tone'], string> = {
  xp: 'border-cyan-500/60 text-cyan-300',
  success: 'border-emerald-500/60 text-emerald-300',
  level: 'border-amber-500/70 text-amber-300',
  streak: 'border-amber-500/70 text-amber-300',
};

/* ------------------------------------------------------------------ */

function ProgressBar({
  value,
  max,
  tone = 'cyan',
  label,
}: {
  value: number;
  max: number;
  tone?: 'cyan' | 'emerald' | 'amber';
  label: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fill = {
    cyan: 'bg-cyan-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
  }[tone];

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2 w-full rounded-full bg-slate-800 overflow-hidden"
    >
      <div
        className={`h-full rounded-full ${fill} transition-[width] duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CoherencePacer({
  disabled,
  onComplete,
}: {
  disabled: boolean;
  onComplete: () => void;
}) {
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
      if (seconds >= COHERENCE_SESSION_SECONDS) {
        clearInterval(id);
        setElapsed(null);
        onCompleteRef.current();
      } else {
        setElapsed(seconds);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const inhaling =
    running && Math.floor(elapsed / BREATH_PHASE_SECONDS) % 2 === 0;
  const remaining = running ? COHERENCE_SESSION_SECONDS - elapsed : COHERENCE_SESSION_SECONDS;

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative h-14 w-14 shrink-0 flex items-center justify-center"
        aria-hidden
      >
        <div className="absolute inset-0 rounded-full border border-cyan-500/30" />
        <div
          className="h-14 w-14 rounded-full bg-cyan-500/30 border border-cyan-400 ease-in-out"
          style={{
            transform: `scale(${running ? (inhaling ? 1 : 0.45) : 0.45})`,
            transitionProperty: 'transform',
            transitionDuration: `${BREATH_PHASE_SECONDS * 1000}ms`,
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-200" aria-live="polite">
          {running ? (inhaling ? 'Inhala…' : 'Exhala…') : 'Sesión guiada de 1 min'}
        </p>
        <p className="text-xs text-slate-500 tabular-nums">
          {running ? `${remaining} s restantes` : '5 s inhalar · 5 s exhalar'}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled && !running}
        onClick={() => setElapsed(running ? null : 0)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/60 bg-cyan-500/10 text-cyan-300 text-xs font-bold uppercase tracking-wider hover:bg-cyan-500/20 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {running ? (
          <>
            <Square className="h-3.5 w-3.5" aria-hidden /> Detener
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" aria-hidden /> Iniciar
          </>
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MissionCard({
  mission,
  done,
  priority,
  onLog,
}: {
  mission: MissionDefinition;
  done: number;
  priority: boolean;
  onLog: () => void;
}) {
  const Icon = MISSION_ICONS[mission.id];
  const complete = done >= mission.steps;

  return (
    <article
      className={`rounded-lg border p-4 space-y-3 transition-colors ${
        complete
          ? 'border-emerald-500/50 bg-emerald-500/5'
          : priority
            ? 'border-amber-500/70 bg-amber-500/5'
            : 'border-slate-800 bg-slate-950/60'
      }`}
    >
      <header className="flex items-start gap-3">
        <span
          className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${
            complete ? 'bg-emerald-500/15 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'
          }`}
        >
          {complete ? <Check className="h-5 w-5" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-100">{mission.title}</h3>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
              {mission.category === 'MENTAL' ? (
                <Brain className="h-3 w-3" aria-hidden />
              ) : (
                <Dumbbell className="h-3 w-3" aria-hidden />
              )}
              {mission.category === 'MENTAL' ? 'Mental' : 'Física'}
            </span>
          </div>
          {priority && !complete && (
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Prioridad · alerta renal activa
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400 leading-snug">{mission.description}</p>
        </div>
      </header>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-slate-500 tabular-nums">
          <span>
            {done}/{mission.steps}{' '}
            {mission.steps === 1 ? mission.stepLabel : mission.stepLabelPlural}
          </span>
          <span>+{mission.xpPerStep} XP c/u</span>
        </div>
        <ProgressBar
          value={done}
          max={mission.steps}
          tone={complete ? 'emerald' : priority ? 'amber' : 'cyan'}
          label={`Progreso de ${mission.title}`}
        />
      </div>

      {mission.id === 'coherence' ? (
        <CoherencePacer disabled={complete} onComplete={onLog} />
      ) : (
        <button
          type="button"
          disabled={complete}
          onClick={onLog}
          className="w-full px-3 py-2 rounded-lg border border-cyan-500/60 bg-cyan-500/10 text-cyan-300 text-xs font-bold uppercase tracking-wider hover:bg-cyan-500/20 transition cursor-pointer disabled:border-emerald-500/40 disabled:bg-transparent disabled:text-emerald-400 disabled:cursor-default"
        >
          {complete ? 'Completada hoy' : `Registrar ${mission.stepLabel}`}
        </button>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */

export function WellnessMissionPanel() {
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const xp = useWellnessStore((s) => s.xp);
  const streak = useWellnessStore((s) => s.streak);
  const bestStreak = useWellnessStore((s) => s.bestStreak);
  const progress = useWellnessStore((s) => s.progress);
  const logStep = useWellnessStore((s) => s.logStep);
  const syncDay = useWellnessStore((s) => s.syncDay);
  const isRenalWarning = useTelemetryStore((s) => s.isRenalWarning);

  // Rehidrata desde localStorage tras montar y vigila el cambio de día.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(useWellnessStore.persist.rehydrate()).then(() => {
      if (cancelled) return;
      syncDay(toDayKey(new Date()));
      setHydrated(true);
    });
    const id = setInterval(() => syncDay(toDayKey(new Date())), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [syncDay]);

  const pushToasts = useCallback((events: WellnessEvent[]) => {
    const next = events.map((e) => eventToToast(e, ++toastSeq.current));
    if (next.length === 0) return;
    setToasts((t) => [...t, ...next].slice(-4));
    const ids = new Set(next.map((t) => t.id));
    setTimeout(() => setToasts((t) => t.filter((x) => !ids.has(x.id))), TOAST_MS);
  }, []);

  const handleLog = useCallback(
    (id: MissionId) => pushToasts(logStep(id)),
    [logStep, pushToasts]
  );
  const logCoherence = useCallback(() => handleLog('coherence'), [handleLog]);

  const level = getLevel(xp);
  const xpIntoLevel = xp % XP_PER_LEVEL;
  const completedCount = MISSIONS.filter((m) => progress[m.id] >= m.steps).length;

  const ordered = isRenalWarning
    ? [...MISSIONS].sort(
        (a, b) =>
          Number(RENAL_PRIORITY.includes(b.id)) - Number(RENAL_PRIORITY.includes(a.id))
      )
    : MISSIONS;

  return (
    <section
      aria-labelledby="wellness-title"
      className="relative bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="wellness-title"
            className="text-lg font-bold text-cyan-400 uppercase tracking-wider"
          >
            Misiones de bienestar
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Contramedidas diarias contra el desacondicionamiento, la fatiga y el
            aislamiento.
          </p>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">
          {completedCount}/{MISSIONS.length} misiones hoy
        </span>
      </div>

      {/* Estado del tripulante */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-100">
              <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
              Nivel {hydrated ? level : '–'}
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              {hydrated ? `${xpIntoLevel}/${XP_PER_LEVEL} XP` : '—'}
            </span>
          </div>
          <ProgressBar
            value={hydrated ? xpIntoLevel : 0}
            max={XP_PER_LEVEL}
            label="Progreso al siguiente nivel"
          />
          <p className="text-[11px] text-slate-500 tabular-nums">
            {hydrated ? `${xp} XP totales` : 'Cargando progreso…'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 flex items-center gap-3">
          <Flame
            className={`h-8 w-8 ${streak > 0 ? 'text-amber-500' : 'text-slate-700'}`}
            aria-hidden
          />
          <div>
            <p className="text-2xl font-bold text-slate-100 tabular-nums leading-none">
              {hydrated ? streak : '–'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Racha de días · récord {hydrated ? bestStreak : '–'}
            </p>
          </div>
        </div>
      </div>

      {/* Tarjetas de misión */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ordered.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            done={hydrated ? progress[mission.id] : 0}
            priority={isRenalWarning && RENAL_PRIORITY.includes(mission.id)}
            onLog={mission.id === 'coherence' ? logCoherence : () => handleLog(mission.id)}
          />
        ))}
      </div>

      {/* Notificaciones */}
      <div
        aria-live="polite"
        className="pointer-events-none absolute right-4 bottom-4 flex flex-col items-end gap-2 max-w-[calc(100%-2rem)]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`inline-flex items-center gap-2 rounded-lg border bg-slate-950/95 px-3 py-2 text-xs font-semibold shadow-lg shadow-black/40 animate-[toast-in_200ms_ease-out] ${TOAST_STYLES[t.tone]}`}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t.text}
          </div>
        ))}
      </div>
    </section>
  );
}

export default WellnessMissionPanel;
