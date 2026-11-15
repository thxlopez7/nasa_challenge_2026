import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TelemetryData } from '../types/telemetry';
import type {
  DayKey,
  DayRecord,
  EvaluationSession,
  EvaluationStepId,
  Mission,
  MissionProfileId,
  PauseReason,
  SelfReport,
} from '../types/mission';
import {
  EVALUATION_STEPS,
  FULL_DAY_BONUS,
  HYDRATION_TARGET,
  dateOfMissionDay,
  getProfile,
  missionDayOf,
  phaseOfDay,
  stepIndexOf,
  totalDays,
} from '../utils/missionPlan';
import { generateDemoHistory, type DemoTrajectory } from '../utils/demoHistory';

interface MissionData {
  mission: Mission | null;
  records: Record<DayKey, DayRecord>;
  session: EvaluationSession | null;
}

/** Misiones guardadas por destino, para cambiar de Luna a Marte sin perder nada. */
type Shelf = Partial<Record<MissionProfileId, MissionData>>;

/** Todo lo de un tripulante: su misión actual y las de otros destinos. */
interface CrewData extends MissionData {
  shelf: Shelf;
}

interface MissionActions {
  /** Cambia de tripulante: guarda lo suyo y carga lo del perfil elegido. */
  switchCrew: (crewId: string) => void;
  /**
   * Cambia de destino: guarda la misión actual en su estante y recupera la
   * del destino elegido (o deja la preparación vacía si aún no existe).
   */
  selectProfile: (profileId: MissionProfileId) => void;
  startMission: (profileId: MissionProfileId, today: DayKey) => void;
  abortMission: (today: DayKey) => void;
  resetAll: () => void;
  loadDemoHistory: (today: DayKey, profileId?: MissionProfileId, trajectory?: DemoTrajectory) => void;
  /** Cierra sesiones de días anteriores y detecta el fin de la misión */
  syncDay: (today: DayKey) => void;

  startEvaluation: (today: DayKey) => void;
  submitCheckIn: (report: SelfReport) => void;
  captureVitals: (vitals: TelemetryData) => void;
  completeStep: (id: EvaluationStepId) => void;
  skipStep: (id: EvaluationStepId) => void;
  logHydration: () => void;
  goToStep: (id: EvaluationStepId) => void;
  pause: (reason: PauseReason) => void;
  resume: () => void;
  finishDay: () => void;
  closeAsExcused: () => void;
}

export type MissionState = MissionData & {
  shelf: Shelf;
  /** Tripulante dueño de los datos cargados */
  crewId: string | null;
  /** Datos de los demás tripulantes */
  crews: Record<string, CrewData>;
} & MissionActions;

const emptyData: MissionData = { mission: null, records: {}, session: null };

const xpForStep = (id: EvaluationStepId): number =>
  EVALUATION_STEPS[stepIndexOf(id)].xp;

/** Siguiente paso pendiente (ni completado ni omitido) a partir de `from`. */
function nextPendingIndex(session: EvaluationSession, from: number): number {
  const handled = new Set([...session.completedSteps, ...session.skippedSteps]);
  for (let i = from; i < EVALUATION_STEPS.length; i++) {
    if (!handled.has(EVALUATION_STEPS[i].id)) return i;
  }
  return EVALUATION_STEPS.length - 1;
}

function sessionToRecord(
  mission: Mission,
  session: EvaluationSession,
  status: DayRecord['status'],
  bonus: number
): DayRecord {
  const missionDay = missionDayOf(mission, session.date);
  return {
    date: session.date,
    missionDay,
    phaseId: phaseOfDay(getProfile(mission.profileId), missionDay).phase.id,
    status,
    completedSteps: session.completedSteps,
    skippedSteps: session.skippedSteps,
    selfReport: session.selfReport,
    vitals: session.vitals,
    xp: session.xp + bonus,
    pauses: session.pauses,
  };
}

/** Si ese día era el último de la misión, la marca como cumplida. */
function endIfLastDay(mission: Mission, date: DayKey): Mission {
  const total = totalDays(getProfile(mission.profileId));
  return missionDayOf(mission, date) >= total && !mission.endedOn
    ? { ...mission, endedOn: date }
    : mission;
}

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      ...emptyData,
      shelf: {},
      crewId: null,
      crews: {},

      switchCrew: (crewId) => {
        const { crewId: current, mission, records, session, shelf, crews } = get();
        if (current === crewId) return;
        const next = { ...crews };
        // Los datos sin dueño (de antes de existir perfiles) se quedan con el primero.
        if (current) next[current] = { mission, records, session, shelf };
        const restored: CrewData =
          next[crewId] ?? (current ? { ...emptyData, shelf: {} } : { mission, records, session, shelf });
        delete next[crewId];
        set({ ...restored, crewId, crews: next });
      },

      selectProfile: (profileId) => {
        const { mission, records, session, shelf } = get();
        if (mission?.profileId === profileId) return;
        const next: Shelf = { ...shelf };
        if (mission) next[mission.profileId] = { mission, records, session };
        const restored = next[profileId] ?? emptyData;
        delete next[profileId];
        set({ ...restored, shelf: next });
      },

      startMission: (profileId, today) =>
        set({ mission: { profileId, startDate: today }, records: {}, session: null }),

      abortMission: (today) => {
        const { mission } = get();
        if (!mission) return;
        set({ mission: { ...mission, endedOn: today, aborted: true }, session: null });
      },

      resetAll: () => set({ ...emptyData }),

      loadDemoHistory: (today, profileId, trajectory) => {
        const { mission, records } = generateDemoHistory(today, profileId, trajectory);
        set({ mission, records, session: null });
      },

      syncDay: (today) => {
        const { mission, session, records } = get();
        if (!mission || mission.endedOn) return;

        let nextMission = mission;
        let nextRecords = records;
        let nextSession = session;

        // Una evaluación de un día anterior se cierra tal como quedó.
        if (session && session.date !== today) {
          const medical =
            session.status === 'PAUSED' && session.pauseReason !== 'USER';
          const status = medical ? 'EXCUSED' : 'PARTIAL';
          if (session.completedSteps.length > 0 || medical) {
            nextRecords = {
              ...records,
              [session.date]: sessionToRecord(mission, session, status, 0),
            };
          }
          nextSession = null;
          nextMission = endIfLastDay(mission, session.date);
        }

        // Si ya pasó el último día, la misión terminó.
        const total = totalDays(getProfile(mission.profileId));
        if (!nextMission.endedOn && missionDayOf(mission, today) > total) {
          nextMission = { ...nextMission, endedOn: dateOfMissionDay(mission, total) };
        }

        if (
          nextMission !== mission ||
          nextRecords !== records ||
          nextSession !== session
        ) {
          set({ mission: nextMission, records: nextRecords, session: nextSession });
        }
      },

      startEvaluation: (today) => {
        const { mission, session, records } = get();
        if (!mission || mission.endedOn || session || records[today]) return;
        const day = missionDayOf(mission, today);
        if (day < 1 || day > totalDays(getProfile(mission.profileId))) return;
        set({
          session: {
            date: today,
            stepIndex: 0,
            status: 'ACTIVE',
            completedSteps: [],
            skippedSteps: [],
            pauses: 0,
            hydrationCount: 0,
            xp: 0,
          },
        });
      },

      submitCheckIn: (report) => {
        const { session } = get();
        if (!session) return;
        set({ session: { ...session, selfReport: report } });
        get().completeStep('CHECK_IN');
      },

      captureVitals: (vitals) => {
        const { session } = get();
        if (!session) return;
        set({ session: { ...session, vitals } });
        get().completeStep('VITALS');
      },

      completeStep: (id) => {
        const { session } = get();
        if (!session || session.completedSteps.includes(id)) return;
        const updated: EvaluationSession = {
          ...session,
          completedSteps: [...session.completedSteps, id],
          skippedSteps: session.skippedSteps.filter((s) => s !== id),
          xp: session.xp + xpForStep(id),
        };
        set({
          session: {
            ...updated,
            stepIndex: nextPendingIndex(updated, stepIndexOf(id) + 1),
          },
        });
      },

      skipStep: (id) => {
        const { session } = get();
        const def = EVALUATION_STEPS[stepIndexOf(id)];
        if (!session || !def.skippable || session.completedSteps.includes(id)) return;
        const updated: EvaluationSession = {
          ...session,
          skippedSteps: session.skippedSteps.includes(id)
            ? session.skippedSteps
            : [...session.skippedSteps, id],
        };
        set({
          session: {
            ...updated,
            stepIndex: nextPendingIndex(updated, stepIndexOf(id) + 1),
          },
        });
      },

      logHydration: () => {
        const { session } = get();
        if (!session || session.completedSteps.includes('HYDRATION')) return;
        const count = Math.min(HYDRATION_TARGET, session.hydrationCount + 1);
        set({ session: { ...session, hydrationCount: count } });
        if (count >= HYDRATION_TARGET) get().completeStep('HYDRATION');
      },

      goToStep: (id) => {
        const { session } = get();
        if (!session || session.status !== 'ACTIVE') return;
        set({ session: { ...session, stepIndex: stepIndexOf(id) } });
      },

      pause: (reason) => {
        const { session } = get();
        if (!session || session.status === 'PAUSED') return;
        set({
          session: {
            ...session,
            status: 'PAUSED',
            pauseReason: reason,
            pausedAt: new Date().toISOString(),
            pauses: session.pauses + 1,
          },
        });
      },

      resume: () => {
        const { session } = get();
        if (!session || session.status !== 'PAUSED') return;
        set({
          session: {
            ...session,
            status: 'ACTIVE',
            pauseReason: undefined,
            pausedAt: undefined,
          },
        });
      },

      finishDay: () => {
        const { mission, session, records } = get();
        if (!mission || !session) return;
        const required = EVALUATION_STEPS.filter((s) => s.id !== 'DEBRIEF');
        const complete = required.every((s) => session.completedSteps.includes(s.id));
        const record = sessionToRecord(
          mission,
          { ...session, completedSteps: [...session.completedSteps, 'DEBRIEF'] },
          complete ? 'COMPLETE' : 'PARTIAL',
          complete ? FULL_DAY_BONUS : 0
        );
        set({
          records: { ...records, [session.date]: record },
          session: null,
          mission: endIfLastDay(mission, session.date),
        });
      },

      closeAsExcused: () => {
        const { mission, session, records } = get();
        if (!mission || !session) return;
        set({
          records: {
            ...records,
            [session.date]: sessionToRecord(mission, session, 'EXCUSED', 0),
          },
          session: null,
          mission: endIfLastDay(mission, session.date),
        });
      },
    }),
    {
      name: 'exovitals-mission-storage',
      // `window` sólo existe en el navegador (ver useTelemetryStore).
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: ({ mission, records, session, shelf, crewId, crews }) => ({
        mission,
        records,
        session,
        shelf,
        crewId,
        crews,
      }),
    }
  )
);

/** XP total: registros cerrados + lo ganado hoy en la sesión abierta. */
export const selectTotalXp = (s: MissionState): number =>
  Object.values(s.records).reduce((sum, r) => sum + r.xp, 0) +
  (s.session?.xp ?? 0);
