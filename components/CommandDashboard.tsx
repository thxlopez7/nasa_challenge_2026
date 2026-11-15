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
import { formatDecimal, formatNumber } from '../utils/formatters';
import { MISSION_CHOICES, type MissionSlug } from '../utils/missionChoice';

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  OPTIMAL: 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300',
  WARNING: 'border-amber-500/70 bg-amber-500/10 text-amber-300',
  CRITICAL: 'border-red-500 bg-red-500/15 text-red-300 animate-pulse',
};

function fmtRatio(value: number, lang: 'es' | 'en'): string {
  if (Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return '∞';
  return formatDecimal(value, 2, lang);
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
          text: t.dashboardExtra.escalationEmergency,
          styles: 'border-red-500 bg-red-500/20 text-red-200',
        }
      : escalationLevel === 'notify-flight-surgeon'
        ? {
            text: t.dashboardExtra.escalationSurgeon,
            styles: 'border-amber-500/80 bg-amber-500/15 text-amber-200',
          }
        : {
            text: t.dashboardExtra.escalationSelf,
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
                  {sleepHoursRecorded !== null ? `${formatDecimal(sleepHoursRecorded, 1, lang)} h` : t.common.noRecordToday}
                </span>
              </div>

              {/* Sub-bloque A: Sensores continuos integrados y de cabina (1 Hz) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                    <Radio className="h-4 w-4 animate-pulse" aria-hidden />
                    <span>{t.dashboardExtra.streamSectionTitle}</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-cyan-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" aria-hidden />
                    {t.dashboardExtra.streamLiveBadge}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-950/60 border border-cyan-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.heartRate}</p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                        {t.dashboardExtra.wearable1Hz}
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatNumber(Math.round(biomarkers.heartRate), lang)}{' '}
                      <span className="text-sm text-slate-400">{t.dashboardExtra.bpmUnit}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {t.dashboard.kpis.spo2}: <strong className="text-slate-200">{formatNumber(biomarkers.spO2, lang)}%</strong> · HRV (RMSSD):{' '}
                      <strong className="text-slate-200">
                        {biomarkers.hrvRmssdMs !== undefined ? `${formatDecimal(biomarkers.hrvRmssdMs, 1, lang)} ms` : '—'}
                      </strong>
                    </p>
                  </div>

                  <div className="bg-slate-950/60 border border-cyan-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.co2Level}</p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                        {t.dashboardExtra.eclss1Hz}
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatNumber(Math.round(environment.co2Level), lang)} <span className="text-sm text-slate-400">ppm</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {t.dashboardExtra.prototypeAlertThreshold}: &gt; {formatNumber(T.co2.minCo2Level, lang)} ppm
                    </p>
                  </div>

                  <div className="bg-slate-950/60 border border-cyan-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.radiation}</p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                        {t.dashboardExtra.hera1Hz}
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatDecimal(environment.radiationRate, 1, lang)}{' '}
                      <span className="text-sm text-slate-400">µSv/h</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {t.dashboardExtra.accumulatedDoseLabel}:{' '}
                      <strong className="text-slate-200">{formatDecimal(environment.radiationAccumulated, 1, lang)} mSv</strong>
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
                      <span>{t.dashboardExtra.pocSectionTitle}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t.dashboardExtra.pocSectionDesc}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                    {snapshot.indicatorMeta?.bloodPanel?.source === 'manual'
                      ? t.dashboardExtra.pocManualLogBadge
                      : t.dashboardExtra.pocBatchHoldBadge}
                  </span>
                </div>

                {/* Fila 1: 3 paneles de cartucho Point-of-Care */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-950/50 border border-amber-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.cystatinC}</p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                        {t.dashboardExtra.istatTag}
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatDecimal(biomarkers.cistatinaC, 2, lang)}{' '}
                      <span className="text-sm text-slate-400">mg/L</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Cr: {formatDecimal(biomarkers.creatinina, 2, lang)} · {t.dashboardExtra.ciscCrLabel}:{' '}
                      {formatDecimal(cisCRatio, 2, lang)} · Ca²⁺: {formatDecimal(biomarkers.calcioIonico, 2, lang)}
                    </p>
                  </div>

                  <div className="bg-slate-950/50 border border-amber-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">
                        {t.dashboardExtra.immuneCortisolTitle}
                      </p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                        {t.dashboardExtra.rhealthTag}
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatNumber(Math.round(biomarkers.linfocitos), lang)}{' '}
                      <span className="text-sm text-slate-400">{t.dashboardExtra.lymphUnit}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {t.dashboardExtra.neutShort}: {formatNumber(Math.round(biomarkers.neutrofilos), lang)} · NLR: {fmtRatio(nlr, lang)} · {t.dashboard.kpis.cortisol}:{' '}
                      {formatDecimal(biomarkers.cortisol, 1, lang)}
                    </p>
                  </div>

                  <div className="bg-slate-950/50 border border-amber-500/25 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 uppercase">
                        {t.dashboardExtra.boneTurnoverTitle}
                      </p>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                        {t.dashboardExtra.boneTag}
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {biomarkers.ctxNtxIndex !== undefined ? `${formatDecimal(biomarkers.ctxNtxIndex, 2, lang)}x` : '—'}{' '}
                      <span className="text-sm text-slate-400">CTX/NTX</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      P1NP: {biomarkers.p1npIndex !== undefined ? `${formatDecimal(biomarkers.p1npIndex, 2, lang)}x` : '—'} · ARED:{' '}
                      {biomarkers.aredLoadPct !== undefined ? `${Math.round(biomarkers.aredLoadPct)}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Fila 2: Mediciones rápidas Spot (al instante) + Check-in conductual */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-1">
                  <div className="bg-slate-950/40 border border-emerald-500/20 rounded-lg p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-slate-400 uppercase">
                        {t.dashboardExtra.bloodPressure}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        <Zap className="h-2.5 w-2.5" aria-hidden />
                        {t.dashboardExtra.spotTag}
                      </span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {biomarkers.systolicMmHg ?? '—'}/{biomarkers.diastolicMmHg ?? '—'}{' '}
                      <span className="text-xs text-slate-400">mmHg</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {t.dashboardExtra.orthostaticDeltaHr}:{' '}
                      {biomarkers.orthostaticDeltaHr !== undefined
                        ? `+${Math.round(biomarkers.orthostaticDeltaHr)} ${t.dashboardExtra.bpmUnit}`
                        : '—'}
                    </p>
                  </div>

                  <div className="bg-slate-950/40 border border-emerald-500/20 rounded-lg p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-slate-400 uppercase">
                        {t.dashboardExtra.capillaryGlucose}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        <Zap className="h-2.5 w-2.5" aria-hidden />
                        {t.dashboardExtra.spotTag}
                      </span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {biomarkers.glucoseMgDl ?? '—'}{' '}
                      <span className="text-xs text-slate-400">
                        mg/dL (
                        {biomarkers.glucoseContext === 'postprandial'
                          ? t.dashboardExtra.postprandial
                          : t.dashboardExtra.fasting}
                        )
                      </span>
                    </p>
                  </div>

                  <div className="bg-slate-950/40 border border-emerald-500/20 rounded-lg p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-slate-400 uppercase">
                        {t.dashboardExtra.bodyTemp}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        <Zap className="h-2.5 w-2.5" aria-hidden />
                        {t.dashboardExtra.spotTag}
                      </span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {biomarkers.bodyTempC !== undefined ? formatDecimal(biomarkers.bodyTempC, 1, lang) : '—'}{' '}
                      <span className="text-xs text-slate-400">°C</span>
                    </p>
                  </div>

                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-slate-400 uppercase">
                        {t.dashboardExtra.behavioralRisk}
                      </p>
                      <span className="text-[9px] font-bold uppercase text-slate-400">
                        {t.dashboardExtra.dailyTag}
                      </span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {behavioralCheckIn
                        ? `${behavioralCheckIn.behavioralRiskIndex} / 100`
                        : t.dashboardExtra.pendingCheckIn}
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
