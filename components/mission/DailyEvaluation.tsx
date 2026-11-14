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
  MAX_DAILY_XP,
  buildDiagnosis,
  hasClinicalAlert,
  stepIndexOf,
} from '../../utils/missionPlan';
import CoherencePacer from './CoherencePacer';
import DiagnosticPanel from './DiagnosticPanel';

type Run = (action: () => void) => void;

const PRIMARY =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-cyan-400 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const SECONDARY =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

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
  const goToStep = useMissionStore((s) => s.goToStep);
  const current = EVALUATION_STEPS[session.stepIndex].id;

  return (
    <ol className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
      {EVALUATION_STEPS.map((step, i) => {
        const done = session.completedSteps.includes(step.id);
        const skipped = session.skippedSteps.includes(step.id);
        const active = step.id === current;
        const reachable = session.status === 'ACTIVE' && !done && step.id !== 'DEBRIEF';
        const Icon = done ? CheckCircle2 : skipped ? CornerDownRight : Circle;
        const state = done ? 'hecho' : skipped ? 'omitido' : active ? 'actual' : 'pendiente';

        return (
          <li key={step.id} className="shrink-0">
            <button
              type="button"
              disabled={!reachable && !active}
              onClick={() => goToStep(step.id)}
              aria-current={active ? 'step' : undefined}
              aria-label={`Paso ${i + 1}: ${step.title} (${state})`}
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
                <span className="ml-auto text-[10px] uppercase tracking-wider">omitido</span>
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
            className={`h-10 w-10 rounded-lg border text-sm font-bold transition cursor-pointer ${
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

function CheckInStep({ run }: { run: Run }) {
  const submitCheckIn = useMissionStore((s) => s.submitCheckIn);
  const [report, setReport] = useState<SelfReport>({ sleepHours: 7, mood: 3, fatigue: 2 });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="sleep" className="text-sm font-semibold text-slate-200 flex justify-between max-w-sm">
          Horas de sueño
          <span className="tabular-nums text-cyan-300">{report.sleepHours} h</span>
        </label>
        <input
          id="sleep"
          type="range"
          min={3}
          max={10}
          step={0.5}
          value={report.sleepHours}
          onChange={(e) => setReport({ ...report, sleepHours: Number(e.target.value) })}
          className="w-full max-w-sm accent-cyan-500"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-5">
        <ScaleInput
          label="Ánimo"
          low="Muy bajo"
          high="Muy bueno"
          value={report.mood}
          onChange={(mood) => setReport({ ...report, mood })}
        />
        <ScaleInput
          label="Fatiga"
          low="Descansado"
          high="Agotado"
          value={report.fatigue}
          onChange={(fatigue) => setReport({ ...report, fatigue })}
        />
      </div>
      <button type="button" className={PRIMARY} onClick={() => run(() => submitCheckIn(report))}>
        Guardar check-in
      </button>
    </div>
  );
}

function VitalsStep({ run }: { run: Run }) {
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

  const rows: [string, string][] = [
    ['Frecuencia cardíaca', `${live.heartRate} bpm`],
    ['SpO2', `${live.spO2}%`],
    ['CO2', `${live.co2Level} ppm`],
    ['Cistatina C', `${live.cistatinaC.toFixed(2)} mg/L`],
    ['Linfocitos', `${live.linfocitos} cél/µL`],
    ['Radiación', `${live.radiationRate} µSv/h`],
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
      <p className="text-xs text-slate-400">
        Si el motor RIDGE detecta una alerta, la evaluación se pausa sola y te
        muestra el diagnóstico antes de seguir.
      </p>
      <button type="button" className={PRIMARY} onClick={capture}>
        Registrar lectura
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
  const completeStep = useMissionStore((s) => s.completeStep);
  const skipStep = useMissionStore((s) => s.skipStep);

  return (
    <div className="space-y-5">
      {fatigue !== undefined && fatigue >= 4 && (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-3 text-sm text-amber-200">
          Registraste fatiga alta. Adaptar u omitir la sesión de hoy también es
          una decisión válida.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={PRIMARY} onClick={() => run(() => completeStep(id))}>
          <Check className="h-4 w-4" aria-hidden /> Sesión completada
        </button>
        <button type="button" className={SECONDARY} onClick={() => run(() => skipStep(id))}>
          Omitir hoy
        </button>
      </div>
    </div>
  );
}

function HydrationStep({ count, run }: { count: number; run: Run }) {
  const logHydration = useMissionStore((s) => s.logHydration);
  const skipStep = useMissionStore((s) => s.skipStep);

  return (
    <div className="space-y-5">
      <div className="flex gap-3" aria-label={`${count} de ${HYDRATION_TARGET} tomas`}>
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
          Registrar toma ({count}/{HYDRATION_TARGET})
        </button>
        <button type="button" className={SECONDARY} onClick={() => run(() => skipStep('HYDRATION'))}>
          Omitir hoy
        </button>
      </div>
    </div>
  );
}

function MindStep({ run }: { run: Run }) {
  const completeStep = useMissionStore((s) => s.completeStep);
  const skipStep = useMissionStore((s) => s.skipStep);

  return (
    <div className="space-y-5">
      <CoherencePacer onComplete={() => run(() => completeStep('MIND'))} />
      <button type="button" className={SECONDARY} onClick={() => run(() => skipStep('MIND'))}>
        Omitir hoy
      </button>
    </div>
  );
}

function DebriefStep({ session, run }: { session: EvaluationSession; run: Run }) {
  const finishDay = useMissionStore((s) => s.finishDay);
  const goToStep = useMissionStore((s) => s.goToStep);
  const required = EVALUATION_STEPS.filter((s) => s.id !== 'DEBRIEF');
  const complete = required.every((s) => session.completedSteps.includes(s.id));
  const pending = required.filter(
    (s) => !session.completedSteps.includes(s.id)
  );
  const diagnosis = session.vitals
    ? buildDiagnosis(session.vitals, session.selfReport)
    : null;

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">Pasos</p>
          <p className="text-xl font-bold tabular-nums">
            {session.completedSteps.length}/{required.length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">XP de hoy</p>
          <p className="text-xl font-bold tabular-nums">
            {session.xp + (complete ? FULL_DAY_BONUS : 0)}
            <span className="text-sm text-slate-500"> / {MAX_DAILY_XP}</span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase text-slate-500">Bono día completo</p>
          <p className={`text-xl font-bold ${complete ? 'text-cyan-300' : 'text-slate-600'}`}>
            {complete ? `+${FULL_DAY_BONUS}` : 'Pendiente'}
          </p>
        </div>
      </div>

      {diagnosis && (
        <DiagnosticPanel diagnosis={diagnosis} title="Diagnóstico de la lectura de hoy" />
      )}

      {pending.length > 0 && (
        <div className="text-sm text-slate-400 space-y-2">
          <p>Aún puedes completar lo que omitiste:</p>
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
        Cerrar el día
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PausedView({ session, run }: { session: EvaluationSession; run: Run }) {
  const resume = useMissionStore((s) => s.resume);
  const closeAsExcused = useMissionStore((s) => s.closeAsExcused);
  const live = useLiveTelemetry();
  const diagnosis = buildDiagnosis(live, session.selfReport);
  const codeRed = live.isEmergency;
  const required = EVALUATION_STEPS.length - 1;
  const medical = session.pauseReason !== 'USER' || diagnosis.severity !== 'OPTIMAL';

  const reasonText = {
    USER: 'Pausaste la evaluación. Tu progreso de hoy está guardado.',
    CLINICAL_ALERT: 'El motor RIDGE detectó una alerta al registrar tus biomarcadores.',
    CODE_RED: 'Se activó el Code Red. La evaluación se detuvo automáticamente.',
  }[session.pauseReason ?? 'USER'];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${codeRed ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
          {codeRed ? <Siren className="h-5 w-5" aria-hidden /> : <Pause className="h-5 w-5" aria-hidden />}
        </span>
        <div>
          <h3 className="text-lg font-bold text-slate-100">Evaluación en pausa</h3>
          <p className="text-sm text-slate-400">{reasonText}</p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Progreso guardado: {session.completedSteps.length} de {required} pasos ·
            se reanuda en «{EVALUATION_STEPS[session.stepIndex].short}»
          </p>
        </div>
      </div>

      <DiagnosticPanel diagnosis={diagnosis} title="Diagnóstico en tiempo real" />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={PRIMARY}
          disabled={codeRed}
          onClick={() => run(resume)}
        >
          <Play className="h-4 w-4" aria-hidden /> Reanudar evaluación
        </button>
        {medical && (
          <button type="button" className={SECONDARY} onClick={() => run(closeAsExcused)}>
            Cerrar el día por motivo médico
          </button>
        )}
      </div>
      {codeRed && (
        <p className="text-xs text-red-300">
          Podrás reanudar cuando se desactive el Code Red.
        </p>
      )}
      {medical && (
        <p className="text-xs text-slate-500">
          Un día cerrado por motivo médico cuenta para tu meta semanal: cuidarte
          nunca te penaliza.
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
  const session = useMissionStore((s) => s.session);
  const record = useMissionStore((s) => s.records[today]);
  const startEvaluation = useMissionStore((s) => s.startEvaluation);
  const pause = useMissionStore((s) => s.pause);
  const isEmergency = useTelemetryStore((s) => s.isEmergency);

  // Code Red durante la evaluación → pausa automática.
  useEffect(() => {
    if (isEmergency && session?.status === 'ACTIVE') pause('CODE_RED');
  }, [isEmergency, session?.status, pause]);

  if (record && !session) {
    const diagnosis = record.vitals ? buildDiagnosis(record.vitals, record.selfReport) : null;
    const label = {
      COMPLETE: 'Día completo',
      PARTIAL: 'Día parcial',
      EXCUSED: 'Día cerrado por motivo médico',
    }[record.status];
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-8 w-8 text-cyan-400 shrink-0" aria-hidden />
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Evaluación del día {missionDay} cerrada · {label}
            </h3>
            <p className="text-sm text-slate-400">
              Ganaste {record.xp} XP. La próxima evaluación se abre mañana.
            </p>
          </div>
        </div>
        {diagnosis && <DiagnosticPanel diagnosis={diagnosis} title="Diagnóstico de hoy" />}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-bold text-slate-100">Evaluación del día {missionDay}</h3>
          <p className="text-sm text-slate-400 mt-1">
            {EVALUATION_STEPS.length} pasos guiados, de principio a fin. Puedes
            pausar en cualquier momento, ver tu diagnóstico y seguir donde lo
            dejaste.
          </p>
        </div>
        <ol className="grid sm:grid-cols-2 gap-2">
          {EVALUATION_STEPS.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <span className="h-6 w-6 shrink-0 rounded-full bg-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-200">{s.title}</p>
                <p className="text-xs text-slate-500">
                  {s.xp > 0 ? `+${s.xp} XP` : `+${FULL_DAY_BONUS} XP si completas todo`}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className={PRIMARY} onClick={() => run(() => startEvaluation(today))}>
          <Play className="h-4 w-4" aria-hidden /> Comenzar evaluación
        </button>
      </div>
    );
  }

  const step = EVALUATION_STEPS[session.stepIndex];

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
                  Paso {stepIndexOf(step.id) + 1} de {EVALUATION_STEPS.length}
                </p>
                <h3 className="text-lg font-bold text-slate-100">{step.title}</h3>
                <p className="text-sm text-slate-400">{step.description}</p>
              </div>
              <button type="button" className={SECONDARY} onClick={() => pause('USER')}>
                <Pause className="h-4 w-4" aria-hidden /> Pausar
              </button>
            </div>

            {step.id === 'CHECK_IN' && <CheckInStep run={run} />}
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
