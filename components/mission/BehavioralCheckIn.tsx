'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  ListChecks,
  Lock,
  ShieldAlert,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { useClinicalSnapshot } from '../../store/selectors';
import {
  type BehavioralDraft,
  useCommandUiStore,
} from '../../store/useCommandUiStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { computeBehavioralRiskIndex } from '../../utils/behavioralScoring';
import { formatNumber } from '../../utils/formatters';

type ScaleKey =
  | 'mood'
  | 'sleepQuality'
  | 'fatigue'
  | 'stress'
  | 'workload'
  | 'socialContact';

const STEP_1_SCALES: ScaleKey[] = ['sleepQuality', 'fatigue'];
const STEP_2_SCALES: ScaleKey[] = ['mood', 'stress', 'workload', 'socialContact'];
const ALL_SCALES: ScaleKey[] = [...STEP_1_SCALES, ...STEP_2_SCALES];

export function BehavioralCheckIn() {
  const { lang, t } = useT();
  const snapshot = useClinicalSnapshot();
  const submitBehavioralCheckIn = useTelemetryStore(
    (s) => s.submitBehavioralCheckIn
  );
  const setSharePsychWithAi = useTelemetryStore((s) => s.setSharePsychWithAi);

  const behavioralDraft = useCommandUiStore((s) => s.behavioralDraft);
  const setBehavioralDraft = useCommandUiStore((s) => s.setBehavioralDraft);
  const clearBehavioralDraft = useCommandUiStore((s) => s.clearBehavioralDraft);

  const [savedAt, setSavedAt] = useState<string | null>(null);

  const initial = snapshot.behavioralCheckIn;
  const draft: BehavioralDraft = behavioralDraft ?? {
    mood: initial?.mood ?? 4,
    sleepQuality: initial?.sleepQuality ?? 4,
    fatigue: initial?.fatigue ?? 2,
    stress: initial?.stress ?? 2,
    workload: initial?.workload ?? 3,
    socialContact: initial?.socialContact ?? 4,
    phq2Anhedonia: initial?.phq2Anhedonia ?? 0,
    phq2Dysphoria: initial?.phq2Dysphoria ?? 0,
    selfHarmFlag: initial?.selfHarmFlag ?? false,
    shareWithAi: snapshot.sharePsychWithAi,
    step: 0,
    showAll: false,
  };

  const shareWithAi = draft.shareWithAi ?? snapshot.sharePsychWithAi;

  const patchDraft = (partial: Partial<BehavioralDraft>) => {
    setBehavioralDraft({ ...draft, ...partial });
  };

  const previewIndex = computeBehavioralRiskIndex({
    mood: draft.mood,
    sleepQuality: draft.sleepQuality,
    fatigue: draft.fatigue,
    stress: draft.stress,
    workload: draft.workload,
    socialContact: draft.socialContact,
    phq2Anhedonia: draft.phq2Anhedonia,
    phq2Dysphoria: draft.phq2Dysphoria,
    selfHarmFlag: draft.selfHarmFlag,
  });
  const phq2Total = draft.phq2Anhedonia + draft.phq2Dysphoria;

  const phqOptions: Array<{ value: 0 | 1 | 2 | 3; label: string }> = [
    { value: 0, label: t.behavioral.phqOptions.o0 },
    { value: 1, label: t.behavioral.phqOptions.o1 },
    { value: 2, label: t.behavioral.phqOptions.o2 },
    { value: 3, label: t.behavioral.phqOptions.o3 },
  ];

  const stepTitles = [
    t.behavioral.step1Title,
    t.behavioral.step2Title,
    t.behavioral.step3Title,
    t.behavioral.step4Title,
  ];

  const handleSubmit = () => {
    const nowIso = new Date().toISOString();
    submitBehavioralCheckIn({
      mood: draft.mood,
      sleepQuality: draft.sleepQuality,
      fatigue: draft.fatigue,
      stress: draft.stress,
      workload: draft.workload,
      socialContact: draft.socialContact,
      phq2Anhedonia: draft.phq2Anhedonia,
      phq2Dysphoria: draft.phq2Dysphoria,
      selfHarmFlag: draft.selfHarmFlag,
      sharePsychWithAi: shareWithAi,
      updatedAt: nowIso,
    });
    clearBehavioralDraft();
    setSavedAt(nowIso);
  };

  const renderScales = (keys: ScaleKey[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {keys.map((key) => {
        const spec = t.behavioral.scales[key];
        return (
          <div
            key={key}
            className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-2"
          >
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="font-bold text-slate-200">{spec.label}</span>
              <span className="text-[11px] text-slate-400">
                {spec.low} ↔ {spec.high}
              </span>
            </div>
            <div
              role="group"
              aria-label={spec.label}
              className="grid grid-cols-5 gap-2"
            >
              {[1, 2, 3, 4, 5].map((n) => {
                const active = draft[key] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={active}
                    onClick={() => patchDraft({ [key]: n })}
                    className={`min-h-[44px] rounded-lg border font-bold text-sm cursor-pointer transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderPhqAndSafety = () => (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-cyan-300">
          {t.behavioral.phqTitle}
        </p>
        <span
          className={`text-xs font-bold px-2.5 py-0.5 rounded ${
            phq2Total >= 3
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          PHQ-2: {formatNumber(phq2Total, lang)}/6{' '}
          {phq2Total >= 3 ? `· ${t.behavioral.phqSuggests}` : ''}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-200">{t.behavioral.phqQ1}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {phqOptions.map((opt) => (
            <button
              key={`a-${opt.value}`}
              type="button"
              aria-pressed={draft.phq2Anhedonia === opt.value}
              onClick={() => patchDraft({ phq2Anhedonia: opt.value })}
              className={`min-h-[44px] px-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                draft.phq2Anhedonia === opt.value
                  ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-200">{t.behavioral.phqQ2}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {phqOptions.map((opt) => (
            <button
              key={`d-${opt.value}`}
              type="button"
              aria-pressed={draft.phq2Dysphoria === opt.value}
              onClick={() => patchDraft({ phq2Dysphoria: opt.value })}
              className={`min-h-[44px] px-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                draft.phq2Dysphoria === opt.value
                  ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800 pt-3 space-y-3">
        <button
          type="button"
          role="switch"
          aria-checked={draft.selfHarmFlag}
          onClick={() => patchDraft({ selfHarmFlag: !draft.selfHarmFlag })}
          className={`min-h-[44px] w-full text-left px-4 py-2 rounded-lg border text-xs font-semibold cursor-pointer flex items-center justify-between gap-3 ${
            draft.selfHarmFlag
              ? 'border-rose-500 bg-rose-500/20 text-rose-100'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
          }`}
        >
          <span>{t.behavioral.selfHarmToggle}</span>
          <span className="uppercase font-bold shrink-0">
            {draft.selfHarmFlag
              ? t.behavioral.flaggedYes
              : t.behavioral.flaggedNo}
          </span>
        </button>

        {draft.selfHarmFlag && (
          <div
            role="alert"
            className="rounded-lg border-2 border-rose-500 bg-rose-950/70 p-4 text-xs text-rose-100 space-y-2"
          >
            <p className="font-bold flex items-center gap-2 text-sm text-rose-200">
              <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />
              <span>{t.behavioral.protocolTitle}</span>
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>{t.behavioral.protocolSteps.s1}</li>
              <li>{t.behavioral.protocolSteps.s2}</li>
              <li>{t.behavioral.protocolSteps.s3}</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );

  const renderPrivacyAndSave = (includeSaveButton: boolean) => (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 rounded-lg p-4">
      <button
        type="button"
        role="switch"
        aria-checked={shareWithAi}
        onClick={() => {
          const next = !shareWithAi;
          patchDraft({ shareWithAi: next });
          setSharePsychWithAi(next);
        }}
        className="min-h-[44px] inline-flex items-center gap-2.5 text-left text-xs cursor-pointer text-slate-200"
      >
        {shareWithAi ? (
          <Unlock className="h-4 w-4 text-amber-400 shrink-0" aria-hidden />
        ) : (
          <Lock className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden />
        )}
        <span>
          {shareWithAi
            ? t.behavioral.privacyShared
            : t.behavioral.privacyLocalOnly}
        </span>
      </button>

      {includeSaveButton && (
        <button
          type="button"
          onClick={handleSubmit}
          data-ev-press
          className="min-h-[48px] px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm uppercase tracking-wider cursor-pointer transition"
        >
          {t.behavioral.saveBtn}
        </button>
      )}
    </div>
  );

  return (
    <section
      aria-labelledby="behavioral-checkin-title"
      className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-cyan-400">
            {t.behavioral.eyebrow}
          </p>
          <h2
            id="behavioral-checkin-title"
            className="text-lg font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 mt-0.5"
          >
            <Brain className="h-5 w-5 text-cyan-400" aria-hidden />
            <span>{t.behavioral.title}</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => patchDraft({ showAll: !draft.showAll })}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-cyan-200 cursor-pointer transition"
          >
            {draft.showAll ? (
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
            ) : (
              <ListChecks className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
            )}
            <span>
              {draft.showAll
                ? t.behavioral.wizardToggle
                : t.behavioral.fullViewToggle}
            </span>
          </button>

          <div className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-1.5 text-right">
            <p className="text-[10px] uppercase text-slate-400">
              {t.behavioral.riskIndexLabel}
            </p>
            <p
              className={`text-lg font-bold tabular-nums ${
                previewIndex >= 65
                  ? 'text-rose-400'
                  : previewIndex >= 40
                    ? 'text-amber-300'
                    : 'text-emerald-300'
              }`}
            >
              {formatNumber(previewIndex, lang)} / 100
            </p>
          </div>
        </div>
      </div>

      {!draft.showAll ? (
        <div className="space-y-4">
          {/* Barra de progreso de 4 pasos (~30 s) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-mono font-bold text-cyan-300 uppercase">
                {t.behavioral.stepLabel} {formatNumber(draft.step + 1, lang)}{' '}
                {t.behavioral.ofLabel} {formatNumber(4, lang)} ·{' '}
                {stepTitles[draft.step]}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
              {([0, 1, 2, 3] as const).map((idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-colors ${
                    idx <= draft.step ? 'bg-cyan-400' : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>

          {draft.step === 0 && renderScales(STEP_1_SCALES)}
          {draft.step === 1 && renderScales(STEP_2_SCALES)}
          {draft.step === 2 && renderPhqAndSafety()}
          {draft.step === 3 && renderPrivacyAndSave(false)}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              disabled={draft.step === 0}
              onClick={() =>
                patchDraft({
                  step: Math.max(0, draft.step - 1) as 0 | 1 | 2 | 3,
                })
              }
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-slate-200 cursor-pointer transition"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span>{t.behavioral.backBtn}</span>
            </button>

            {draft.step < 3 ? (
              <button
                type="button"
                onClick={() =>
                  patchDraft({
                    step: Math.min(3, draft.step + 1) as 0 | 1 | 2 | 3,
                  })
                }
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-5 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer transition"
              >
                <span>{t.behavioral.nextBtn}</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="min-h-[48px] px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm uppercase tracking-wider cursor-pointer transition"
              >
                {t.behavioral.saveBtn}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {renderScales(ALL_SCALES)}
          {renderPhqAndSafety()}
          {renderPrivacyAndSave(true)}
        </div>
      )}

      {savedAt && (
        <p
          role="status"
          className="inline-flex items-center gap-2 text-xs text-emerald-300 font-semibold"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <span>{t.behavioral.savedNotice}</span>
        </p>
      )}
    </section>
  );
}

export default BehavioralCheckIn;
