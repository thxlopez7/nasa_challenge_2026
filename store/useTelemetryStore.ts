import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  Biomarkers,
  ClinicalAlerts,
  Environment,
  ScenarioType,
  TelemetryState,
} from '../types/telemetry';
import { evaluateTelemetry } from '../utils/clinicalEngine';

type TelemetryDataState = Biomarkers & Environment & ClinicalAlerts;

export const initialState: TelemetryDataState = {
  // Biomarkers (Astronauta base sano)
  heartRate: 72,
  spO2: 99,
  cistatinaC: 0.8,
  creatinina: 1.1,
  calcioIonico: 1.1,
  linfocitos: 1500,
  neutrofilos: 3000,
  cortisol: 10,

  // Environment
  co2Level: 600,
  radiationRate: 0.4,
  radiationAccumulated: 45,

  // ClinicalAlerts
  isEmergency: false,
  isRenalWarning: false,
  isRadiationWarning: false,
  isCo2Warning: false,
};

export const useTelemetryStore = create<TelemetryState>()(
  persist(
    (set, get) => ({
      ...initialState,

      updateSensors: (data: Partial<Biomarkers & Environment>) => {
        const currentState = get();

        const nextBio: Biomarkers = {
          heartRate: data.heartRate ?? currentState.heartRate,
          spO2: data.spO2 ?? currentState.spO2,
          cistatinaC: data.cistatinaC ?? currentState.cistatinaC,
          creatinina: data.creatinina ?? currentState.creatinina,
          calcioIonico: data.calcioIonico ?? currentState.calcioIonico,
          linfocitos: data.linfocitos ?? currentState.linfocitos,
          neutrofilos: data.neutrofilos ?? currentState.neutrofilos,
          cortisol: data.cortisol ?? currentState.cortisol,
        };

        const nextEnv: Environment = {
          co2Level: data.co2Level ?? currentState.co2Level,
          radiationRate: data.radiationRate ?? currentState.radiationRate,
          radiationAccumulated:
            data.radiationAccumulated ?? currentState.radiationAccumulated,
        };

        const alerts = evaluateTelemetry(nextBio, nextEnv);

        set({
          ...nextBio,
          ...nextEnv,
          ...alerts,
        });
      },

      triggerCodeRed: () => {
        set({ isEmergency: true });
      },

      simulateScenario: (scenario: ScenarioType) => {
        if (scenario === 'RESET') {
          set({ ...initialState });
          return;
        }

        const currentState = get();
        let scenarioOverrides: Partial<Biomarkers & Environment> = {};

        switch (scenario) {
          case 'CO2_LEAK':
            scenarioOverrides = {
              co2Level: 4200,
            };
            break;

          case 'SOLAR_STORM':
            scenarioOverrides = {
              // Evento de partículas solares: la Regla 2 evalúa la tasa actual.
              radiationRate: 120,
              radiationAccumulated: 80,
              neutrofilos: 4500,
              linfocitos: 800,
            };
            break;

          case 'RENAL_DAMAGE':
            scenarioOverrides = {
              cistatinaC: 1.4,
              creatinina: 0.9,
              calcioIonico: 1.5,
            };
            break;
        }

        const nextBio: Biomarkers = {
          heartRate: scenarioOverrides.heartRate ?? currentState.heartRate,
          spO2: scenarioOverrides.spO2 ?? currentState.spO2,
          cistatinaC: scenarioOverrides.cistatinaC ?? currentState.cistatinaC,
          creatinina: scenarioOverrides.creatinina ?? currentState.creatinina,
          calcioIonico:
            scenarioOverrides.calcioIonico ?? currentState.calcioIonico,
          linfocitos: scenarioOverrides.linfocitos ?? currentState.linfocitos,
          neutrofilos:
            scenarioOverrides.neutrofilos ?? currentState.neutrofilos,
          cortisol: scenarioOverrides.cortisol ?? currentState.cortisol,
        };

        const nextEnv: Environment = {
          co2Level: scenarioOverrides.co2Level ?? currentState.co2Level,
          radiationRate:
            scenarioOverrides.radiationRate ?? currentState.radiationRate,
          radiationAccumulated:
            scenarioOverrides.radiationAccumulated ??
            currentState.radiationAccumulated,
        };

        const alerts = evaluateTelemetry(nextBio, nextEnv);

        set({
          ...nextBio,
          ...nextEnv,
          ...alerts,
        });
      },
    }),
    {
      name: 'exovitals-core-storage',
      storage: createJSONStorage(() => window.localStorage),
    }
  )
);
