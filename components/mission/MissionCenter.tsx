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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DayKey, Mission, MissionProfileId } from '../../types/mission';
import { useActiveProfile } from '../../store/useProfileStore';
import { selectTotalXp, useMissionStore } from '../../store/useMissionStore';
import {
  RANKS,
  WEEKLY_TARGET_DAYS,
  computeAchievements,
  missionDayOf,
  missionWeekOf,
  phaseOfDay,
  rankFor,
  toDayKey,
  totalDays,
  weekProgress,
  weeklyStreak,
} from '../../utils/missionPlan';
import {
  computeLocalizedAchievements,
  formatMissionDay,
  getLocalizedAllProfiles,
  getLocalizedProfile,
  getLocalizedRankFor,
  localizeRank,
} from '../../utils/missionPlanL10n';
import { formatNumber } from '../../utils/formatters';
import { useT } from '../../i18n/I18nContext';
import { demoDaysFor } from '../../utils/demoHistory';
import DailyEvaluation from './DailyEvaluation';
import MissionCalendar from './MissionCalendar';
import TrendChart from './TrendChart';

type Tab = 'today' | 'calendar' | 'trends' | 'achievements';
type Toast =
  | { id: number; kind: 'xp'; xpAmount: number; tone: 'xp' }
  | { id: number; kind: 'rank'; rankLevel: number; tone: 'rank' }
  | { id: number; kind: 'achievement'; achievementId: string; tone: 'achievement' };

const TAB_DEFS: { id: Tab; icon: LucideIcon }[] = [
  { id: 'today', icon: ClipboardCheck },
  { id: 'calendar', icon: CalendarDays },
];

const TOAST_STYLE: Record<Toast['tone'], string> = {
  xp: 'border-cyan-500/60 text-cyan-200',
  rank: 'border-amber-500/70 text-amber-200',
  achievement: 'border-amber-500/70 text-amber-200',
};

/* ------------------------------------------------------------------ */

function MissionSetup({ today, preferred }: { today: DayKey; preferred?: MissionProfileId }) {
  const { lang, t } = useT();
  const startMission = useMissionStore((s) => s.startMission);
  const loadDemoHistory = useMissionStore((s) => s.loadDemoHistory);
  const [profileId, setProfileId] = useState<MissionProfileId>(preferred ?? 'MARS_CONJUNCTION');
  const activeProfileId = preferred ?? profileId;
  const profiles = getLocalizedAllProfiles(lang);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-100">{t.missionUi.setup.heading}</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          {t.missionUi.setup.body}
        </p>
      </div>

      <div role="radiogroup" aria-label={t.missionUi.setup.radioAria} className={`grid gap-3 ${preferred ? 'max-w-xl' : 'md:grid-cols-3'}`}>
        {profiles
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
                <span className="text-xs text-slate-400 tabular-nums">{formatNumber(totalDays(p), lang)} {t.missionUi.setup.daysUnit}</span>
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
                  <li key={ph.id}>{ph.name} · {formatNumber(ph.days, lang)} {t.missionUi.setup.daysUnit}</li>
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
          <Rocket className="h-4 w-4" aria-hidden /> {t.missionUi.setup.startBtn}
        </button>
        <button
          type="button"
          onClick={() => loadDemoHistory(today, activeProfileId)}
          className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
        >
          {t.missionUi.setup.demoBtnPrefix} {formatNumber(demoDaysFor(activeProfileId), lang)} {t.missionUi.setup.demoBtnSuffix}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MissionHeader({ mission, today }: {
  mission: Mission;
  today: DayKey;
}) {
  const { lang, t } = useT();
  const records = useMissionStore((s) => s.records);
  const profile = getLocalizedProfile(mission.profileId, lang);
  const total = totalDays(profile);
  const day = Math.min(Math.max(1, missionDayOf(mission, today)), total);
  const { phase, dayInPhase } = phaseOfDay(profile, day);
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
            <span className="tabular-nums">({t.missionUi.header.dayInPhasePrefix} {dayInPhase} {t.missionUi.header.ofLabel} {phase.days})</span>
          </p>
          <p className="text-sm tabular-nums">
            <span className="text-2xl font-bold text-slate-100">{t.missionUi.header.dayPrefix} {day}</span>
            <span className="text-slate-500"> / {total}</span>
          </p>
        </div>
        <div className="flex gap-[2px]" aria-label={`${t.missionUi.header.progressAriaPrefix} ${day} ${t.missionUi.header.ofLabel} ${total}`}>
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
          <span>{t.missionUi.header.startPrefix} · {formatMissionDay(mission.startDate, lang)}</span>
          <span>{phase.description}</span>
          <span className="tabular-nums whitespace-nowrap">{formatNumber(total - day, lang)} {t.missionUi.header.daysRemainingSuffix}</span>
        </div>
      </div>

      {/* Rango y meta semanal */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">{t.missionUi.header.weekGoalPrefix} {week}</span>
            <span className="text-slate-500 tabular-nums">{weekDone}/{WEEKLY_TARGET_DAYS} {t.missionUi.header.daysUnit}</span>
          </div>
          <div className="flex gap-1 mt-1.5" aria-hidden>
            {Array.from({ length: WEEKLY_TARGET_DAYS }, (_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i < weekDone ? 'bg-cyan-400' : 'bg-slate-800'}`} />
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {streak > 0
              ? `${streak} ${streak === 1 ? t.missionUi.header.streakOne : t.missionUi.header.streakMany}`
              : t.missionUi.header.streakHint}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MissionEnded({ mission, totalXp }: { mission: Mission; totalXp: number }) {
  const { lang, t } = useT();
  const records = useMissionStore((s) => s.records);
  const resetAll = useMissionStore((s) => s.resetAll);
  const list = Object.values(records);
  const { rank } = getLocalizedRankFor(totalXp, lang);
  const profile = getLocalizedProfile(mission.profileId, lang);
  const unlocked = computeAchievements(mission, records).filter((a) => a.unlocked).length;

  return (
    <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/5 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Flag className="h-8 w-8 text-cyan-400" aria-hidden />
        <div>
          <h3 className="text-xl font-bold text-slate-100">
            {mission.aborted ? t.missionUi.ended.abortedTitle : t.missionUi.ended.completedTitle}
          </h3>
          <p className="text-sm text-slate-400">
            {profile.name} · {formatMissionDay(mission.startDate, lang)} → {mission.endedOn && formatMissionDay(mission.endedOn, lang)}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          [t.missionUi.ended.daysEvaluated, list.length],
          [t.missionUi.ended.completeDays, list.filter((r) => r.status === 'COMPLETE').length],
          [t.missionUi.ended.finalRank, rank.title],
          [t.missionUi.ended.achievements, unlocked],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <dt className="text-[11px] uppercase text-slate-500">{k}</dt>
            <dd className="text-lg font-bold text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-slate-400">
        {t.missionUi.ended.historyNote}
      </p>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(t.missionUi.ended.confirmNew)) resetAll();
        }}
        className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-cyan-400 cursor-pointer"
      >
        {t.missionUi.ended.newMissionBtn}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function MissionCenter({ preferredProfile }: { preferredProfile?: MissionProfileId } = {}) {
  const { lang, t } = useT();
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

  const crew = useActiveProfile();
  const loadDemoHistory = useMissionStore((s) => s.loadDemoHistory);

  // El destino elegido (Luna o Marte) manda: guarda la otra misión y abre esta.
  // Los tripulantes de demo llegan con su historial de días según el escenario.
  useEffect(() => {
    if (today === null || !preferredProfile) return;
    selectProfile(preferredProfile);
    if (crew?.demo && !useMissionStore.getState().mission) {
      loadDemoHistory(today, preferredProfile, crew.scenario === 'critical' ? 'critical' : 'stable');
    }
  }, [today, preferredProfile, selectProfile, crew?.id, crew?.demo, crew?.scenario, loadDemoHistory]);

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

  /** Ejecuta una acción y convierte lo ganado en notificaciones (paylod estructurado reactivo al idioma). */
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
    const s = useMissionStore.getState();

    const next: Toast[] = [];
    // Sin notificaciones de XP ni rango: no aportan información clínica.
    if (s.mission) {
      for (const a of computeAchievements(s.mission, s.records)) {
        if (a.unlocked && !before.unlocked.has(a.id)) {
          next.push({ id: ++toastSeq.current, tone: 'achievement', kind: 'achievement', achievementId: a.id });
        }
      }
    }
    if (next.length === 0) return;
    setToasts((prev) => [...prev, ...next].slice(-4));
    const ids = new Set(next.map((item) => item.id));
    setTimeout(() => setToasts((prev) => prev.filter((x) => !ids.has(x.id))), 3500);
  }, []);

  const achievements = mission ? computeLocalizedAchievements(mission, records, lang) : [];

  const renderToastText = (toast: Toast): string => {
    if (toast.kind === 'xp') {
      return `+${formatNumber(toast.xpAmount, lang)} XP`;
    }
    if (toast.kind === 'rank') {
      const baseRank = RANKS.find((r) => r.level === toast.rankLevel) ?? RANKS[0];
      return `${t.missionUi.toastRankPrefix} ${localizeRank(baseRank, lang).title}`;
    }
    const found = achievements.find((a) => a.id === toast.achievementId);
    return `${t.missionUi.toastAchievementPrefix} ${found ? found.title : toast.achievementId}`;
  };

  return (
    <section
      aria-labelledby="mission-center-title"
      className="relative bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="mission-center-title" className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
            {t.missionUi.title}
          </h2>
          <p className="font-lead text-base text-slate-300 mt-1">
            {t.missionUi.subtitle}
          </p>
        </div>
        {mission?.simulatedHistory && (
          <span className="text-[11px] uppercase tracking-wider text-amber-300 border border-amber-500/60 rounded px-2 py-1">
            {t.missionUi.simulatedDemoBadge}
          </span>
        )}
      </div>

      {today === null ? (
        <p className="text-sm text-slate-500">{t.missionUi.loading}</p>
      ) : (
        <div className="space-y-6">
          {!mission ? (
            <MissionSetup today={today} preferred={preferredProfile} />
          ) : (
            <>

          {mission.endedOn ? (
            <MissionEnded mission={mission} totalXp={totalXp} />
          ) : (
            <MissionHeader mission={mission} today={today} />
          )}

          <div role="tablist" aria-label={t.missionUi.tablistAria} className="flex gap-1 border-b border-slate-800 overflow-x-auto no-scrollbar">
            {TAB_DEFS.filter((tabItem) => !(mission.endedOn && tabItem.id === 'today')).map((tabItem) => {
              const Icon = tabItem.icon;
              const active = tab === tabItem.id || (mission.endedOn && tab === 'today' && tabItem.id === 'calendar');
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  role="tab"
                  aria-selected={!!active}
                  onClick={() => setTab(tabItem.id)}
                  className={`min-h-[44px] inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                    active ? 'border-cyan-400 text-cyan-200' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden /> {t.missionUi.tabs[tabItem.id]}
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
                      <Award className="h-6 w-6 text-amber-400 shrink-0" aria-label={t.missionUi.unlockedAria} />
                    ) : (
                      <Lock className="h-6 w-6 text-slate-600 shrink-0" aria-label={t.missionUi.lockedAria} />
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

          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-800 text-xs">
            {!mission.endedOn && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t.missionUi.confirmAbort)) abortMission(today);
                }}
                className="min-h-[44px] inline-flex items-center px-2 text-slate-500 hover:text-amber-300 cursor-pointer"
              >
                {t.missionUi.abortBtn}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t.missionUi.confirmReset)) resetAll();
              }}
              className="min-h-[44px] inline-flex items-center px-2 text-slate-500 hover:text-red-300 cursor-pointer"
            >
              {t.missionUi.resetBtn}
            </button>
          </div>
        </>
          )}
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-20 xl:bottom-4 z-50 flex flex-col items-end gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`inline-flex items-center gap-2 rounded-lg border bg-slate-950/95 px-3 py-2 text-sm font-semibold shadow-lg shadow-black/40 animate-[toast-in_200ms_ease-out] ${TOAST_STYLE[toast.tone]}`}
          >
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            {renderToastText(toast)}
          </div>
        ))}
      </div>
    </section>
  );
}

export default MissionCenter;
