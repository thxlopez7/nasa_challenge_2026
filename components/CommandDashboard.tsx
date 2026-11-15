'use client';

import { FlaskConical, Radio, Zap } from 'lucide-react';
import GodModePanel from './GodModePanel';
import MedicalCopilot from './MedicalCopilot';
import SensorSimulator from './SensorSimulator';
import MissionCenter from './mission/MissionCenter';
import QuickMeasurementPanel from './mission/QuickMeasurementPanel';
import BehavioralCheckIn from './mission/BehavioralCheckIn';
import RuleTrace from './RuleTrace';
import RulesAndLimitationsSection from './RulesAndLimitationsSection';
import OutboxPanel from './OutboxPanel';
import { useClinicalSnapshot } from '../store/selectors';
import { useT } from '../i18n/I18nContext';
import type { AlertSeverity } from '../types/telemetry';
import { RIDGE_THRESHOLDS as T } from '../utils/clinicalEngine';
import { MISSION_CHOICES, type MissionSlug } from '../utils/missionChoice';

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  OPTIMAL: 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300',
  WARNING: 'border-amber-500/70 bg-amber-500/10 text-amber-300',
  CRITICAL: 'border-red-500 bg-red-500/15 text-red-300 animate-pulse',
};

function fmtRatio(value: number): string {
  if (Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return '∞';
  return value.toFixed(2);
}

/** Centro de mando: telemetría unificada, reglas clínicas, God Mode, copiloto IA y Centro de misión. */
export function CommandDashboard({ mision }: { mision?: MissionSlug }) {
  const { t, lang } = useT();
  const snapshot = useClinicalSnapshot(mision);
  const {
    biomarkers,
    environment,
    ruleTraces,
    globalSeverity,
    escalationLevel,
    nlr,
    cisCRatio,
    comms,
    isManualOverride,
    sleepHoursRecorded,
    behavioralCheckIn,
  } = snapshot;

  const escalationBadge =
    escalationLevel === 'emergency'
      ? {
          text: lang === 'es' ? 'ESCALAMIENTO: EMERGENCIA' : 'ESCALATION: EMERGENCY',
          styles: 'border-red-500 bg-red-500/20 text-red-200',
        }
      : escalationLevel === 'notify-flight-surgeon'
        ? {
            text:
              lang === 'es'
                ? 'ESCALAMIENTO: NOTIFICAR CIRUJANO DE VUELO'
                : 'ESCALATION: NOTIFY FLIGHT SURGEON',
            styles: 'border-amber-500/80 bg-amber-500/15 text-amber-200',
          }
        : {
            text: lang === 'es' ? 'ESCALAMIENTO: AUTOCUIDADO' : 'ESCALATION: SELF-MANAGE',
            styles: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200',
          };

  const severityLabel =
    globalSeverity === 'CRITICAL'
      ? t.common.critical
      : globalSeverity === 'WARNING'
        ? t.common.warning
        : t.common.optimal;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono p-4 sm:p-6 lg:p-10">
      <SensorSimulator />

      <div className="max-w-7xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-400">
              {t.dashboard.eyebrow}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              {t.dashboard.title}
            </h1>
            <p className="text-[11px] text-slate-400 mt-1">
              {t.common.prototypeBadge} · {t.dashboard.commsLatencyLabel}: {comms.commsMode[lang]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider ${SEVERITY_STYLE[globalSeverity]}`}
            >
              {t.dashboard.statusSummaryLabel}: {severityLabel}
            </span>
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider ${escalationBadge.styles}`}
            >
              {escalationBadge.text}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-cyan-300">
              <span
                className={`h-2 w-2 rounded-full ${isManualOverride ? 'bg-amber-400' : 'bg-cyan-400 animate-pulse'}`}
                aria-hidden
              />
              {isManualOverride ? t.dashboard.manualOverrideBadge : t.dashboard.streamLabel}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
            {/* Telemetría separada por modalidad de adquisición: Sensores 1 Hz vs Cartuchos POC / Spot */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
                  {t.nav.sectionCommand}
                </h2>
                <span className="text-xs text-slate-400">
                  {t.dashboard.sleepToday}:{' '}
                  {sleepHoursRecorded !== null ? `${sleepHoursRecorded.toFixed(1)} h` : t.common.noRecordToday}
                </span>
              </div>

              {/* Sub-bloque A: Sensores continuos integrados y de cabina (1 Hz) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                    <Radio className="h-4 w-4 animate-pulse" aria-hidden />
                    <span>
                      {lang === 'es'
                        ? 'Sensores integrados y cabina · Flujo continuo 1 Hz'
                        : 'Wearable & Cabin Sensors · 1 Hz Continuous Stream'}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-cyan-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" aria-hidden />
                    {lang === 'es' ? '1 Hz · EN VIVO' : '1 Hz · LIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-950/60 border border-cyan-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.heartRate}</p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                        1 Hz · Wearable
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {Math.round(biomarkers.heartRate)}{' '}
                      <span className="text-sm text-slate-400">{lang === 'es' ? 'lpm' : 'bpm'}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {t.dashboard.kpis.spo2}: <strong className="text-slate-200">{biomarkers.spO2}%</strong> · HRV (RMSSD):{' '}
                      <strong className="text-slate-200">
                        {biomarkers.hrvRmssdMs !== undefined ? `${biomarkers.hrvRmssdMs.toFixed(1)} ms` : '—'}
                      </strong>
                    </p>
                  </div>

                  <div className="bg-slate-950/60 border border-cyan-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.co2Level}</p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                        1 Hz · ECLSS
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {Math.round(environment.co2Level)} <span className="text-sm text-slate-400">ppm</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {lang === 'es' ? 'Umbral prototipo' : 'Prototype alert'}: &gt; {T.co2.minCo2Level} ppm
                    </p>
                  </div>

                  <div className="bg-slate-950/60 border border-cyan-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.radiation}</p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                        1 Hz · HERA
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {environment.radiationRate.toFixed(1)}{' '}
                      <span className="text-sm text-slate-400">µSv/h</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {lang === 'es' ? 'Dosis acumulada' : 'Accumulated dose'}:{' '}
                      <strong className="text-slate-200">{environment.radiationAccumulated.toFixed(1)} mSv</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-bloque B: Cartuchos POC y mediciones Spot (Sample & Hold) */}
              <div className="space-y-3 border-t border-slate-800 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                      <FlaskConical className="h-4 w-4" aria-hidden />
                      <span>
                        {lang === 'es'
                          ? 'Cartuchos Point-of-Care (POC) y medición rápida Spot · Muestra fija'
                          : 'Point-of-Care Cartridges (POC) & Fast Spot Readings · Sample & Hold'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {lang === 'es'
                        ? 'No oscilan segundo a segundo: el valor permanece fijo hasta procesar un nuevo cartucho capilar/saliva o lectura Spot.'
                        : 'Held constant between pulls — values update only when a new POC blood/saliva cartridge or Spot check is recorded.'}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                    {snapshot.indicatorMeta?.bloodPanel?.source === 'manual'
                      ? lang === 'es'
                        ? 'POC · CARGA MANUAL'
                        : 'POC · MANUAL LOG'
                      : lang === 'es'
                        ? 'POC · LOTE POR ETAPA'
                        : 'POC · BATCH HOLD'}
                  </span>
                </div>

                {/* Fila 1: 3 paneles de cartucho Point-of-Care */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-950/50 border border-amber-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.cystatinC}</p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                        Cartucho POC · i-STAT
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {biomarkers.cistatinaC.toFixed(2)}{' '}
                      <span className="text-sm text-slate-400">mg/L</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Cr: {biomarkers.creatinina.toFixed(2)} · {lang === 'es' ? 'CisC/Cr' : 'CysC/Cr'}:{' '}
                      {cisCRatio.toFixed(2)} · Ca²⁺: {biomarkers.calcioIonico.toFixed(2)}
                    </p>
                  </div>

                  <div className="bg-slate-950/50 border border-amber-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">
                        {lang === 'es' ? 'Panel Inmune y Cortisol' : 'Immune & Cortisol Panel'}
                      </p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                        Cartucho POC · rHEALTH
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {Math.round(biomarkers.linfocitos)}{' '}
                      <span className="text-sm text-slate-400">{lang === 'es' ? 'linf/µL' : 'lymph/µL'}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Neut: {Math.round(biomarkers.neutrofilos)} · NLR: {fmtRatio(nlr)} · {t.dashboard.kpis.cortisol}:{' '}
                      {biomarkers.cortisol.toFixed(1)}
                    </p>
                  </div>

                  <div className="bg-slate-950/50 border border-amber-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">
                        {lang === 'es' ? 'Recambio óseo (sin DXA)' : 'Bone Turnover (no DXA)'}
                      </p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                        Cartucho POC · Óseo
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {biomarkers.ctxNtxIndex !== undefined ? `${biomarkers.ctxNtxIndex.toFixed(2)}x` : '—'}{' '}
                      <span className="text-sm text-slate-400">CTX/NTX</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      P1NP: {biomarkers.p1npIndex !== undefined ? `${biomarkers.p1npIndex.toFixed(2)}x` : '—'} · ARED:{' '}
                      {biomarkers.aredLoadPct !== undefined ? `${Math.round(biomarkers.aredLoadPct)}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Fila 2: Mediciones rápidas Spot (al instante) + Check-in conductual */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-1">
                  <div className="bg-slate-950/40 border border-emerald-500/20 rounded-lg p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-slate-400 uppercase">
                        {lang === 'es' ? 'Presión arterial' : 'Blood Pressure'}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        <Zap className="h-2.5 w-2.5" aria-hidden />
                        Spot
                      </span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {biomarkers.systolicMmHg ?? '—'}/{biomarkers.diastolicMmHg ?? '—'}{' '}
                      <span className="text-xs text-slate-400">mmHg</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {lang === 'es' ? 'ΔFC ortostático:' : 'Orthostatic ΔHR:'}{' '}
                      {biomarkers.orthostaticDeltaHr !== undefined
                        ? `+${Math.round(biomarkers.orthostaticDeltaHr)} bpm`
                        : '—'}
                    </p>
                  </div>

                  <div className="bg-slate-950/40 border border-emerald-500/20 rounded-lg p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-slate-400 uppercase">
                        {lang === 'es' ? 'Glucosa capilar' : 'Capillary Glucose'}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        <Zap className="h-2.5 w-2.5" aria-hidden />
                        Spot
                      </span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {biomarkers.glucoseMgDl ?? '—'}{' '}
                      <span className="text-xs text-slate-400">
                        mg/dL (
                        {biomarkers.glucoseContext === 'postprandial'
                          ? lang === 'es'
                            ? 'posprandial'
                            : 'postprandial'
                          : lang === 'es'
                            ? 'ayunas'
                            : 'fasting'}
                        )
                      </span>
                    </p>
                  </div>

                  <div className="bg-slate-950/40 border border-emerald-500/20 rounded-lg p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-slate-400 uppercase">
                        {lang === 'es' ? 'Temperatura corporal' : 'Body Temperature'}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        <Zap className="h-2.5 w-2.5" aria-hidden />
                        Spot
                      </span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {biomarkers.bodyTempC !== undefined ? biomarkers.bodyTempC.toFixed(1) : '—'}{' '}
                      <span className="text-xs text-slate-400">°C</span>
                    </p>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-slate-400 uppercase">
                        {lang === 'es' ? 'Riesgo conductual' : 'Behavioral Risk'}
                      </p>
                      <span className="text-[9px] font-bold uppercase text-slate-400">
                        {lang === 'es' ? 'Diario' : 'Daily'}
                      </span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {behavioralCheckIn
                        ? `${behavioralCheckIn.behavioralRiskIndex} / 100`
                        : lang === 'es'
                          ? 'Sin check-in'
                          : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Matriz explicable de reglas clínicas */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
                {t.dashboard.rulesTitle}
              </h2>

              <RuleTrace traces={ruleTraces} />
            </section>

            <QuickMeasurementPanel />
            <BehavioralCheckIn />
            <GodModePanel />
            <OutboxPanel mision={mision} />
          </div>

          <div className="lg:col-span-1">
            <MedicalCopilot mision={mision} />
          </div>
        </div>

        <MissionCenter preferredProfile={mision ? MISSION_CHOICES[mision].profileId : undefined} />
        <RulesAndLimitationsSection />
      </div>
    </div>
  );
}

export default CommandDashboard;
