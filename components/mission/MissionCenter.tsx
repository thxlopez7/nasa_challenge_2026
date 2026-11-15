'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  CalendarDays,
  ClipboardCheck,
  Flag,
  Lock,
  Rocket,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DayKey, Mission, MissionProfileId } from '../../types/mission';
import { selectTotalXp, useMissionStore } from '../../store/useMissionStore';
import {
  MISSION_PROFILES,
  WEEKLY_TARGET_DAYS,
  computeAchievements,
  formatDay,
  getProfile,
  missionDayOf,
  missionWeekOf,
  phaseOfDay,
  rankFor,
  toDayKey,
  totalDays,
  weekProgress,
  weeklyStreak,
} from '../../utils/missionPlan';
import { demoDaysFor } from '../../utils/demoHistory';
import DailyEvaluation from './DailyEvaluation';
import MissionCalendar from './MissionCalendar';
import TrendChart from './TrendChart';

type Tab = 'today' | 'calendar' | 'trends' | 'achievements';
type Toast = { id: number; text: string; tone: 'xp' | 'rank' | 'achievement' };

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Hoy', icon: ClipboardCheck },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'trends', label: 'Tendencias', icon: TrendingUp },
  { id: 'achievements', label: 'Logros', icon: Award },
];

const TOAST_STYLE: Record<Toast['tone'], string> = {
  xp: 'border-cyan-500/60 text-cyan-200',
  rank: 'border-amber-500/70 text-amber-200',
  achievement: 'border-amber-500/70 text-amber-200',
};

/* ------------------------------------------------------------------ */

function MissionSetup({ today, preferred }: { today: DayKey; preferred?: MissionProfileId }) {
  const startMission = useMissionStore((s) => s.startMission);
  const loadDemoHistory = useMissionStore((s) => s.loadDemoHistory);
  const [profileId, setProfileId] = useState<MissionProfileId>(preferred ?? 'MARS_CONJUNCTION');
  const activeProfileId = preferred ?? profileId;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-100">Prepara tu misión</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Cada día harás una evaluación guiada: check-in, biomarcadores,
          contramedidas y un cierre con diagnóstico. El calendario guarda cómo
          responde tu cuerpo semana a semana hasta el último día de la misión.
        </p>
      </div>

      <div role="radiogroup" aria-label="Perfil de misión" className={`grid gap-3 ${preferred ? 'max-w-xl' : 'md:grid-cols-3'}`}>
        {Object.values(MISSION_PROFILES)
          .filter((p) => !preferred || p.id === preferred)
          .map((p) => {
          const active = activeProfileId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setProfileId(p.id)}
              className={`text-left rounded-xl border p-4 space-y-3 transition cursor-pointer ${
                active ? 'border-cyan-400 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-100">{p.name}</p>
                <span className="text-xs text-slate-400 tabular-nums">{totalDays(p)} días</span>
              </div>
              <p className="text-sm text-slate-400">{p.summary}</p>
              <div className="flex gap-[2px] h-2 rounded-full overflow-hidden" aria-hidden>
                {p.phases.map((ph, i) => (
                  <div
                    key={ph.id}
                    className={i % 2 ? 'bg-cyan-700' : 'bg-cyan-400'}
                    style={{ flex: ph.days }}
                  />
                ))}
              </div>
              <ul className="text-xs text-slate-500 space-y-0.5">
                {p.phases.map((ph) => (
                  <li key={ph.id}>{ph.name} · {ph.days} días</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => startMission(activeProfileId, today)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition cursor-pointer"
        >
          <Rocket className="h-4 w-4" aria-hidden /> Iniciar misión hoy
        </button>
        <button
          type="button"
          onClick={() => loadDemoHistory(today, activeProfileId)}
          className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
        >
          Ver demo con {demoDaysFor(activeProfileId)} días simulados
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MissionHeader({ mission, today, totalXp }: {
  mission: Mission;
  today: DayKey;
  totalXp: number;
}) {
  const records = useMissionStore((s) => s.records);
  const profile = getProfile(mission.profileId);
  const total = totalDays(profile);
  const day = Math.min(Math.max(1, missionDayOf(mission, today)), total);
  const { phase, dayInPhase } = phaseOfDay(profile, day);
  const { rank, next, progress } = rankFor(totalXp);
  const week = missionWeekOf(day);
  const weekDone = Math.min(weekProgress(records, week), WEEKLY_TARGET_DAYS);
  const streak = weeklyStreak(records, week);

  return (
    <div className="grid lg:grid-cols-3 gap-3">
      {/* Arco de misión */}
      <div className="lg:col-span-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-slate-400">
            {profile.name} · <span className="text-slate-200 font-semibold">{phase.name}</span>{' '}
            <span className="tabular-nums">(día {dayInPhase} de {phase.days})</span>
          </p>
          <p className="text-sm tabular-nums">
            <span className="text-2xl font-bold text-slate-100">Día {day}</span>
            <span className="text-slate-500"> / {total}</span>
          </p>
        </div>
        <div className="flex gap-[2px]" aria-label={`Progreso de misión: día ${day} de ${total}`}>
          {profile.phases.map((ph, i) => {
            const start = profile.phases.slice(0, i).reduce((s, x) => s + x.days, 0);
            const filled = Math.min(1, Math.max(0, (day - start) / ph.days));
            return (
              <div key={ph.id} className="h-2.5 rounded-full bg-slate-800 overflow-hidden" style={{ flex: ph.days }}>
                <div className="h-full bg-cyan-400 transition-[width] duration-700" style={{ width: `${filled * 100}%` }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[11px] text-slate-500 gap-2">
          <span>Inicio · {formatDay(mission.startDate)}</span>
          <span>{phase.description}</span>
          <span className="tabular-nums whitespace-nowrap">{total - day} días restantes</span>
        </div>
      </div>

      {/* Rango y meta semanal */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-2 font-bold text-slate-100">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
            {rank.title}
          </p>
          <span className="text-xs text-slate-500">Rango {rank.level}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Progreso al siguiente rango"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 rounded-full bg-slate-800 overflow-hidden"
        >
          <div className="h-full bg-cyan-400 transition-[width] duration-700" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-[11px] text-slate-500 tabular-nums">
          {totalXp.toLocaleString('es')} XP
          {next ? ` · ${(next.minXp - totalXp).toLocaleString('es')} para ${next.title}` : ' · rango máximo'}
        </p>
        <div className="pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">Meta semana {week}</span>
            <span className="text-slate-500 tabular-nums">{weekDone}/{WEEKLY_TARGET_DAYS} días</span>
          </div>
          <div className="flex gap-1 mt-1.5" aria-hidden>
            {Array.from({ length: WEEKLY_TARGET_DAYS }, (_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i < weekDone ? 'bg-cyan-400' : 'bg-slate-800'}`} />
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {streak > 0
              ? `${streak} ${streak === 1 ? 'semana' : 'semanas'} seguidas cumpliendo la meta`
              : 'Un día de descanso por semana no rompe nada'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MissionEnded({ mission, totalXp }: { mission: Mission; totalXp: number }) {
  const records = useMissionStore((s) => s.records);
  const resetAll = useMissionStore((s) => s.resetAll);
  const list = Object.values(records);
  const { rank } = rankFor(totalXp);
  const profile = getProfile(mission.profileId);
  const unlocked = computeAchievements(mission, records).filter((a) => a.unlocked).length;

  return (
    <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/5 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Flag className="h-8 w-8 text-cyan-400" aria-hidden />
        <div>
          <h3 className="text-xl font-bold text-slate-100">
            {mission.aborted ? 'Misión finalizada antes de tiempo' : '¡Misión cumplida!'}
          </h3>
          <p className="text-sm text-slate-400">
            {profile.name} · {formatDay(mission.startDate)} → {mission.endedOn && formatDay(mission.endedOn)}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Días evaluados', list.length],
          ['Días completos', list.filter((r) => r.status === 'COMPLETE').length],
          ['Rango final', rank.title],
          ['Logros', unlocked],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <dt className="text-[11px] uppercase text-slate-500">{k}</dt>
            <dd className="text-lg font-bold text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-slate-400">
        Tu historial sigue disponible en el calendario y las tendencias.
      </p>
      <button
        type="button"
        onClick={() => {
          if (window.confirm('¿Empezar una misión nueva? Se borrará el historial actual.')) resetAll();
        }}
        className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-cyan-400 cursor-pointer"
      >
        Preparar nueva misión
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function MissionCenter({ preferredProfile }: { preferredProfile?: MissionProfileId } = {}) {
  const [today, setToday] = useState<DayKey | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const mission = useMissionStore((s) => s.mission);
  const records = useMissionStore((s) => s.records);
  const totalXp = useMissionStore(selectTotalXp);
  const syncDay = useMissionStore((s) => s.syncDay);
  const abortMission = useMissionStore((s) => s.abortMission);
  const resetAll = useMissionStore((s) => s.resetAll);
  const selectProfile = useMissionStore((s) => s.selectProfile);

  // El destino elegido (Luna o Marte) manda: guarda la otra misión y abre esta.
  useEffect(() => {
    if (today !== null && preferredProfile) selectProfile(preferredProfile);
  }, [today, preferredProfile, selectProfile]);

  // Rehidrata tras montar (evita desajustes de SSR) y vigila el cambio de día.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      const key = toDayKey(new Date());
      syncDay(key);
      setToday(key);
    };
    Promise.resolve(useMissionStore.persist.rehydrate()).then(() => {
      if (!cancelled) tick();
    });
    const id = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [syncDay]);

  /** Ejecuta una acción y convierte lo ganado en notificaciones. */
  const run = useCallback((action: () => void) => {
    const read = () => {
      const s = useMissionStore.getState();
      const xp = selectTotalXp(s);
      return {
        xp,
        rank: rankFor(xp).rank,
        unlocked: s.mission
          ? new Set(computeAchievements(s.mission, s.records).filter((a) => a.unlocked).map((a) => a.id))
          : new Set<string>(),
      };
    };
    const before = read();
    action();
    const after = read();
    const s = useMissionStore.getState();

    const next: Toast[] = [];
    if (after.xp > before.xp) {
      next.push({ id: ++toastSeq.current, tone: 'xp', text: `+${after.xp - before.xp} XP` });
    }
    if (after.rank.level > before.rank.level) {
      next.push({ id: ++toastSeq.current, tone: 'rank', text: `Nuevo rango: ${after.rank.title}` });
    }
    if (s.mission) {
      for (const a of computeAchievements(s.mission, s.records)) {
        if (a.unlocked && !before.unlocked.has(a.id)) {
          next.push({ id: ++toastSeq.current, tone: 'achievement', text: `Logro: ${a.title}` });
        }
      }
    }
    if (next.length === 0) return;
    setToasts((t) => [...t, ...next].slice(-4));
    const ids = new Set(next.map((t) => t.id));
    setTimeout(() => setToasts((t) => t.filter((x) => !ids.has(x.id))), 3500);
  }, []);

  const achievements = mission ? computeAchievements(mission, records) : [];

  return (
    <section
      aria-labelledby="mission-center-title"
      className="relative bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="mission-center-title" className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
            Centro de misión
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Evaluación diaria, contramedidas y seguimiento del cuerpo a lo largo de la misión.
          </p>
        </div>
        {mission?.simulatedHistory && (
          <span className="text-[11px] uppercase tracking-wider text-amber-300 border border-amber-500/60 rounded px-2 py-1">
            Historial simulado · demo
          </span>
        )}
      </div>

      {today === null ? (
        <p className="text-sm text-slate-500">Cargando misión…</p>
      ) : !mission ? (
        <MissionSetup today={today} preferred={preferredProfile} />
      ) : (
        <>

          {mission.endedOn ? (
            <MissionEnded mission={mission} totalXp={totalXp} />
          ) : (
            <MissionHeader mission={mission} today={today} totalXp={totalXp} />
          )}

          <div role="tablist" aria-label="Secciones del centro de misión" className="flex gap-1 border-b border-slate-800 overflow-x-auto">
            {TABS.filter((t) => !(mission.endedOn && t.id === 'today')).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id || (mission.endedOn && tab === 'today' && t.id === 'calendar');
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={!!active}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                    active ? 'border-cyan-400 text-cyan-200' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden /> {t.label}
                </button>
              );
            })}
          </div>

          <div role="tabpanel">
            {tab === 'today' && !mission.endedOn && (
              <DailyEvaluation today={today} missionDay={missionDayOf(mission, today)} run={run} />
            )}
            {(tab === 'calendar' || (tab === 'today' && mission.endedOn)) && (
              <MissionCalendar mission={mission} records={records} today={today} />
            )}
            {tab === 'trends' && <TrendChart records={records} />}
            {tab === 'achievements' && (
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {achievements.map((a) => (
                  <li
                    key={a.id}
                    className={`rounded-lg border p-4 flex items-start gap-3 ${
                      a.unlocked ? 'border-amber-500/60 bg-amber-500/5' : 'border-slate-800 bg-slate-950/60'
                    }`}
                  >
                    {a.unlocked ? (
                      <Award className="h-6 w-6 text-amber-400 shrink-0" aria-label="Desbloqueado" />
                    ) : (
                      <Lock className="h-6 w-6 text-slate-600 shrink-0" aria-label="Bloqueado" />
                    )}
                    <div>
                      <p className={`text-sm font-bold ${a.unlocked ? 'text-slate-100' : 'text-slate-400'}`}>{a.title}</p>
                      <p className="text-xs text-slate-500">{a.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-800 text-xs">
            {!mission.endedOn && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('¿Finalizar la misión hoy? El historial se conserva.')) abortMission(today);
                }}
                className="text-slate-500 hover:text-amber-300 cursor-pointer"
              >
                Finalizar misión
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('¿Borrar la misión y todo su historial?')) resetAll();
              }}
              className="text-slate-500 hover:text-red-300 cursor-pointer"
            >
              Borrar datos de misión
            </button>
          </div>
        </>
      )}

      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`inline-flex items-center gap-2 rounded-lg border bg-slate-950/95 px-3 py-2 text-sm font-semibold shadow-lg shadow-black/40 animate-[toast-in_200ms_ease-out] ${TOAST_STYLE[t.tone]}`}
          >
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            {t.text}
          </div>
        ))}
      </div>
    </section>
  );
}

export default MissionCenter;
