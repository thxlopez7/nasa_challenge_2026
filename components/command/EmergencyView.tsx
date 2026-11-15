'use client';

import { useState } from 'react';
import {
  CheckSquare,
  FileText,
  LayoutDashboard,
  RotateCcw,
  Send,
  ShieldAlert,
  Siren,
  Square,
} from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import type { ClinicalSnapshot } from '../../store/selectors';
import {
  type EmergencyStepKey,
  useCommandUiStore,
} from '../../store/useCommandUiStore';
import { useOutboxStore } from '../../store/useOutboxStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { formatDurationSec } from '../../utils/formatters';
import type { MissionSlug } from '../../utils/missionChoice';
import SbarReportModal from '../SbarReportModal';

const STEP_KEYS: EmergencyStepKey[] = ['s1', 's2', 's3', 's4', 's5'];

export function EmergencyBanner() {
  const { t } = useT();
  const activeTab = useCommandUiStore((s) => s.activeTab);
  const showFullPanelInEmergency = useCommandUiStore((s) => s.showFullPanelInEmergency);
  const setActiveTab = useCommandUiStore((s) => s.setActiveTab);
  const setShowFullPanelInEmergency = useCommandUiStore(
    (s) => s.setShowFullPanelInEmergency
  );

  const isViewingCard = activeTab === 'hoy' && !showFullPanelInEmergency;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="rounded-xl border-2 border-red-500 bg-red-950/75 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-red-100 shadow-lg shadow-red-950/40"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Siren className="h-5 w-5 shrink-0 text-red-300 motion-safe:animate-pulse" aria-hidden />
        <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-red-100">
          {t.emergency.bannerTitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isViewingCard ? (
          <button
            type="button"
            onClick={() => setShowFullPanelInEmergency(true)}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-red-300/60 bg-red-900/60 hover:bg-red-800/80 px-3 py-1.5 text-xs font-bold cursor-pointer transition"
          >
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
            <span>{t.emergency.viewFullPanel}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowFullPanelInEmergency(false);
              setActiveTab('hoy');
            }}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-slate-950 px-3.5 py-1.5 text-xs font-bold uppercase cursor-pointer transition"
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            <span>{t.emergency.bannerCta}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function EmergencyCard({
  snapshot,
  mision,
}: {
  snapshot: ClinicalSnapshot;
  mision?: MissionSlug;
}) {
  const { lang, t } = useT();
  const simulateScenario = useTelemetryStore((s) => s.simulateScenario);
  const enqueuePacket = useOutboxStore((s) => s.enqueuePacket);

  const checklist = useCommandUiStore((s) => s.emergencyChecklist);
  const toggleEmergencyStep = useCommandUiStore((s) => s.toggleEmergencyStep);
  const resetEmergencyChecklist = useCommandUiStore((s) => s.resetEmergencyChecklist);
  const setShowFullPanelInEmergency = useCommandUiStore(
    (s) => s.setShowFullPanelInEmergency
  );

  const [sbarOpen, setSbarOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [queuedFeedback, setQueuedFeedback] = useState(false);

  const completedCount = STEP_KEYS.filter((k) => checklist[k]).length;
  const firedTraces = snapshot.ruleTraces.filter((r) => r.triggered);
  const isManualCodeRed = snapshot.alerts.isEmergency;

  const escLabel =
    snapshot.escalationLevel === 'emergency'
      ? t.copilotUi.escalationLabels.emergency
      : snapshot.escalationLevel === 'notify-flight-surgeon'
        ? t.copilotUi.escalationLabels.surgeon
        : t.copilotUi.escalationLabels.selfManage;

  const handleQueueVitalPacket = () => {
    enqueuePacket({
      kind: 'TELEMETRY_SNAPSHOT',
      title: 'Telemetry Emergency Snapshot',
      missionProfileId: snapshot.missionProfileId,
      priority: 'emergency',
      payload: {
        globalSeverity: snapshot.globalSeverity,
        escalationLevel: snapshot.escalationLevel,
        biomarkers: snapshot.biomarkers,
        environment: snapshot.environment,
        firedRules: firedTraces.map((r) => r.ruleId),
      },
    });
    setQueuedFeedback(true);
    window.setTimeout(() => setQueuedFeedback(false), 3000);
  };

  const handleConfirmReset = () => {
    simulateScenario('RESET');
    resetEmergencyChecklist();
    setConfirmReset(false);
    setShowFullPanelInEmergency(false);
  };

  return (
    <section
      aria-labelledby="emergency-card-title"
      className="rounded-xl border-2 border-red-500 bg-slate-900 p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-red-500/40 pb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-red-300">
            {t.emergency.cardEyebrow}
          </p>
          <h2
            id="emergency-card-title"
            className="text-lg sm:text-xl font-bold text-red-100 flex items-center gap-2 mt-1"
          >
            <Siren className="h-5 w-5 text-red-400 shrink-0" aria-hidden />
            <span>
              {isManualCodeRed
                ? t.emergency.codeRedTitle
                : t.emergency.clinicalEmergencyTitle}
            </span>
          </h2>
          <p className="text-xs text-red-200/80 mt-1">{t.emergency.evalPausedNote}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-1.5">
            <span className="text-[10px] uppercase text-red-300 block">
              {t.emergency.escalationLabel}
            </span>
            <strong className="text-red-100">{escLabel}</strong>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5">
            <span className="text-[10px] uppercase text-slate-400 block">
              {t.emergency.earthCommsLabel}
            </span>
            <strong className="text-cyan-200">
              {snapshot.comms.commsMode[lang]} ·{' '}
              {formatDurationSec(snapshot.comms.oneWayLatencyNominalSec, lang)}
            </strong>
          </div>
        </div>
      </div>

      {/* Active reasons / firing deterministic rules */}
      <div className="rounded-lg border border-red-500/30 bg-red-950/25 p-3 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-red-200">
          {t.emergency.activeReasonsTitle}
        </p>
        <ul className="space-y-1 text-xs text-slate-100">
          {isManualCodeRed && firedTraces.every((r) => r.ruleId !== 'R4_CODE_RED_EMERGENCY') && (
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">•</span>
              <span>{t.emergency.codeRedManualReason}</span>
            </li>
          )}
          {firedTraces.map((trace) => (
            <li key={trace.ruleId} className="flex items-start gap-2">
              <span className="font-bold text-red-300 shrink-0">[{trace.shortCode}]</span>
              <span>
                <strong>{trace.title[lang]}:</strong> {trace.summary[lang]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Interactive protocol checklist */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {t.emergency.protocolTitle}
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-cyan-300 font-bold tabular-nums">
              {completedCount}/{STEP_KEYS.length} {t.emergency.checklistProgress}
            </span>
            <button
              type="button"
              onClick={resetEmergencyChecklist}
              className="min-h-[44px] inline-flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              <span>{t.emergency.resetChecklist}</span>
            </button>
          </div>
        </div>

        <ul className="space-y-1.5">
          {STEP_KEYS.map((key, idx) => {
            const checked = checklist[key];
            return (
              <li key={key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleEmergencyStep(key)}
                  className={`min-h-[44px] w-full text-left rounded-lg border px-3 py-2 flex items-start gap-3 text-xs sm:text-sm cursor-pointer transition ${
                    checked
                      ? 'border-emerald-500/60 bg-emerald-950/35 text-emerald-100 line-through decoration-emerald-400/60'
                      : 'border-slate-700 bg-slate-950/70 text-slate-100 hover:border-red-400/60'
                  }`}
                >
                  {checked ? (
                    <CheckSquare className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" aria-hidden />
                  ) : (
                    <Square className="h-4 w-4 shrink-0 text-red-300 mt-0.5" aria-hidden />
                  )}
                  <span>
                    <strong className="mr-1.5">{idx + 1}.</strong>
                    {t.emergency.steps[key]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Primary actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSbarOpen(true)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-red-500 hover:bg-red-400 text-slate-950 px-4 py-2 text-xs font-bold uppercase cursor-pointer transition"
          >
            <FileText className="h-4 w-4" aria-hidden />
            <span>{t.emergency.generateSbar}</span>
          </button>

          <button
            type="button"
            onClick={handleQueueVitalPacket}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-cyan-500/60 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-100 px-3.5 py-2 text-xs font-bold cursor-pointer transition"
          >
            <Send className="h-4 w-4" aria-hidden />
            <span>{t.emergency.queueVitalPacket}</span>
          </button>

          {queuedFeedback && (
            <span role="status" className="text-xs font-semibold text-emerald-300">
              {t.emergency.queuedConfirm}
            </span>
          )}
        </div>

        {/* 2-step confirmation to deactivate Code Red */}
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-950 hover:border-amber-400 hover:text-amber-200 px-3.5 py-2 text-xs font-bold text-slate-200 cursor-pointer transition"
          >
            <span>{t.emergency.deactivateCodeRed}</span>
          </button>
        ) : (
          <div className="rounded-lg border border-amber-500/70 bg-amber-950/40 p-3 flex flex-wrap items-center gap-2 text-xs">
            <div className="max-w-sm">
              <p className="font-bold text-amber-200">{t.emergency.confirmDeactivateTitle}</p>
              <p className="text-[11px] text-amber-100/80">{t.emergency.confirmDeactivateBody}</p>
            </div>
            <button
              type="button"
              onClick={handleConfirmReset}
              className="min-h-[44px] rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1.5 font-bold cursor-pointer"
            >
              {t.emergency.confirmDeactivateYes}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="min-h-[44px] rounded-lg border border-slate-600 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              {t.emergency.confirmDeactivateCancel}
            </button>
          </div>
        )}
      </div>

      <SbarReportModal
        open={sbarOpen}
        onClose={() => setSbarOpen(false)}
        mision={mision}
      />
    </section>
  );
}
