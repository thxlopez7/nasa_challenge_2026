'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  Printer,
  Send,
  Shield,
  X,
} from 'lucide-react';
import { useT } from '../i18n/I18nContext';
import { useClinicalSnapshot } from '../store/selectors';
import { useOutboxStore } from '../store/useOutboxStore';
import { runLocalTriage } from '../utils/localTriage';
import type { MissionSlug } from '../utils/missionChoice';

export function SbarReportModal({
  open,
  onClose,
  mision,
}: {
  open: boolean;
  onClose: () => void;
  mision?: MissionSlug;
}) {
  const { lang } = useT();
  const snapshot = useClinicalSnapshot(mision);
  const enqueuePacket = useOutboxStore((s) => s.enqueuePacket);
  const [includePsychInExport, setIncludePsychInExport] = useState(false);
  const [queuedNotice, setQueuedNotice] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const triage = runLocalTriage(
    {
      ...snapshot.biomarkers,
      ...snapshot.environment,
      ...snapshot.alerts,
      behavioralCheckIn: snapshot.behavioralCheckIn,
    },
    snapshot.ruleTraces,
    lang
  );

  const triggeredRules = snapshot.ruleTraces.filter((r) => r.triggered);
  const psychAllowed =
    includePsychInExport || Boolean(snapshot.sharePsychWithAi);

  const sbarPayload = {
    schema: 'exovitals.sbar.v1',
    missionProfileId: snapshot.missionProfileId,
    oneWayLatencySec: snapshot.comms.oneWayLatencyNominalSec,
    escalationLevel: triage.escalationLevel,
    measuredAt: snapshot.measuredAt ?? 'live-telemetry',
    sbar: triage.sbarSummary,
    activeRules: triggeredRules.map((r) => ({
      id: r.ruleId,
      version: r.version,
      severity: r.severity,
      summary: r.summary[lang],
    })),
    vitals: {
      heartRate: snapshot.biomarkers.heartRate,
      spO2: snapshot.biomarkers.spO2,
      systolicMmHg: snapshot.biomarkers.systolicMmHg,
      diastolicMmHg: snapshot.biomarkers.diastolicMmHg,
      glucoseMgDl: snapshot.biomarkers.glucoseMgDl,
      glucoseContext: snapshot.biomarkers.glucoseContext,
      bodyTempC: snapshot.biomarkers.bodyTempC,
      cistatinaC: snapshot.biomarkers.cistatinaC,
      creatinina: snapshot.biomarkers.creatinina,
      calcioIonico: snapshot.biomarkers.calcioIonico,
      nlr: Number.isFinite(snapshot.nlr) ? Number(snapshot.nlr.toFixed(2)) : 'Infinity',
    },
    environment: snapshot.environment,
    ...(psychAllowed && snapshot.behavioralCheckIn
      ? {
          behavioralSummary: {
            behavioralRiskIndex: snapshot.behavioralCheckIn.behavioralRiskIndex,
            phq2Total:
              snapshot.behavioralCheckIn.phq2Anhedonia +
              snapshot.behavioralCheckIn.phq2Dysphoria,
            selfHarmFlag: snapshot.behavioralCheckIn.selfHarmFlag,
          },
        }
      : { behavioralSummary: 'omitted-by-privacy-default' }),
  };

  const handleQueueOutbox = () => {
    const priority =
      triage.escalationLevel === 'emergency'
        ? 'emergency'
        : triage.escalationLevel === 'notify-flight-surgeon'
          ? 'priority'
          : 'routine';

    enqueuePacket({
      kind: 'SBAR_REPORT',
      title:
        lang === 'es'
          ? `SBAR Clínico · ${triage.escalationLevel.toUpperCase()}`
          : `Clinical SBAR · ${triage.escalationLevel.toUpperCase()}`,
      missionProfileId: snapshot.missionProfileId,
      priority,
      payload: sbarPayload,
    });
    setQueuedNotice(true);
    window.setTimeout(() => setQueuedNotice(false), 3000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(sbarPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exovitals-sbar-${snapshot.missionProfileId.toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const copy =
    lang === 'es'
      ? {
          title: 'Reporte Médico SBAR (1 Página · Tierra–Nave)',
          subtitle: 'Formato estandarizado para Cirujano de Vuelo en enlaces interplanetarios con retardo.',
          s: 'S · Situación',
          b: 'B · Antecedentes y Telemetría',
          a: 'A · Evaluación Determinista a Bordo',
          r: 'R · Recomendación y Acciones',
          psychToggle: 'Incluir puntaje conductual privado en este SBAR',
          queueBtn: 'Encolar en Outbox a Tierra',
          queuedOk: 'Encolado en Outbox IndexedDB',
          jsonBtn: 'Descargar JSON',
          printBtn: 'Imprimir / PDF (1 pág.)',
          close: 'Cerrar',
        }
      : {
          title: '1-Page Medical SBAR Handover (Space–Ground)',
          subtitle: 'Standardized handover packet for Ground Flight Surgeon across high-latency links.',
          s: 'S · Situation',
          b: 'B · Background & Telemetry',
          a: 'A · Onboard Deterministic Assessment',
          r: 'R · Recommendation & Actions',
          psychToggle: 'Include private behavioral score in this SBAR export',
          queueBtn: 'Queue to Earth Outbox',
          queuedOk: 'Queued in IndexedDB Outbox',
          jsonBtn: 'Download JSON',
          printBtn: 'Print / PDF (1 Page)',
          close: 'Close',
        };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sbar-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl p-6 space-y-5 print:border-0 print:bg-white print:text-black print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4 print:border-slate-300">
          <div>
            <h2
              id="sbar-modal-title"
              className="text-lg font-bold text-cyan-300 flex items-center gap-2 print:text-black"
            >
              <FileText className="w-5 h-5" aria-hidden="true" />
              <span>{copy.title}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 print:text-slate-700">
              {copy.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer print:hidden"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 print:border-slate-300 print:bg-slate-50">
            <p className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] print:text-black">
              {copy.s}
            </p>
            <p className="mt-1 text-slate-100 leading-relaxed print:text-black">
              {triage.sbarSummary.situation}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 print:border-slate-300 print:bg-slate-50">
            <p className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] print:text-black">
              {copy.b}
            </p>
            <p className="mt-1 text-slate-200 font-mono leading-relaxed print:text-black">
              {triage.sbarSummary.background}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 print:border-slate-300 print:bg-slate-50">
            <p className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] print:text-black">
              {copy.a}
            </p>
            <p className="mt-1 text-slate-100 leading-relaxed print:text-black">
              {triage.sbarSummary.assessment}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 print:border-slate-300 print:bg-slate-50">
            <p className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] print:text-black">
              {copy.r}
            </p>
            <p className="mt-1 text-slate-100 leading-relaxed print:text-black">
              {triage.sbarSummary.recommendation}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer print:hidden">
          <input
            type="checkbox"
            checked={psychAllowed}
            disabled={Boolean(snapshot.sharePsychWithAi)}
            onChange={(e) => setIncludePsychInExport(e.target.checked)}
            className="w-4 h-4 rounded accent-cyan-500"
          />
          <Shield className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <span>{copy.psychToggle}</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800 print:hidden">
          <button
            type="button"
            onClick={handleQueueOutbox}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            {queuedNotice ? (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Send className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{queuedNotice ? copy.queuedOk : copy.queueBtn}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              <span>{copy.jsonBtn}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>{copy.printBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SbarReportModal;
