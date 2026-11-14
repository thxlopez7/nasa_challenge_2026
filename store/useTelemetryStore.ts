import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  ScenarioName,
  TelemetryState,
  TelemetryStore,
} from '@/types/telemetry';
import { evaluateTelemetry } from '@/utils/clinicalEngine';

export const INITIAL_TELEMETRY_STATE: TelemetryState = {
  // Métricas biométricas (Astronauta óptimo)
  heartRate: 72,
  spO2: 99,
  cistatinaC: 0.8,
  creatinina: 1.1,
  calcioIonico: 1.1,
  linfocitos: 1500,
  neutrofilos: 3000,
  cortisol: 10,

  // Métricas ambientales
  co2Level: 600,
  radiationRate: 0.4,
  radiationAccumulated: 45,

  // Estados de alerta
  isEmergency: false,
  isRenalWarning: false,
  isRadiationWarning: false,
  isCo2Warning: false,
};

export const useTelemetryStore = create<TelemetryStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_TELEMETRY_STATE,

      updateSensors: (data: Partial<TelemetryState>) => {
        const currentState = get();
        const mergedState: TelemetryState = {
          ...currentState,
          ...data,
        };

        const evaluation = evaluateTelemetry(mergedState);

        set({
          ...mergedState,
          isRenalWarning: evaluation.isRenalWarning,
          isRadiationWarning: evaluation.isRadiationWarning,
          isCo2Warning: evaluation.isCo2Warning,
          isEmergency:
            data.isEmergency !== undefined
              ? data.isEmergency
              : currentState.isEmergency,
        });
      },

      triggerCodeRed: () => {
        set({ isEmergency: true });
      },

      simulateScenario: (scenarioName: ScenarioName) => {
        const currentState = get();
        let scenarioPatch: Partial<TelemetryState> = {};

        switch (scenarioName) {
          case 'Tormenta Solar':
            scenarioPatch = {
              radiationRate: 14.8,
              radiationAccumulated: 78,
              neutrofilos: 6400,
              linfocitos: 1100, // NLR = 5.82 (> 3.5)
              cortisol: 29,
              heartRate: 96,
            };
            break;

          case 'Falla Filtro CO2':
            scenarioPatch = {
              co2Level: 4000, // > 3500 ppm
              spO2: 98, // >= 96%
              heartRate: 90,
              cortisol: 22,
            };
            break;

          case 'Sarcopenia Renal':
            scenarioPatch = {
              cistatinaC: 1.42, // > 1.15 mg/L
              calcioIonico: 1.45, // > 1.32 mmol/L
              creatinina: 1.35,
            };
            break;

          case 'Nominal':
            scenarioPatch = {
              ...INITIAL_TELEMETRY_STATE,
            };
            break;
        }

        const nextState: TelemetryState = {
          ...currentState,
          ...scenarioPatch,
        };

        const evaluation = evaluateTelemetry(nextState);

        set({
          ...nextState,
          isRenalWarning: evaluation.isRenalWarning,
          isRadiationWarning: evaluation.isRadiationWarning,
          isCo2Warning: evaluation.isCo2Warning,
          isEmergency:
            scenarioName === 'Nominal' ? false : currentState.isEmergency,
        });
      },

      resetTelemetry: () => {
        set({ ...INITIAL_TELEMETRY_STATE });
      },
    }),
    {
      name: 'exovitals-telemetry-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
