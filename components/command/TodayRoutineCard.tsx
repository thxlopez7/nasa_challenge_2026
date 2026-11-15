'use client';

import {
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
  Flame,
  Sparkles,
} from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { useClinicalSnapshot } from '../../store/selectors';
import { useCommandUiStore } from '../../store/useCommandUiStore';
import { selectTotalXp, useMissionStore } from '../../store/useMissionStore';
import type { EvaluationStepId } from '../../types/mission';
import { deriveDailyCountermeasures } from '../../utils/countermeasures';
import { formatNumber } from '../../utils/formatters';
import type { MissionSlug } from '../../utils/missionChoice';
import {
  HYDRATION_TARGET,
  missionDayOf,
  missionWeekOf,
  toDayKey,
  weeklyStreak,
} from '../../utils/missionPlan';

export function TodayRoutineCard({ mision }: { mision?: MissionSlug }) {
  const { lang, t } = useT();
  const snapshot = useClinicalSnapshot(mision);
  const setActiveTab = useCommandUiStore((s) => s.setActiveTab);
  const openLogSection = useCommandUiStore((s) => s.openLogSection);

  const mission = useMissionStore((s) => s.mission);
  const records = useMissionStore((s) => s.records);
  const session = useMissionStore((s) => s.session);
  const totalXp = useMissionStore(selectTotalXp);

  const today = toDayKey(new Date());
  const sessionToday = session?.date === today ? session : null;
  const recordToday = records[today];

  const completedSet = new Set<EvaluationStepId>([
    ...(sessionToday?.completedSteps ?? []),
    ...(recordToday?.completedSteps ?? []),
  ]);

  const spotVitalsDone = Boolean(
    snapshot.indicatorMeta?.bp?.measuredAt?.startsWith(today) ||
      snapshot.indicatorMeta?.glucose?.measuredAt?.startsWith(today) ||
      snapshot.indicatorMeta?.temp?.measuredAt?.startsWith(today) ||
      sessionToday?.vitals ||
      recordToday?.vitals
  );

  const checkInDone = Boolean(
    snapshot.behavioralCheckIn?.updatedAt?.startsWith(today) ||
      sessionToday?.selfReport ||
      recordToday?.selfReport
  );

  const plan = deriveDailyCountermeasures({
    biomarkers: snapshot.biomarkers,
    environment: snapshot.environment,
    alerts: snapshot.alerts,
    missionProfileId: snapshot.missionProfileId,
    lang,
  });

  const nonHoldItems = plan.items.filter(
    (item) => item.priority !== 'hold' && item.stepId !== 'HYDRATION'
  );
  const countermeasuresDone =
    recordToday?.status === 'COMPLETE' ||
    (nonHoldItems.length > 0 &&
      nonHoldItems.every((item) => completedSet.has(item.stepId)));

  const hydrationCount = sessionToday
    ? sessionToday.hydrationCount
    : completedSet.has('HYDRATION')
      ? HYDRATION_TARGET
      : 0;
  const hydrationDone = hydrationCount >= HYDRATION_TARGET;

  const items = [
    {
      id: 'vitals',
      label: t.command.routine.itemVitals,
      done: spotVitalsDone,
      statusText: spotVitalsDone
        ? t.command.routine.doneLabel
        : t.command.routine.goCta,
      onClick: () => openLogSection('vitals'),
    },
    {
      id: 'checkin',
      label: t.command.routine.itemCheckIn,
      done: checkInDone,
      statusText: checkInDone
        ? t.command.routine.doneLabel
        : t.command.routine.goCta,
      onClick: () => openLogSection('behavioral'),
    },
    {
      id: 'countermeasures',
      label: t.command.routine.itemCountermeasure,
      done: countermeasuresDone,
      statusText: countermeasuresDone
        ? t.command.routine.doneLabel
        : t.command.routine.goCta,
      onClick: () => setActiveTab('mision'),
    },
    {
      id: 'hydration',
      label: t.command.routine.itemHydration,
      done: hydrationDone,
      statusText: `${formatNumber(Math.min(hydrationCount, HYDRATION_TARGET), lang)}/${formatNumber(HYDRATION_TARGET, lang)}`,
      onClick: () => setActiveTab('mision'),
    },
  ];

  const doneCount = items.filter((item) => item.done).length;
  const streak = mission
    ? weeklyStreak(records, missionWeekOf(missionDayOf(mission, today)))
    : 0;

  return (
    <section
      aria-labelledby="today-routine-title"
      className="rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h2
            id="today-routine-title"
            className="text-xs font-bold uppercase tracking-wider text-cyan-400"
          >
            {t.command.routine.title}
          </h2>
          <span className="text-[11px] font-mono text-slate-300">
            {formatNumber(doneCount, lang)}/4 {t.command.routine.progressLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-amber-200 font-semibold">
            <Flame className="h-3 w-3 text-amber-400" aria-hidden />
            <span>
              {t.command.routine.streakLabel} {formatNumber(streak, lang)}{' '}
              {t.command.routine.streakUnit}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-cyan-200 font-semibold">
            <Award className="h-3 w-3 text-cyan-400" aria-hidden />
            <span>
              {formatNumber(totalXp, lang)} {t.command.routine.xpLabel}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setActiveTab('mision')}
            className="min-h-[44px] inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 cursor-pointer transition"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            <span>{t.command.routine.openEvaluationCta}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={`min-h-[44px] rounded-lg border px-2.5 py-1.5 flex items-center justify-between gap-2 text-left cursor-pointer transition ${
              item.done
                ? 'border-emerald-500/35 bg-emerald-950/20 hover:border-emerald-400/60 text-emerald-100'
                : 'border-slate-700/80 bg-slate-950/70 hover:border-cyan-500/50 text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {item.done ? (
                <CheckCircle2
                  className="h-4 w-4 text-emerald-400 shrink-0"
                  aria-hidden
                />
              ) : (
                <Circle
                  className="h-4 w-4 text-slate-500 shrink-0"
                  aria-hidden
                />
              )}
              <span className="text-xs font-medium truncate">{item.label}</span>
            </span>

            <span className="inline-flex items-center gap-1 text-[11px] font-mono shrink-0 text-slate-300">
              <span>{item.statusText}</span>
              {!item.done && <ArrowRight className="h-3 w-3 text-cyan-400" aria-hidden />}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default TodayRoutineCard;
