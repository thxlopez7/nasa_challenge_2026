'use client';

import GodModePanel from './GodModePanel';
import MedicalCopilot from './MedicalCopilot';
import SensorSimulator from './SensorSimulator';
import CrewPanel from './scenario/CrewPanel';
import type { CrewProfile } from '../types/profile';
import { SCENARIO_FRAMES } from '../utils/scenarios';
import MissionCenter from './mission/MissionCenter';
import { useTelemetryStore } from '../store/useTelemetryStore';
import type { AlertSeverity } from '../types/telemetry';
import {
  RIDGE_THRESHOLDS as T,
  computeNlr,
  getAlertSeverity,
} from '../utils/clinicalEngine';
import { MISSION_CHOICES, type MissionSlug } from '../utils/missionChoice';

const SEVERITY_BADGE: Record<AlertSeverity, { label: string; styles: string }> = {
  OPTIMAL: {
    label: 'Óptimo',
    styles: 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300',
  },
  WARNING: {
    label: 'Advertencia',
    styles: 'border-amber-500/70 bg-amber-500/10 text-amber-300',
  },
  CRITICAL: {
    label: 'Crítico',
    styles: 'border-red-500 bg-red-500/15 text-red-300 animate-pulse',
  },
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
  critical = false,
}: {
  title: string;
  rule: string;
  active: boolean;
  critical?: boolean;
}) {
  const on = critical ? 'text-red-500' : 'text-amber-500';
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
        className={`shrink-0 text-sm font-bold uppercase ${
          active ? on : 'text-cyan-500'
        }`}
      >
        {active ? 'Activa' : 'Normal'}
      </span>
    </div>
  );
}

/** Centro de mando: telemetría, motor RIDGE, God Mode, copiloto y Centro de misión. */
export function CommandDashboard({ mision, profile }: { mision?: MissionSlug; profile?: CrewProfile }) {
  // Cada tripulante reproduce el guion de su escenario (o el dataset en vivo).
  const script = profile && profile.scenario !== 'live' ? SCENARIO_FRAMES[profile.scenario] : undefined;

  const {
    heartRate,
    spO2,
    cistatinaC,
    creatinina,
    calcioIonico,
    linfocitos,
    neutrofilos,
    co2Level,
    radiationRate,
    radiationAccumulated,
    isEmergency,
    isRenalWarning,
    isRadiationWarning,
    isCo2Warning,
  } = useTelemetryStore();

  const nlr = computeNlr({ neutrofilos, linfocitos });
  const severity = getAlertSeverity({
    isEmergency,
    isRenalWarning,
    isRadiationWarning,
    isCo2Warning,
  });
  const badge = SEVERITY_BADGE[severity];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 lg:p-10">
      <SensorSimulator key={profile?.id ?? 'live'} frames={script?.frames} loop={script?.loop ?? true} />

      <div className="max-w-7xl mx-auto space-y-8">
        {profile && <CrewPanel profile={profile} />}
        <header className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-500">
              NASA Space Apps Challenge 2026 // Edge-First CDSS
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              EXOVITALS — MISSION MEDICAL COMMAND
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider ${badge.styles}`}
            >
              Estado: {badge.label}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              1 Hz TELEMETRY STREAM
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
            {/* Telemetría en vivo */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
                Telemetría en vivo
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">Heart Rate</p>
                  <p className="text-4xl font-thin mt-1 tabular-nums">
                    {heartRate} <span className="text-sm text-slate-400">bpm</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">SpO2: {spO2}%</p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">Nivel CO2</p>
                  <p className="text-4xl font-thin mt-1 tabular-nums">
                    {co2Level} <span className="text-sm text-slate-400">ppm</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Umbral: &gt; {T.co2.minCo2Level} ppm
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">Cistatina C</p>
                  <p className="text-4xl font-thin mt-1 tabular-nums">
                    {cistatinaC.toFixed(2)}{' '}
                    <span className="text-sm text-slate-400">mg/L</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Cr: {creatinina.toFixed(2)} · Ca²⁺: {calcioIonico.toFixed(2)}
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">Radiación</p>
                  <p className="text-4xl font-thin mt-1 tabular-nums">
                    {radiationRate}{' '}
                    <span className="text-sm text-slate-400">µSv/h</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Linf: {linfocitos} · NLR: {fmtRatio(nlr)} · {radiationAccumulated} mSv
                  </p>
                </div>
              </div>
            </section>

            {/* Motor clínico RIDGE */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
                Motor clínico (RIDGE)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <RuleRow
                  title="R1 · Nefropatía oculta"
                  rule={`Cr ≤ ${T.renal.maxCreatinina} ∧ CisC > ${T.renal.minCistatinaC} ∧ Ca²⁺ > ${T.renal.minCalcioIonico}`}
                  active={isRenalWarning}
                />
                <RuleRow
                  title="R2 · Inmunosupresión por radiación"
                  rule={`Rad > ${T.radiation.minRadiationRate} µSv/h ∧ Linf < ${T.radiation.maxLinfocitos} ∧ NLR > ${T.radiation.minNlr}`}
                  active={isRadiationWarning}
                />
                <RuleRow
                  title="R3 · Bolsillo de CO2"
                  rule={`CO2 > ${T.co2.minCo2Level} ppm ∧ SpO2 ≥ ${T.co2.minSpO2}%`}
                  active={isCo2Warning}
                />
                <RuleRow
                  title="Emergencia crítica (Code Red)"
                  rule="Override manual del tripulante"
                  active={isEmergency}
                  critical
                />
              </div>
            </section>

            <GodModePanel />
          </div>

          <div className="lg:col-span-1">
            <MedicalCopilot />
          </div>
        </div>

        <MissionCenter preferredProfile={mision ? MISSION_CHOICES[mision].profileId : undefined} />
      </div>
    </div>
  );
}

export default CommandDashboard;
