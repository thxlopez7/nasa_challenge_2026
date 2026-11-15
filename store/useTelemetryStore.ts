import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import {
  Biomarkers,
  ClinicalAlerts,
  Environment,
  ScenarioType,
  TelemetryState,
} from '../types/telemetry';
import { evaluateTelemetry } from '../utils/clinicalEngine';

type TelemetryDataState = Biomarkers &
  Environment &
  ClinicalAlerts & {
    isManualOverride: boolean;
  };

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
  radiationRate: 15.5,
  radiationAccumulated: 45,

  // ClinicalAlerts
  isEmergency: false,
  isRenalWarning: false,
  isRadiationWarning: false,
  isCo2Warning: false,

  // Control de Simulación Manual (Override)
  isManualOverride: false,
};

/**
 * Sanitiza lecturas entrantes: si el valor es `undefined`, `NaN` o `Infinity`,
 * conserva el último valor válido conocido del store.
 */
const pickFiniteNumber = (
  incoming: number | undefined,
  fallback: number
): number =>
  typeof incoming === 'number' && Number.isFinite(incoming)
    ? incoming
    : fallback;

/**
 * Storage seguro para SSR en Next.js 15+ y Node 25+ con throttle de escritura (2s)
 * para no bloquear el hilo principal en loops de 1 Hz.
 */
const createThrottledBrowserStorage = (): StateStorage => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingValue: string | null = null;

  return {
    getItem: (name: string): string | null => {
      if (typeof window === 'undefined') return null;
      try {
        return window.localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: string): void => {
      if (typeof window === 'undefined') return;
      pendingValue = value;
      if (timeoutId !== null) return;

      try {
        window.localStorage.setItem(name, value);
      } catch {
        // Ignore quota errors
      }

      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (pendingValue !== null) {
          try {
            window.localStorage.setItem(name, pendingValue);
          } catch {
            // Ignore quota errors
          }
        }
      }, 1500);
    },
    removeItem: (name: string): void => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.removeItem(name);
      } catch {
        // Ignore storage errors
      }
    },
  };
};

export const useTelemetryStore = create<TelemetryState>()(
  persist(
    (set, get) => ({
      ...initialState,

      updateSensors: (data: Partial<Biomarkers & Environment>) => {
        const currentState = get();

        const nextBio: Biomarkers = {
          heartRate: pickFiniteNumber(data.heartRate, currentState.heartRate),
          spO2: pickFiniteNumber(data.spO2, currentState.spO2),
          cistatinaC: pickFiniteNumber(
            data.cistatinaC,
            currentState.cistatinaC
          ),
          creatinina: pickFiniteNumber(
            data.creatinina,
            currentState.creatinina
          ),
          calcioIonico: pickFiniteNumber(
            data.calcioIonico,
            currentState.calcioIonico
          ),
          linfocitos: pickFiniteNumber(
            data.linfocitos,
            currentState.linfocitos
          ),
          neutrofilos: pickFiniteNumber(
            data.neutrofilos,
            currentState.neutrofilos
          ),
          cortisol: pickFiniteNumber(data.cortisol, currentState.cortisol),
        };

        const nextRadiationAccumulated = pickFiniteNumber(
          data.radiationAccumulated,
          currentState.radiationAccumulated
        );

        // Si el dataset inyecta `radiationAccumulated` creciente sin `radiationRate`,
        // estimamos la tasa instantánea en función de la exposición acumulada.
        const derivedRadiationRate =
          data.radiationRate !== undefined
            ? pickFiniteNumber(data.radiationRate, currentState.radiationRate)
            : data.radiationAccumulated !== undefined &&
              nextRadiationAccumulated > 50
            ? 85.0
            : currentState.radiationRate;

        const nextEnv: Environment = {
          co2Level: pickFiniteNumber(data.co2Level, currentState.co2Level),
          radiationRate: derivedRadiationRate,
          radiationAccumulated: nextRadiationAccumulated,
        };

        const alerts = evaluateTelemetry(nextBio, nextEnv);

        set({
          ...nextBio,
          ...nextEnv,
          ...alerts,
        });
      },

      triggerCodeRed: () => {
        set({ isEmergency: true, isManualOverride: true });
      },

      simulateScenario: (scenario: ScenarioType) => {
        if (scenario === 'RESET') {
          set({
            ...initialState,
            isManualOverride: false,
          });
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
          isManualOverride: true,
        });
      },
    }),
    {
      name: 'exovitals-core-storage',
      storage: createJSONStorage(createThrottledBrowserStorage),
    }
  )
);
