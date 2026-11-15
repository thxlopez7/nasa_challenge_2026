'use client';

import { useState } from 'react';
import { RotateCcw, Siren, Sun, Wind, Activity, WifiOff, Wifi, Bone, HeartPulse } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ClinicalAlerts, SimulationScenario } from '../types/telemetry';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useT } from '../i18n/I18nContext';

type ScenarioMeta = {
  icon: LucideIcon;
  expectedAlert: keyof ClinicalAlerts | null;
  styles: string;
};

const SCENARIO_META: Record<SimulationScenario, ScenarioMeta> = {
  SOLAR_STORM: {
    icon: Sun,
    expectedAlert: 'isRadiationWarning',
    styles: 'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
  },
  CO2_LEAK: {
    icon: Wind,
    expectedAlert: 'isCo2Warning',
    styles: 'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
  },
  RENAL_DAMAGE: {
    icon: Activity,
    expectedAlert: 'isRenalWarning',
    styles: 'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
  },
  BONE_LOSS: {
    icon: Bone,
    expectedAlert: null,
    styles: 'border-orange-500/60 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20',
  },
  CARDIO_DECONDITIONING: {
    icon: HeartPulse,
    expectedAlert: null,
    styles: 'border-rose-500/60 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
  },
  RESET: {
    icon: RotateCcw,
    expectedAlert: null,
    styles: 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20',
  },
};

const SCENARIO_ORDER: SimulationScenario[] = [
  'SOLAR_STORM',
  'CO2_LEAK',
  'RENAL_DAMAGE',
  'BONE_LOSS',
  'CARDIO_DECONDITIONING',
  'RESET',
];

export function GodModePanel() {
  const { t, lang } = useT();
  const simulateScenario = useTelemetryStore((s) => s.simulateScenario);
  const triggerCodeRed = useTelemetryStore((s) => s.triggerCodeRed);
  const simulateOffline = useTelemetryStore((s) => Boolean(s.simulateOffline));
  const setSimulateOffline = useTelemetryStore((s) => s.setSimulateOffline);
  const isEmergency = useTelemetryStore((s) => s.isEmergency);
  const isRenalWarning = useTelemetryStore((s) => s.isRenalWarning);
  const isRadiationWarning = useTelemetryStore((s) => s.isRadiationWarning);
  const isCo2Warning = useTelemetryStore((s) => s.isCo2Warning);

  const [lastInjected, setLastInjected] = useState<SimulationScenario | null>(null);

  const alerts: ClinicalAlerts = {
    isEmergency,
    isRenalWarning,
    isRadiationWarning,
    isCo2Warning,
  };

  const inject = (scenario: SimulationScenario) => {
    simulateScenario(scenario);
    setLastInjected(scenario);
  };

  return (
    <section
      aria-labelledby="god-mode-title"
      className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
            {t.godMode.eyebrow}
          </p>
          <h2
            id="god-mode-title"
            className="text-lg font-bold text-cyan-400 uppercase tracking-wider"
          >
            {t.godMode.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">{t.godMode.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSimulateOffline(!simulateOffline)}
            aria-pressed={simulateOffline}
            className={`min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              simulateOffline
                ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
            }`}
          >
            {simulateOffline ? (
              <WifiOff className="h-4 w-4 text-amber-300" aria-hidden />
            ) : (
              <Wifi className="h-4 w-4 text-emerald-400" aria-hidden />
            )}
            {lang === 'es'
              ? simulateOffline
                ? 'Enlace caído (Simulado)'
                : 'Simular pérdida de enlace'
              : simulateOffline
                ? 'Link Loss Active'
                : 'Simulate Link Loss'}
          </button>

          <button
            type="button"
            onClick={triggerCodeRed}
            aria-pressed={isEmergency}
            className={`min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              isEmergency
                ? 'border-red-500 bg-red-600 text-white animate-pulse'
                : 'border-red-500/70 bg-red-500/10 text-red-300 hover:bg-red-500/20'
            }`}
          >
            <Siren className="h-4 w-4" aria-hidden />
            {isEmergency ? t.godMode.codeRedButtonActive : t.godMode.codeRedButtonIdle}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SCENARIO_ORDER.map((scenario) => {
          const meta = SCENARIO_META[scenario];
          const text = t.godMode.scenarios[scenario];
          const Icon = meta.icon;
          const fired = meta.expectedAlert ? alerts[meta.expectedAlert] : false;
          const isLast = lastInjected === scenario;

          return (
            <button
              key={scenario}
              type="button"
              onClick={() => inject(scenario)}
              className={`group relative min-h-[44px] text-left p-4 rounded-lg border transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${meta.styles} ${
                isLast ? 'ring-1 ring-cyan-500/70' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5" aria-hidden />
                {meta.expectedAlert && (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      fired
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {fired ? t.dashboard.activeAlert : t.dashboard.nominalClear}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-bold uppercase tracking-wide">
                {text.label}
              </p>
              <p className="mt-1 text-xs text-slate-300/80 leading-snug">
                {text.desc}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default GodModePanel;
