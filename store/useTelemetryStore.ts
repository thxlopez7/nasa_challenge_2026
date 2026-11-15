import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import {
  BehavioralCheckInData,
  BehavioralCheckInInput,
  Biomarkers,
  ClinicalAlerts,
  Environment,
  IndicatorMeta,
  ManualVitalsPatch,
  mockInitialState,
  ScenarioType,
  TelemetryData,
  TelemetryState,
  TrackedIndicatorKey,
} from '../types/telemetry';
import { evaluateTelemetry } from '../utils/clinicalEngine';
import {
  computeBehavioralRiskIndex,
  deriveEscalationLevel,
} from '../utils/behavioralScoring';

type TelemetryDataState = TelemetryData & {
  isManualOverride: boolean;
};

export const initialState: TelemetryDataState = {
  ...mockInitialState,
  indicatorMeta: {},
};

const pickFiniteNumber = (
  incoming: number | undefined,
  fallback: number
): number =>
  typeof incoming === 'number' && Number.isFinite(incoming)
    ? incoming
    : fallback;

const pickBoundedNumber = (
  incoming: number | undefined,
  fallback: number | undefined,
  min: number,
  max: number
): number | undefined => {
  if (typeof incoming !== 'number' || !Number.isFinite(incoming)) {
    return fallback;
  }
  if (incoming < min || incoming > max) {
    return fallback;
  }
  return incoming;
};

function sanitizeTimestamp(input?: string): string {
  if (input) {
    const parsed = Date.parse(input);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

/**
 * Storage seguro para SSR en Next.js 16 y Node con throttle de escritura (1.5s)
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
        const nowIso = new Date().toISOString();

        const nextBio: Biomarkers = {
          heartRate: pickFiniteNumber(data.heartRate, currentState.heartRate),
          spO2: pickFiniteNumber(data.spO2, currentState.spO2),
          cistatinaC: pickFiniteNumber(data.cistatinaC, currentState.cistatinaC),
          creatinina: pickFiniteNumber(data.creatinina, currentState.creatinina),
          calcioIonico: pickFiniteNumber(data.calcioIonico, currentState.calcioIonico),
          linfocitos: pickFiniteNumber(data.linfocitos, currentState.linfocitos),
          neutrofilos: pickFiniteNumber(data.neutrofilos, currentState.neutrofilos),
          cortisol: pickFiniteNumber(data.cortisol, currentState.cortisol),
          systolicMmHg: pickBoundedNumber(
            data.systolicMmHg,
            currentState.systolicMmHg,
            50,
            260
          ),
          diastolicMmHg: pickBoundedNumber(
            data.diastolicMmHg,
            currentState.diastolicMmHg,
            30,
            160
          ),
          glucoseMgDl: pickBoundedNumber(
            data.glucoseMgDl,
            currentState.glucoseMgDl,
            20,
            600
          ),
          glucoseContext: data.glucoseContext ?? currentState.glucoseContext,
          bodyTempC: pickBoundedNumber(data.bodyTempC, currentState.bodyTempC, 32, 43),
          ctxNtxIndex: pickBoundedNumber(data.ctxNtxIndex, currentState.ctxNtxIndex, 0.2, 6),
          p1npIndex: pickBoundedNumber(data.p1npIndex, currentState.p1npIndex, 0.2, 5),
          aredLoadPct: pickBoundedNumber(data.aredLoadPct, currentState.aredLoadPct, 0, 150),
          hrvRmssdMs: pickBoundedNumber(data.hrvRmssdMs, currentState.hrvRmssdMs, 5, 200),
          orthostaticDeltaHr: pickBoundedNumber(
            data.orthostaticDeltaHr,
            currentState.orthostaticDeltaHr,
            -20,
            80
          ),
          orthostaticDeltaSys: pickBoundedNumber(
            data.orthostaticDeltaSys,
            currentState.orthostaticDeltaSys,
            -70,
            40
          ),
        };

        const nextRadiationAccumulated = pickFiniteNumber(
          data.radiationAccumulated,
          currentState.radiationAccumulated
        );

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

        const autoAlerts = evaluateTelemetry(nextBio, nextEnv);
        const fullAlerts: ClinicalAlerts = {
          isEmergency: currentState.isEmergency,
          ...autoAlerts,
        };

        const bloodChanged =
          nextBio.cistatinaC !== currentState.cistatinaC ||
          nextBio.creatinina !== currentState.creatinina ||
          nextBio.calcioIonico !== currentState.calcioIonico ||
          nextBio.linfocitos !== currentState.linfocitos ||
          nextBio.neutrofilos !== currentState.neutrofilos ||
          nextBio.cortisol !== currentState.cortisol;

        const bpChanged =
          nextBio.systolicMmHg !== currentState.systolicMmHg ||
          nextBio.diastolicMmHg !== currentState.diastolicMmHg;

        const glucoseChanged =
          nextBio.glucoseMgDl !== currentState.glucoseMgDl ||
          nextBio.glucoseContext !== currentState.glucoseContext;

        const tempChanged = nextBio.bodyTempC !== currentState.bodyTempC;

        const nextMeta: Partial<Record<TrackedIndicatorKey, IndicatorMeta>> = {
          ...currentState.indicatorMeta,
          vitals: { measuredAt: nowIso, source: 'sensor' },
          radiation: { measuredAt: nowIso, source: 'sensor' },
          bloodPanel:
            bloodChanged || !currentState.indicatorMeta?.bloodPanel
              ? { measuredAt: nowIso, source: 'sensor' }
              : currentState.indicatorMeta.bloodPanel,
        };
        if (bpChanged || (nextBio.systolicMmHg !== undefined && !currentState.indicatorMeta?.bp)) {
          nextMeta.bp = { measuredAt: nowIso, source: 'sensor' };
        }
        if (
          glucoseChanged ||
          (nextBio.glucoseMgDl !== undefined && !currentState.indicatorMeta?.glucose)
        ) {
          nextMeta.glucose = { measuredAt: nowIso, source: 'sensor' };
        }
        if (tempChanged || (nextBio.bodyTempC !== undefined && !currentState.indicatorMeta?.temp)) {
          nextMeta.temp = { measuredAt: nowIso, source: 'sensor' };
        }

        const escalationLevel = deriveEscalationLevel({
          alerts: fullAlerts,
          biomarkers: nextBio,
          behavioralCheckIn: currentState.behavioralCheckIn,
        });

        set({
          ...nextBio,
          ...nextEnv,
          ...autoAlerts,
          measuredAt: nowIso,
          source: 'sensor',
          indicatorMeta: nextMeta,
          escalationLevel,
        });
      },

      logManualVitals: (patch: ManualVitalsPatch) => {
        const currentState = get();
        const ts = sanitizeTimestamp(patch.measuredAt);

        const nextBio: Biomarkers = {
          heartRate: pickBoundedNumber(patch.heartRate, currentState.heartRate, 25, 240) ?? currentState.heartRate,
          spO2: pickBoundedNumber(patch.spO2, currentState.spO2, 50, 100) ?? currentState.spO2,
          cistatinaC:
            pickBoundedNumber(patch.cistatinaC, currentState.cistatinaC, 0.3, 10) ??
            currentState.cistatinaC,
          creatinina:
            pickBoundedNumber(patch.creatinina, currentState.creatinina, 0.2, 15) ??
            currentState.creatinina,
          calcioIonico:
            pickBoundedNumber(patch.calcioIonico, currentState.calcioIonico, 0.5, 3) ??
            currentState.calcioIonico,
          linfocitos:
            pickBoundedNumber(patch.linfocitos, currentState.linfocitos, 100, 15000) ??
            currentState.linfocitos,
          neutrofilos:
            pickBoundedNumber(patch.neutrofilos, currentState.neutrofilos, 200, 25000) ??
            currentState.neutrofilos,
          cortisol:
            pickBoundedNumber(patch.cortisol, currentState.cortisol, 1, 120) ??
            currentState.cortisol,
          systolicMmHg: pickBoundedNumber(patch.systolicMmHg, currentState.systolicMmHg, 50, 260),
          diastolicMmHg: pickBoundedNumber(patch.diastolicMmHg, currentState.diastolicMmHg, 30, 160),
          glucoseMgDl: pickBoundedNumber(patch.glucoseMgDl, currentState.glucoseMgDl, 20, 600),
          glucoseContext: patch.glucoseContext ?? currentState.glucoseContext ?? 'fasting',
          bodyTempC: pickBoundedNumber(patch.bodyTempC, currentState.bodyTempC, 32, 43),
          ctxNtxIndex: pickBoundedNumber(patch.ctxNtxIndex, currentState.ctxNtxIndex, 0.2, 6),
          p1npIndex: pickBoundedNumber(patch.p1npIndex, currentState.p1npIndex, 0.2, 5),
          aredLoadPct: pickBoundedNumber(patch.aredLoadPct, currentState.aredLoadPct, 0, 150),
          hrvRmssdMs: pickBoundedNumber(patch.hrvRmssdMs, currentState.hrvRmssdMs, 5, 200),
          orthostaticDeltaHr: pickBoundedNumber(
            patch.orthostaticDeltaHr,
            currentState.orthostaticDeltaHr,
            -20,
            80
          ),
          orthostaticDeltaSys: pickBoundedNumber(
            patch.orthostaticDeltaSys,
            currentState.orthostaticDeltaSys,
            -70,
            40
          ),
        };

        const nextEnv: Environment = {
          co2Level: currentState.co2Level,
          radiationRate: currentState.radiationRate,
          radiationAccumulated: currentState.radiationAccumulated,
        };

        const autoAlerts = evaluateTelemetry(nextBio, nextEnv);
        const fullAlerts: ClinicalAlerts = {
          isEmergency: currentState.isEmergency,
          ...autoAlerts,
        };

        const nextMeta: Partial<Record<TrackedIndicatorKey, IndicatorMeta>> = {
          ...currentState.indicatorMeta,
        };
        if (patch.systolicMmHg !== undefined || patch.diastolicMmHg !== undefined) {
          nextMeta.bp = { measuredAt: ts, source: 'manual' };
        }
        if (patch.glucoseMgDl !== undefined || patch.glucoseContext !== undefined) {
          nextMeta.glucose = { measuredAt: ts, source: 'manual' };
        }
        if (patch.bodyTempC !== undefined) {
          nextMeta.temp = { measuredAt: ts, source: 'manual' };
        }
        if (patch.heartRate !== undefined || patch.spO2 !== undefined) {
          nextMeta.vitals = { measuredAt: ts, source: 'manual' };
        }
        if (
          patch.cistatinaC !== undefined ||
          patch.creatinina !== undefined ||
          patch.calcioIonico !== undefined ||
          patch.linfocitos !== undefined ||
          patch.neutrofilos !== undefined ||
          patch.cortisol !== undefined
        ) {
          nextMeta.bloodPanel = { measuredAt: ts, source: 'manual' };
        }

        const escalationLevel = deriveEscalationLevel({
          alerts: fullAlerts,
          biomarkers: nextBio,
          behavioralCheckIn: currentState.behavioralCheckIn,
        });

        set({
          ...nextBio,
          ...autoAlerts,
          measuredAt: ts,
          source: 'manual',
          indicatorMeta: nextMeta,
          escalationLevel,
        });
      },

      submitBehavioralCheckIn: (input: BehavioralCheckInInput) => {
        const currentState = get();
        const ts = sanitizeTimestamp(input.updatedAt);
        const behavioralRiskIndex = computeBehavioralRiskIndex(input);

        const nextCheckIn: BehavioralCheckInData = {
          mood: input.mood,
          sleepQuality: input.sleepQuality,
          fatigue: input.fatigue,
          stress: input.stress,
          workload: input.workload,
          socialContact: input.socialContact,
          phq2Anhedonia: input.phq2Anhedonia,
          phq2Dysphoria: input.phq2Dysphoria,
          selfHarmFlag: input.selfHarmFlag,
          behavioralRiskIndex,
          sharePsychWithAi: input.sharePsychWithAi,
          updatedAt: ts,
        };

        const nextMeta: Partial<Record<TrackedIndicatorKey, IndicatorMeta>> = {
          ...currentState.indicatorMeta,
          behavioral: { measuredAt: ts, source: 'manual' },
        };

        const escalationLevel = deriveEscalationLevel({
          alerts: {
            isEmergency: currentState.isEmergency,
            isRenalWarning: currentState.isRenalWarning,
            isRadiationWarning: currentState.isRadiationWarning,
            isCo2Warning: currentState.isCo2Warning,
          },
          biomarkers: {
            heartRate: currentState.heartRate,
            spO2: currentState.spO2,
            cistatinaC: currentState.cistatinaC,
            creatinina: currentState.creatinina,
            calcioIonico: currentState.calcioIonico,
            linfocitos: currentState.linfocitos,
            neutrofilos: currentState.neutrofilos,
            cortisol: currentState.cortisol,
            systolicMmHg: currentState.systolicMmHg,
            diastolicMmHg: currentState.diastolicMmHg,
            glucoseMgDl: currentState.glucoseMgDl,
            glucoseContext: currentState.glucoseContext,
            bodyTempC: currentState.bodyTempC,
          },
          behavioralCheckIn: nextCheckIn,
        });

        set({
          behavioralCheckIn: nextCheckIn,
          sharePsychWithAi: input.sharePsychWithAi,
          indicatorMeta: nextMeta,
          escalationLevel,
        });
      },

      setSharePsychWithAi: (share: boolean) => {
        const currentState = get();
        set({
          sharePsychWithAi: share,
          behavioralCheckIn: currentState.behavioralCheckIn
            ? { ...currentState.behavioralCheckIn, sharePsychWithAi: share }
            : undefined,
        });
      },

      setSimulateOffline: (offline: boolean) => {
        set({ simulateOffline: Boolean(offline) });
      },

      triggerCodeRed: () => {
        set({
          isEmergency: true,
          isManualOverride: true,
          escalationLevel: 'emergency',
        });
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
        const nowIso = new Date().toISOString();
        let scenarioOverrides: Partial<Biomarkers & Environment> = {};

        switch (scenario) {
          case 'CO2_LEAK':
            scenarioOverrides = { co2Level: 4200 };
            break;
          case 'SOLAR_STORM':
            scenarioOverrides = {
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
          case 'BONE_LOSS':
            scenarioOverrides = {
              ctxNtxIndex: 1.68,
              p1npIndex: 0.72,
              aredLoadPct: 48,
              calcioIonico: 1.32,
            };
            break;
          case 'CARDIO_DECONDITIONING':
            scenarioOverrides = {
              heartRate: 98,
              hrvRmssdMs: 18,
              orthostaticDeltaHr: 32,
              orthostaticDeltaSys: -24,
              systolicMmHg: 96,
              diastolicMmHg: 62,
            };
            break;
        }

        const nextBio: Biomarkers = {
          heartRate: scenarioOverrides.heartRate ?? currentState.heartRate,
          spO2: scenarioOverrides.spO2 ?? currentState.spO2,
          cistatinaC: scenarioOverrides.cistatinaC ?? currentState.cistatinaC,
          creatinina: scenarioOverrides.creatinina ?? currentState.creatinina,
          calcioIonico: scenarioOverrides.calcioIonico ?? currentState.calcioIonico,
          linfocitos: scenarioOverrides.linfocitos ?? currentState.linfocitos,
          neutrofilos: scenarioOverrides.neutrofilos ?? currentState.neutrofilos,
          cortisol: scenarioOverrides.cortisol ?? currentState.cortisol,
          systolicMmHg: scenarioOverrides.systolicMmHg ?? currentState.systolicMmHg,
          diastolicMmHg: scenarioOverrides.diastolicMmHg ?? currentState.diastolicMmHg,
          glucoseMgDl: currentState.glucoseMgDl,
          glucoseContext: currentState.glucoseContext,
          bodyTempC: currentState.bodyTempC,
          ctxNtxIndex: scenarioOverrides.ctxNtxIndex ?? currentState.ctxNtxIndex,
          p1npIndex: scenarioOverrides.p1npIndex ?? currentState.p1npIndex,
          aredLoadPct: scenarioOverrides.aredLoadPct ?? currentState.aredLoadPct,
          hrvRmssdMs: scenarioOverrides.hrvRmssdMs ?? currentState.hrvRmssdMs,
          orthostaticDeltaHr:
            scenarioOverrides.orthostaticDeltaHr ?? currentState.orthostaticDeltaHr,
          orthostaticDeltaSys:
            scenarioOverrides.orthostaticDeltaSys ?? currentState.orthostaticDeltaSys,
        };

        const nextEnv: Environment = {
          co2Level: scenarioOverrides.co2Level ?? currentState.co2Level,
          radiationRate: scenarioOverrides.radiationRate ?? currentState.radiationRate,
          radiationAccumulated:
            scenarioOverrides.radiationAccumulated ?? currentState.radiationAccumulated,
        };

        const autoAlerts = evaluateTelemetry(nextBio, nextEnv);
        const escalationLevel = deriveEscalationLevel({
          alerts: { isEmergency: currentState.isEmergency, ...autoAlerts },
          biomarkers: nextBio,
          behavioralCheckIn: currentState.behavioralCheckIn,
        });

        set({
          ...nextBio,
          ...nextEnv,
          ...autoAlerts,
          isManualOverride: true,
          measuredAt: nowIso,
          source: 'sensor',
          escalationLevel,
        });
      },
    }),
    {
      name: 'exovitals-core-storage',
      version: 3,
      skipHydration: true,
      storage: createJSONStorage(createThrottledBrowserStorage),
      migrate: (persistedState: unknown) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return { ...initialState };
        }
        return {
          ...initialState,
          ...(persistedState as Record<string, unknown>),
        };
      },
    }
  )
);
