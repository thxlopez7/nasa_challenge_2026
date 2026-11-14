'use client';

import { useState } from 'react';
import { RotateCcw, Siren, Sun, Wind, Activity } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ClinicalAlerts, SimulationScenario } from '../types/telemetry';
import { useTelemetryStore } from '../store/useTelemetryStore';

type ScenarioConfig = {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Bandera de `ClinicalAlerts` que el escenario debe disparar */
  expectedAlert: keyof ClinicalAlerts | null;
  styles: string;
};

const SCENARIOS: Record<SimulationScenario, ScenarioConfig> = {
  SOLAR_STORM: {
    label: 'Tormenta solar',
    description: 'Radiación 120 µSv/h · linfopenia · NLR alto',
    icon: Sun,
    expectedAlert: 'isRadiationWarning',
    styles:
      'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
  },
  CO2_LEAK: {
    label: 'Fuga de CO2',
    description: 'CO2 4200 ppm con SpO2 conservada',
    icon: Wind,
    expectedAlert: 'isCo2Warning',
    styles:
      'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
  },
  RENAL_DAMAGE: {
    label: 'Daño renal',
    description: 'Cistatina C y calcio altos, creatinina normal',
    icon: Activity,
    expectedAlert: 'isRenalWarning',
    styles:
      'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
  },
  RESET: {
    label: 'Restaurar base',
    description: 'Valores nominales y alertas apagadas',
    icon: RotateCcw,
    expectedAlert: null,
    styles:
      'border-cyan-500/60 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20',
  },
};

const SCENARIO_ORDER: SimulationScenario[] = [
  'SOLAR_STORM',
  'CO2_LEAK',
  'RENAL_DAMAGE',
  'RESET',
];

export function GodModePanel() {
  const simulateScenario = useTelemetryStore((s) => s.simulateScenario);
  const triggerCodeRed = useTelemetryStore((s) => s.triggerCodeRed);
  const isEmergency = useTelemetryStore((s) => s.isEmergency);
  const isRenalWarning = useTelemetryStore((s) => s.isRenalWarning);
  const isRadiationWarning = useTelemetryStore((s) => s.isRadiationWarning);
  const isCo2Warning = useTelemetryStore((s) => s.isCo2Warning);
  const [lastInjected, setLastInjected] = useState<SimulationScenario | null>(
    null
  );

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
          <h2
            id="god-mode-title"
            className="text-lg font-bold text-cyan-400 uppercase tracking-wider"
          >
            God Mode · Inyección de escenarios
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Fuerza lecturas para demostrar la reacción del motor RIDGE en
            tiempo real.
          </p>
        </div>
        <button
          type="button"
          onClick={triggerCodeRed}
          aria-pressed={isEmergency}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            isEmergency
              ? 'border-red-500 bg-red-500 text-white animate-pulse'
              : 'border-red-500/70 bg-red-500/10 text-red-300 hover:bg-red-500/20'
          }`}
        >
          <Siren className="h-4 w-4" aria-hidden />
          {isEmergency ? 'Code Red activo' : 'Trigger Code Red'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {SCENARIO_ORDER.map((scenario) => {
          const cfg = SCENARIOS[scenario];
          const Icon = cfg.icon;
          const fired = cfg.expectedAlert ? alerts[cfg.expectedAlert] : false;
          const isLast = lastInjected === scenario;

          return (
            <button
              key={scenario}
              type="button"
              onClick={() => inject(scenario)}
              className={`group relative text-left p-4 rounded-lg border transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${cfg.styles} ${
                isLast ? 'ring-1 ring-cyan-500/70' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5" aria-hidden />
                {cfg.expectedAlert && (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      fired
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {fired ? 'Alerta activa' : 'En reposo'}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-bold uppercase tracking-wide">
                {cfg.label}
              </p>
              <p className="mt-1 text-xs text-slate-400 leading-snug">
                {cfg.description}
              </p>
              <p className="mt-2 text-[10px] font-mono text-slate-500">
                {scenario}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default GodModePanel;
