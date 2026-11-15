'use client';

import { useCallback } from 'react';
import {
  Activity,
  Award,
  Bone,
  CheckCircle2,
  Droplets,
  Flame,
  HeartPulse,
  PauseCircle,
  Sparkles,
} from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { useClinicalSnapshot } from '../../store/selectors';
import { selectTotalXp, useMissionStore } from '../../store/useMissionStore';
import type { DayKey, EvaluationStepId } from '../../types/mission';
import {
  deriveDailyCountermeasures,
  type CountermeasureItem,
} from '../../utils/countermeasures';
import type { MissionSlug } from '../../utils/missionChoice';
import {
  HYDRATION_TARGET,
  missionDayOf,
  missionWeekOf,
  toDayKey,
  weeklyStreak,
} from '../../utils/missionPlan';

export function TodayCountermeasures({
  mision,
  todayOverride,
  runWithToast,
}: {
  mision?: MissionSlug;
  todayOverride?: DayKey | null;
  runWithToast?: (action: () => void) => void;
}) {
  const { lang } = useT();
  const snapshot = useClinicalSnapshot(mision);

  const mission = useMissionStore((s) => s.mission);
  const records = useMissionStore((s) => s.records);
  const session = useMissionStore((s) => s.session);
  const totalXp = useMissionStore(selectTotalXp);
  const startMission = useMissionStore((s) => s.startMission);
  const startEvaluation = useMissionStore((s) => s.startEvaluation);
  const completeStep = useMissionStore((s) => s.completeStep);
  const logHydration = useMissionStore((s) => s.logHydration);

  const today = todayOverride ?? toDayKey(new Date());
  const streak = mission
    ? weeklyStreak(records, missionWeekOf(missionDayOf(mission, today)))
    : 0;

  const plan = deriveDailyCountermeasures({
    biomarkers: snapshot.biomarkers,
    environment: snapshot.environment,
    alerts: snapshot.alerts,
    missionProfileId: snapshot.missionProfileId,
    lang,
  });

  const completedSet = new Set<EvaluationStepId>([
    ...(session?.completedSteps ?? []),
    ...(records[today]?.completedSteps ?? []),
  ]);

  const handleCompleteCountermeasure = useCallback(
    (item: CountermeasureItem) => {
      if (item.priority === 'hold') return;

      const exec = () => {
        const state = useMissionStore.getState();
        if (!state.mission) {
          startMission(snapshot.missionProfileId, today);
        }
        const afterMission = useMissionStore.getState();
        if (afterMission.mission && !afterMission.session && !afterMission.records[today]) {
          startEvaluation(today);
        }
        if (item.stepId === 'HYDRATION') {
          const currentHyd = useMissionStore.getState().session?.hydrationCount ?? 0;
          const remaining = Math.max(1, HYDRATION_TARGET - currentHyd);
          for (let i = 0; i < remaining; i += 1) {
            logHydration();
          }
        } else {
          completeStep(item.stepId);
        }
      };

      if (runWithToast) {
        runWithToast(exec);
      } else {
        exec();
      }
    },
    [
      completeStep,
      logHydration,
      runWithToast,
      snapshot.missionProfileId,
      startEvaluation,
      startMission,
      today,
    ]
  );

  const b = snapshot.biomarkers;

  const copy =
    lang === 'es'
      ? {
          eyebrow: 'P6 · SALUD ÓSEA, CARDIOVASCULAR Y ADHERENCIA',
          title: 'Contramedidas de hoy',
          streak: 'Racha',
          days: 'sem.',
          boneCard: 'Perfil Óseo / Muscular (sin DXA a bordo)',
          cardioCard: 'Desacondicionamiento y Tolerancia Ortostática',
          doneBtn: 'Completado',
          doBtn: 'Completar paso',
          holdBtn: 'En pausa por seguridad',
          orthoLabels: {
            normal: 'Tolerancia ortostática normal',
            borderline: 'Ortostática limítrofe',
            'positive-intolerance': 'Intolerancia ortostática positiva',
            unmeasured: 'Sin prueba ortostática reciente',
          },
        }
      : {
          eyebrow: 'P6 · BONE, CARDIOVASCULAR & ADHERENCE',
          title: "Today's Countermeasures",
          streak: 'Streak',
          days: 'wk',
          boneCard: 'Bone & Muscle Panel (No Onboard DXA)',
          cardioCard: 'Cardio Deconditioning & Orthostatic Screen',
          doneBtn: 'Completed',
          doBtn: 'Log completion',
          holdBtn: 'Held for safety',
          orthoLabels: {
            normal: 'Normal orthostatic tolerance',
            borderline: 'Borderline orthostatic response',
            'positive-intolerance': 'Positive orthostatic intolerance',
            unmeasured: 'No recent orthostatic check',
          },
        };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-cyan-400">
            {copy.eyebrow}
          </p>
          <h2 className="text-lg font-bold text-slate-100 mt-0.5 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" aria-hidden="true" />
            <span>{copy.title}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200">
            <Award className="w-4 h-4 text-amber-400" aria-hidden="true" />
            {totalXp} XP
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-200">
            <Flame className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            {copy.streak}: {streak} {copy.days}
          </span>
        </div>
      </div>

      {/* Dos tarjetas de síntesis P6: Óseo/Muscular y Cardio ampliado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-300">
            <Bone className="w-4 h-4" aria-hidden="true" />
            <span>{copy.boneCard}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div className="rounded bg-slate-900/80 border border-slate-800 p-2">
              <p className="text-[10px] text-slate-400">CTX/NTX</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5 tabular-nums">
                {b.ctxNtxIndex !== undefined ? b.ctxNtxIndex.toFixed(2) : '—'}
              </p>
            </div>
            <div className="rounded bg-slate-900/80 border border-slate-800 p-2">
              <p className="text-[10px] text-slate-400">P1NP</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5 tabular-nums">
                {b.p1npIndex !== undefined ? b.p1npIndex.toFixed(2) : '—'}
              </p>
            </div>
            <div className="rounded bg-slate-900/80 border border-slate-800 p-2">
              <p className="text-[10px] text-slate-400">ARED</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5 tabular-nums">
                {b.aredLoadPct !== undefined ? `${Math.round(b.aredLoadPct)}%` : '—'}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{plan.boneSummary}</p>
          <p className="text-[11px] text-amber-200/90 bg-amber-950/30 border border-amber-500/30 rounded p-2">
            {plan.dxaLimitationNote}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
            <HeartPulse className="w-4 h-4" aria-hidden="true" />
            <span>{copy.cardioCard}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div className="rounded bg-slate-900/80 border border-slate-800 p-2">
              <p className="text-[10px] text-slate-400">HRV RMSSD</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5 tabular-nums">
                {b.hrvRmssdMs !== undefined ? `${Math.round(b.hrvRmssdMs)} ms` : '—'}
              </p>
            </div>
            <div className="rounded bg-slate-900/80 border border-slate-800 p-2">
              <p className="text-[10px] text-slate-400">Ortost. ΔFC</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5 tabular-nums">
                {b.orthostaticDeltaHr !== undefined ? `+${Math.round(b.orthostaticDeltaHr)}` : '—'}
              </p>
            </div>
            <div className="rounded bg-slate-900/80 border border-slate-800 p-2">
              <p className="text-[10px] text-slate-400">Ortost. ΔPAS</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5 tabular-nums">
                {b.orthostaticDeltaSys !== undefined ? `${Math.round(b.orthostaticDeltaSys)}` : '—'}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{plan.cardioSummary}</p>
          <span
            className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded border ${
              plan.orthostaticStatus === 'positive-intolerance'
                ? 'border-rose-500/60 bg-rose-500/15 text-rose-200'
                : plan.orthostaticStatus === 'borderline'
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                  : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            {copy.orthoLabels[plan.orthostaticStatus]}
          </span>
        </div>
      </div>

      {/* Lista de contramedidas accionables vinculadas a XP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {plan.items.map((item) => {
          const isDone = completedSet.has(item.stepId);
          const isHold = item.priority === 'hold';
          const Icon =
            item.category === 'bone'
              ? Bone
              : item.category === 'cardio'
                ? Activity
                : item.category === 'hydration'
                  ? Droplets
                  : HeartPulse;

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                isDone
                  ? 'border-emerald-500/60 bg-emerald-950/20'
                  : isHold
                    ? 'border-red-500/60 bg-red-950/20'
                    : item.priority === 'high'
                      ? 'border-amber-500/70 bg-amber-950/20'
                      : 'border-slate-800 bg-slate-950/60'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-slate-100">
                      {item.title}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-amber-300 shrink-0">
                    +{item.xpReward} XP
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {item.prescription}
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {item.why}
                </p>
              </div>

              <button
                type="button"
                disabled={isDone || isHold}
                onClick={() => handleCompleteCountermeasure(item)}
                className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-colors ${
                  isDone
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50 cursor-default'
                    : isHold
                      ? 'bg-red-950/60 text-red-200 border border-red-500/50 cursor-not-allowed'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer'
                }`}
              >
                {isDone ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>{copy.doneBtn}</span>
                  </>
                ) : isHold ? (
                  <>
                    <PauseCircle className="w-4 h-4" aria-hidden="true" />
                    <span>{copy.holdBtn}</span>
                  </>
                ) : (
                  <span>{copy.doBtn}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default TodayCountermeasures;
