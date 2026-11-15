'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  CornerDownRight,
  Droplets,
  Pause,
  Play,
  Siren,
} from 'lucide-react';
import type { TelemetryData } from '../../types/telemetry';
import type {
  DayKey,
  EvaluationSession,
  EvaluationStepId,
  SelfReport,
} from '../../types/mission';
import { useMissionStore } from '../../store/useMissionStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import {
  EVALUATION_STEPS,
  FULL_DAY_BONUS,
  HYDRATION_TARGET,
  hasClinicalAlert,
  stepIndexOf,
} from '../../utils/missionPlan';
import {
  buildLocalizedDiagnosis,
  getLocalizedEvaluationSteps,
} from '../../utils/missionPlanL10n';
import { formatDecimal, formatNumber } from '../../utils/formatters';
import { useT } from '../../i18n/I18nContext';
import type { SleepNight } from '../../types/sleep';
import { simulateSleepNight } from '../../utils/sleepSensing';
import CoherencePacer from './CoherencePacer';
import SleepSensorPanel from './SleepSensorPanel';
import DiagnosticPanel from './DiagnosticPanel';

type Run = (action: () => void) => void;

const PRIMARY =
  'min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-cyan-400 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const SECONDARY =
  'min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

/** Lee la telemetría actual como datos puros (sin acciones del store). */
function snapshotTelemetry(): TelemetryData {
  const s = useTelemetryStore.getState();
  return {
    heartRate: s.heartRate,
    spO2: s.spO2,
    cistatinaC: s.cistatinaC,
    creatinina: s.creatinina,
    calcioIonico: s.calcioIonico,
    linfocitos: s.linfocitos,
    neutrofilos: s.neutrofilos,
    cortisol: s.cortisol,
    co2Level: s.co2Level,
    radiationRate: s.radiationRate,
    radiationAccumulated: s.radiationAccumulated,
    isEmergency: s.isEmergency,
    isRenalWarning: s.isRenalWarning,
    isRadiationWarning: s.isRadiationWarning,
    isCo2Warning: s.isCo2Warning,
  };
}

function useLiveTelemetry(): TelemetryData {
  const s = useTelemetryStore();
  return {
    heartRate: s.heartRate,
    spO2: s.spO2,
    cistatinaC: s.cistatinaC,
    creatinina: s.creatinina,
    calcioIonico: s.calcioIonico,
    linfocitos: s.linfocitos,
    neutrofilos: s.neutrofilos,
    cortisol: s.cortisol,
    co2Level: s.co2Level,
    radiationRate: s.radiationRate,
    radiationAccumulated: s.radiationAccumulated,
    isEmergency: s.isEmergency,
    isRenalWarning: s.isRenalWarning,
    isRadiationWarning: s.isRadiationWarning,
    isCo2Warning: s.isCo2Warning,
  };
}

/* ------------------------------------------------------------------ */

function Stepper({ session }: { session: EvaluationSession }) {
  const { lang, t } = useT();
  const goToStep = useMissionStore((s) => s.goToStep);
  const steps = getLocalizedEvaluationSteps(lang);
  const current = steps[session.stepIndex].id;

  return (
    <ol className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
      {steps.map((step, i) => {
        const done = session.completedSteps.includes(step.id);
        const skipped = session.skippedSteps.includes(step.id);
        const active = step.id === current;
        const reachable = session.status === 'ACTIVE' && !done && step.id !== 'DEBRIEF';
        const Icon = done ? CheckCircle2 : skipped ? CornerDownRight : Circle;
        const state = done
          ? t.missionUi.eval.states.done
          : skipped
            ? t.missionUi.eval.states.skipped
            : active
              ? t.missionUi.eval.states.current
              : t.missionUi.eval.states.pending;

        return (
          <li key={step.id} className="shrink-0">
            <button
              type="button"
              disabled={!reachable && !active}
              onClick={() => goToStep(step.id)}
              aria-current={active ? 'step' : undefined}
              aria-label={`${t.missionUi.eval.stepPrefix} ${i + 1}: ${step.title} (${state})`}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${
                active
                  ? 'bg-cyan-500/15 text-cyan-200 font-semibold'
                  : done
                    ? 'text-slate-300'
                    : skipped
                      ? 'text-amber-300/80 hover:bg-slate-800 cursor-pointer'
                      : 'text-slate-500 hover:bg-slate-800 cursor-pointer disabled:cursor-default disabled:hover:bg-transparent'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${done ? 'text-cyan-400' : ''}`}
                aria-hidden
              />
              <span className="whitespace-nowrap">{step.short}</span>
              {skipped && (
                <span className="ml-auto text-[10px] uppercase tracking-wider">
                  {t.missionUi.eval.skippedTag}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */

function ScaleInput({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-slate-200">{label}</legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={`min-h-[44px] min-w-[44px] rounded-lg border text-sm font-bold transition cursor-pointer ${
              value === n
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-slate-500 max-w-[232px]">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}

function CheckInStep({ date, run }: { date: DayKey; run: Run }) {
  const { t } = useT();
  const submitCheckIn = useMissionStore((s) => s.submitCheckIn);
  const [night, setNight] = useState<SleepNight | null>(null);
  const [feel, setFeel] = useState({ mood: 3, fatigue: 2 });

  // La noche llega del sensor: las horas de sueño ya no se cargan a mano.
  const syncNight = () => setNight(simulateSleepNight(date, useTelemetryStore.getState()));
  const report: SelfReport | null = night
    ? { sleepHours: night.summary.totalHours, sleep: night.summary, ...feel }
    : null;

  return (
    <div className="space-y-5">
      <SleepSensorPanel night={night} onSync={syncNight} />
      <div className="grid sm:grid-cols-2 gap-5">
        <ScaleInput
          label={t.missionUi.eval.moodLabel}
          low={t.missionUi.eval.moodLow}
          high={t.missionUi.eval.moodHigh}
          value={feel.mood}
          onChange={(mood) => setFeel({ ...feel, mood })}
        />
        <ScaleInput
          label={t.missionUi.eval.fatigueLabel}
          low={t.missionUi.eval.fatigueLow}
          high={t.missionUi.eval.fatigueHigh}
          value={feel.fatigue}
          onChange={(fatigue) => setFeel({ ...feel, fatigue })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={PRIMARY}
          disabled={!report}
          onClick={() => report && run(() => submitCheckIn(report))}
        >
          {t.missionUi.eval.saveCheckInBtn}
        </button>
        {!report && (
          <span className="text-xs text-slate-500">{t.missionUi.eval.syncFirstHint}</span>
        )}
      </div>
    </div>
  );
}

function VitalsStep({ run }: { run: Run }) {
  const { lang, t } = useT();
  const captureVitals = useMissionStore((s) => s.captureVitals);
  const pause = useMissionStore((s) => s.pause);
  const live = useLiveTelemetry();

  const capture = () =>
    run(() => {
      const vitals = snapshotTelemetry();
      captureVitals(vitals);
      // Una alerta RIDGE detiene la evaluación para atenderla primero.
      if (hasClinicalAlert(vitals)) pause('CLINICAL_ALERT');
    });

  const vr = t.missionUi.eval.vitalsRows;
  const rows: [string, string][] = [
    [vr.hr, `${formatNumber(live.heartRate, lang)} bpm`],
    [vr.spo2, `${formatNumber(live.spO2, lang)}%`],
    [vr.co2, `${formatNumber(live.co2Level, lang)} ppm`],
    [vr.cysC, `${formatDecimal(live.cistatinaC, 2, lang)} mg/L`],
    [vr.cr, `${formatDecimal(live.creatinina, 2, lang)} mg/dL`],
    [vr.ca, `${formatDecimal(live.calcioIonico, 2, lang)} mmol/L`],
    [vr.lymph, `${formatNumber(live.linfocitos, lang)} ${t.dashboardExtra.lymphUnit}`],
    [vr.cortisol, `${formatDecimal(live.cortisol, 1, lang)} ng/mL`],
    [vr.radRate, `${formatNumber(live.radiationRate, lang)} µSv/h`],
    [vr.radAcc, `${formatDecimal(live.radiationAccumulated, 1, lang)} mSv`],
  ];

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <dt className="text-[11px] uppercase text-slate-500">{k}</dt>
            <dd className="text-base font-bold text-slate-100 tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-400">{t.missionUi.eval.vitalsHint}</p>
      <button type="button" className={PRIMARY} onClick={capture}>
        {t.missionUi.eval.captureVitalsBtn}
      </button>
    </div>
  );
}

function ExerciseStep({
  id,
  fatigue,
  run,
}: {
  id: EvaluationStepId;
  fatigue?: number;
  run: Run;
}) {
  const { t } = useT();
  const completeStep = useMissionStore((s) => s.completeStep);
  const skipStep = useMissionStore((s) => s.skipStep);

  return (
    <div className="space-y-5">
      {fatigue !== undefined && fatigue >= 4 && (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-3 text-sm text-amber-200">
          {t.missionUi.eval.highFatigueHint}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={PRIMARY} onClick={() => run(() => completeStep(id))}>
          <Check className="h-4 w-4" aria-hidden /> {t.missionUi.eval.sessionCompleteBtn}
        </button>
        <button type="button" className={SECONDARY} onClick={() => run(() => skipStep(id))}>
          {t.missionUi.eval.skipTodayBtn}
        </button>
      </div>
    </div>
  );
}

function HydrationStep({ count, run }: { count: number; run: Run }) {
  const { t } = useT();
  const logHydration = useMissionStore((s) => s.logHydration);
  const skipStep = useMissionStore((s) => s.skipStep);

  return (
    <div className="space-y-5">
      <div
        className="flex gap-3"
        aria-label={`${count} ${t.missionUi.eval.hydrationAriaPrefix} ${HYDRATION_TARGET}`}
      >
        {Array.from({ length: HYDRATION_TARGET }, (_, i) => (
          <Droplets
            key={i}
            className={`h-9 w-9 transition-colors ${i < count ? 'text-cyan-400' : 'text-slate-700'}`}
            aria-hidden
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={PRIMARY} onClick={() => run(logHydration)}>
          {t.missionUi.eval.hydrationBtn} ({count}/{HYDRATION_TARGET})
        </button>
        <button type="button" className={SECONDARY} onClick={() => run(() => skipStep('HYDRATION'))}>
          {t.missionUi.eval.skipTodayBtn}
        </button>
      </div>
    </div>
  );
}

function MindStep({ run }: { run: Run }) {
  const { t } = useT();
  const completeStep = useMissionStore((s) => s.completeStep);
  const skipStep = useMissionStore((s) => s.skipStep);

  return (
    <div className="space-y-5">
      <CoherencePacer onComplete={() => run(() => completeStep('MIND'))} />
      <button type="button" className={SECONDARY} onClick={() => run(() => skipStep('MIND'))}>
        {t.missionUi.eval.skipTodayBtn}
      </button>
    </div>
  );
}

function DebriefStep({ session, run }: { session: EvaluationSession; run: Run }) {
  const { lang, t } = useT();
  const finishDay = useMissionStore((s) => s.finishDay);
  const goToStep = useMissionStore((s) => s.goToStep);
  const steps = getLocalizedEvaluationSteps(lang);
  const required = steps.filter((s) => s.id !== 'DEBRIEF');
  const complete = required.every((s) => session.completedSteps.includes(s.id));
  const pending = required.filter(
    (s) => !session.completedSteps.includes(s.id)
  );
  const diagnosis = session.vitals
    ? buildLocalizedDiagnosis(session.vitals, session.selfReport, lang)
    : null;

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">{t.missionUi.eval.debriefSteps}</p>
          <p className="text-xl font-bold tabular-nums">
            {session.completedSteps.length}/{required.length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">{t.missionUi.eval.debriefFullBonus}</p>
          <p className={`text-xl font-bold ${complete ? 'text-cyan-300' : 'text-slate-600'}`}>
            {complete ? `+${FULL_DAY_BONUS}` : t.missionUi.eval.debriefPending}
          </p>
        </div>
      </div>

      {diagnosis && (
        <DiagnosticPanel diagnosis={diagnosis} title={t.missionUi.eval.debriefTodayDiag} />
      )}

      {pending.length > 0 && (
        <div className="text-sm text-slate-400 space-y-2">
          <p>{t.missionUi.eval.debriefSkippedHint}</p>
          <div className="flex flex-wrap gap-2">
            {pending.map((s) => (
              <button
                key={s.id}
                type="button"
                className={SECONDARY}
                onClick={() => goToStep(s.id)}
              >
                {s.short}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" className={PRIMARY} onClick={() => run(finishDay)}>
        {t.missionUi.eval.debriefFinishBtn}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PausedView({ session, run }: { session: EvaluationSession; run: Run }) {
  const { lang, t } = useT();
  const resume = useMissionStore((s) => s.resume);
  const closeAsExcused = useMissionStore((s) => s.closeAsExcused);
  const live = useLiveTelemetry();
  const steps = getLocalizedEvaluationSteps(lang);
  const diagnosis = buildLocalizedDiagnosis(live, session.selfReport, lang);
  const codeRed = live.isEmergency;
  const required = steps.length - 1;
  const medical = session.pauseReason !== 'USER' || diagnosis.severity !== 'OPTIMAL';

  const reasonText = t.missionUi.eval.pauseReasons[session.pauseReason ?? 'USER'];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${codeRed ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
          {codeRed ? <Siren className="h-5 w-5" aria-hidden /> : <Pause className="h-5 w-5" aria-hidden />}
        </span>
        <div>
          <h3 className="text-lg font-bold text-slate-100">{t.missionUi.eval.pausedTitle}</h3>
          <p className="text-sm text-slate-400">{reasonText}</p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {t.missionUi.eval.savedProgress} {session.completedSteps.length} {t.missionUi.eval.ofLabel} {required} {t.missionUi.eval.stepsUnit} ·{' '}
            {t.missionUi.eval.resumesAt} «{steps[session.stepIndex].short}»
          </p>
        </div>
      </div>

      <DiagnosticPanel diagnosis={diagnosis} title={t.missionUi.eval.realtimeDiagTitle} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={PRIMARY}
          disabled={codeRed}
          onClick={() => run(resume)}
        >
          <Play className="h-4 w-4" aria-hidden /> {t.missionUi.eval.resumeBtn}
        </button>
        {medical && (
          <button type="button" className={SECONDARY} onClick={() => run(closeAsExcused)}>
            {t.missionUi.eval.closeExcusedBtn}
          </button>
        )}
      </div>
      {codeRed && (
        <p className="text-xs text-red-300">
          {t.missionUi.eval.codeRedResumeHint}
        </p>
      )}
      {medical && (
        <p className="text-xs text-slate-500">
          {t.missionUi.eval.excusedNote}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function DailyEvaluation({
  today,
  missionDay,
  run,
}: {
  today: DayKey;
  missionDay: number;
  run: Run;
}) {
  const { lang, t } = useT();
  const session = useMissionStore((s) => s.session);
  const record = useMissionStore((s) => s.records[today]);
  const startEvaluation = useMissionStore((s) => s.startEvaluation);
  const pause = useMissionStore((s) => s.pause);
  const isEmergency = useTelemetryStore((s) => s.isEmergency);
  const steps = getLocalizedEvaluationSteps(lang);

  // Code Red durante la evaluación → pausa automática.
  useEffect(() => {
    if (isEmergency && session?.status === 'ACTIVE') pause('CODE_RED');
  }, [isEmergency, session?.status, pause]);

  if (record && !session) {
    const diagnosis = record.vitals
      ? buildLocalizedDiagnosis(record.vitals, record.selfReport, lang)
      : null;
    const label = t.missionUi.eval.closedStatuses[record.status];
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-8 w-8 text-cyan-400 shrink-0" aria-hidden />
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {t.missionUi.eval.closedHeadingPrefix} {missionDay} {t.missionUi.eval.closedHeadingSuffix} · {label}
            </h3>
            <p className="text-sm text-slate-400">
              {t.missionUi.eval.closedEarnedPrefix} {formatNumber(record.xp, lang)} {t.missionUi.eval.closedNextTomorrow}
            </p>
          </div>
        </div>
        {diagnosis && <DiagnosticPanel diagnosis={diagnosis} title={t.missionUi.eval.closedDiagTitle} />}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-bold text-slate-100">
            {t.missionUi.eval.startTitlePrefix} {missionDay}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {steps.length} {t.missionUi.eval.startBodySuffix}
          </p>
        </div>
        <ol className="grid sm:grid-cols-2 gap-2">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <span className="h-6 w-6 shrink-0 rounded-full bg-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-200">{s.title}</p>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className={PRIMARY} onClick={() => run(() => startEvaluation(today))}>
          <Play className="h-4 w-4" aria-hidden /> {t.missionUi.eval.startBtn}
        </button>
      </div>
    );
  }

  const step = steps[session.stepIndex];

  return (
    <div className="grid lg:grid-cols-[200px_1fr] gap-6">
      <Stepper session={session} />

      <div className="min-w-0 space-y-4">
        {session.status === 'PAUSED' ? (
          <PausedView session={session} run={run} />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-cyan-500">
                  {t.missionUi.eval.stepPrefix} {stepIndexOf(step.id) + 1} {t.missionUi.eval.ofLabel} {EVALUATION_STEPS.length}
                </p>
                <h3 className="text-lg font-bold text-slate-100">{step.title}</h3>
                <p className="text-sm text-slate-400">{step.description}</p>
              </div>
              <button type="button" className={SECONDARY} onClick={() => pause('USER')}>
                <Pause className="h-4 w-4" aria-hidden /> {t.missionUi.eval.pauseBtn}
              </button>
            </div>

            {step.id === 'CHECK_IN' && <CheckInStep date={session.date} run={run} />}
            {step.id === 'VITALS' && <VitalsStep run={run} />}
            {(step.id === 'RESISTIVE' || step.id === 'AEROBIC') && (
              <ExerciseStep id={step.id} fatigue={session.selfReport?.fatigue} run={run} />
            )}
            {step.id === 'HYDRATION' && <HydrationStep count={session.hydrationCount} run={run} />}
            {step.id === 'MIND' && <MindStep run={run} />}
            {step.id === 'DEBRIEF' && <DebriefStep session={session} run={run} />}
          </>
        )}
      </div>
    </div>
  );
}

export default DailyEvaluation;
