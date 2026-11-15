'use client';

import GodModePanel from './GodModePanel';
import MedicalCopilot from './MedicalCopilot';
import SensorSimulator from './SensorSimulator';
import MissionCenter from './mission/MissionCenter';
import QuickMeasurementPanel from './mission/QuickMeasurementPanel';
import BehavioralCheckIn from './mission/BehavioralCheckIn';
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

function RuleRow({
  title,
  rule,
  active,
  activeLabel,
  nominalLabel,
  critical = false,
}: {
  title: string;
  rule: string;
  active: boolean;
  activeLabel: string;
  nominalLabel: string;
  critical?: boolean;
}) {
  const on = critical ? 'text-red-400' : 'text-amber-400';
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors ${
        active
          ? critical
            ? 'border-red-500/70 bg-red-500/10'
            : 'border-amber-500/70 bg-amber-500/10'
          : 'border-slate-800 bg-slate-950/60'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="text-xs text-slate-400 font-mono mt-0.5">{rule}</p>
      </div>
      <span
        className={`shrink-0 text-xs font-bold uppercase px-2 py-0.5 rounded ${
          active ? `${on} bg-slate-950/50` : 'text-cyan-400'
        }`}
      >
        {active ? activeLabel : nominalLabel}
      </span>
    </div>
  );
}

/** Centro de mando: telemetría unificada, reglas clínicas, God Mode, copiloto IA y Centro de misión. */
export function CommandDashboard({ mision }: { mision?: MissionSlug }) {
  const { t, lang } = useT();
  const snapshot = useClinicalSnapshot(mision);
  const {
    biomarkers,
    environment,
    alerts,
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
            {/* Telemetría en vivo */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
                  {t.nav.sectionCommand}
                </h2>
                <span className="text-xs text-slate-400">
                  {t.dashboard.sleepToday}:{' '}
                  {sleepHoursRecorded !== null ? `${sleepHoursRecorded.toFixed(1)} h` : t.common.noRecordToday}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.heartRate}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">
                    {Math.round(biomarkers.heartRate)}{' '}
                    <span className="text-sm text-slate-400">{lang === 'es' ? 'lpm' : 'bpm'}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {t.dashboard.kpis.spo2}: {biomarkers.spO2}% · {t.dashboard.kpis.cortisol}:{' '}
                    {biomarkers.cortisol.toFixed(1)} ng/mL
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.co2Level}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">
                    {Math.round(environment.co2Level)} <span className="text-sm text-slate-400">ppm</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === 'es' ? 'Umbral prototipo' : 'Prototype alert'}: &gt; {T.co2.minCo2Level} ppm
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.cystatinC}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">
                    {biomarkers.cistatinaC.toFixed(2)}{' '}
                    <span className="text-sm text-slate-400">mg/L</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Cr: {biomarkers.creatinina.toFixed(2)} · CisC/Cr: {cisCRatio.toFixed(2)} · Ca²⁺:{' '}
                    {biomarkers.calcioIonico.toFixed(2)}
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">{t.dashboard.kpis.radiation}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">
                    {environment.radiationRate.toFixed(1)}{' '}
                    <span className="text-sm text-slate-400">µSv/h</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Linf: {Math.round(biomarkers.linfocitos)} · NLR: {fmtRatio(nlr)} ·{' '}
                    {environment.radiationAccumulated.toFixed(1)} mSv
                  </p>
                </div>
              </div>

              {/* Tarjetas de captura manual P2 (Presión, Glucosa, Temp, Índice conductual) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-1">
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3.5">
                  <p className="text-[11px] text-slate-400 uppercase">
                    {lang === 'es' ? 'Presión arterial' : 'Blood Pressure'}
                  </p>
                  <p className="text-lg font-bold mt-1 tabular-nums">
                    {biomarkers.systolicMmHg ?? '—'}/{biomarkers.diastolicMmHg ?? '—'}{' '}
                    <span className="text-xs text-slate-400">mmHg</span>
                  </p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3.5">
                  <p className="text-[11px] text-slate-400 uppercase">
                    {lang === 'es' ? 'Glucosa capilar' : 'Capillary Glucose'}
                  </p>
                  <p className="text-lg font-bold mt-1 tabular-nums">
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
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3.5">
                  <p className="text-[11px] text-slate-400 uppercase">
                    {lang === 'es' ? 'Temperatura corporal' : 'Body Temperature'}
                  </p>
                  <p className="text-lg font-bold mt-1 tabular-nums">
                    {biomarkers.bodyTempC !== undefined ? biomarkers.bodyTempC.toFixed(1) : '—'}{' '}
                    <span className="text-xs text-slate-400">°C</span>
                  </p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3.5">
                  <p className="text-[11px] text-slate-400 uppercase">
                    {lang === 'es' ? 'Riesgo conductual' : 'Behavioral Risk'}
                  </p>
                  <p className="text-lg font-bold mt-1 tabular-nums">
                    {behavioralCheckIn ? `${behavioralCheckIn.behavioralRiskIndex} / 100` : lang === 'es' ? 'Sin check-in' : 'Pending'}
                  </p>
                </div>
              </div>
            </section>

            {/* Matriz de reglas clínicas */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
                {t.dashboard.rulesTitle}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <RuleRow
                  title={`R1 · ${t.dashboard.rules.nephropathyName}`}
                  rule={t.dashboard.rules.nephropathyCondition}
                  active={alerts.isRenalWarning}
                  activeLabel={t.dashboard.activeAlert}
                  nominalLabel={t.dashboard.nominalClear}
                />
                <RuleRow
                  title={`R2 · ${t.dashboard.rules.radiationName}`}
                  rule={t.dashboard.rules.radiationCondition}
                  active={alerts.isRadiationWarning}
                  activeLabel={t.dashboard.activeAlert}
                  nominalLabel={t.dashboard.nominalClear}
                />
                <RuleRow
                  title={`R3 · ${t.dashboard.rules.co2Name}`}
                  rule={t.dashboard.rules.co2Condition}
                  active={alerts.isCo2Warning}
                  activeLabel={t.dashboard.activeAlert}
                  nominalLabel={t.dashboard.nominalClear}
                />
                <RuleRow
                  title={`R4 · ${t.dashboard.rules.emergencyName}`}
                  rule={t.dashboard.rules.emergencyCondition}
                  active={alerts.isEmergency}
                  activeLabel={t.dashboard.activeAlert}
                  nominalLabel={t.dashboard.nominalClear}
                  critical
                />
              </div>
            </section>

            <QuickMeasurementPanel />
            <BehavioralCheckIn />
            <GodModePanel />
          </div>

          <div className="lg:col-span-1">
            <MedicalCopilot mision={mision} />
          </div>
        </div>

        <MissionCenter preferredProfile={mision ? MISSION_CHOICES[mision].profileId : undefined} />
      </div>
    </div>
  );
}

export default CommandDashboard;
