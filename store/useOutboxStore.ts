import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { del, get as idbGet, set as idbSet } from 'idb-keyval';
import { getMissionComms } from '../config/missionComms';
import type { MissionProfileId } from '../types/mission';

export type OutboxPacketKind =
  | 'SBAR_REPORT'
  | 'CLINICAL_ALERT'
  | 'TELEMETRY_SNAPSHOT';

export type OutboxPacketStatus =
  | 'queued'
  | 'in_flight'
  | 'held_conjunction'
  | 'delivered'
  | 'failed';

export type OutboxSpeedup = 1 | 60 | 600;

export interface OutboxPacket {
  id: string;
  kind: OutboxPacketKind;
  title: string;
  missionProfileId: MissionProfileId;
  priority: 'routine' | 'priority' | 'emergency';
  payload: Record<string, unknown>;
  createdAtMs: number;
  oneWayLatencySec: number;
  remainingSec: number;
  deliveredAtMs?: number;
  status: OutboxPacketStatus;
  attempts: number;
  lastError?: string;
}

export interface EnqueueOutboxInput {
  id?: string;
  kind: OutboxPacketKind;
  title: string;
  missionProfileId: MissionProfileId;
  priority?: 'routine' | 'priority' | 'emergency';
  payload: Record<string, unknown>;
  nowMs?: number;
}

export interface AdvanceOutboxOptions {
  deltaRealSec: number;
  speedup: OutboxSpeedup;
  offline: boolean;
  conjunctionBlackout: boolean;
  nowMs: number;
}

/**
 * Función pura de avance del Outbox Tierra–Nave:
 * respeta latencia real (~1.3 s Luna, ~20 min Marte), retención por apagón
 * o conjunción solar, y multiplicador de demo (×1 / ×60 / ×600).
 */
export function advanceOutboxPackets(
  packets: OutboxPacket[],
  opts: AdvanceOutboxOptions
): OutboxPacket[] {
  const safeDelta = Number.isFinite(opts.deltaRealSec) && opts.deltaRealSec > 0
    ? Math.min(opts.deltaRealSec, 3600)
    : 0;
  const simDeltaSec = safeDelta * opts.speedup;

  return packets.map((pkt) => {
    if (pkt.status === 'delivered' || pkt.status === 'failed') {
      return pkt;
    }

    if (opts.offline) {
      return pkt.status === 'queued'
        ? pkt
        : { ...pkt, status: 'queued' };
    }

    if (opts.conjunctionBlackout) {
      return pkt.status === 'held_conjunction'
        ? pkt
        : { ...pkt, status: 'held_conjunction' };
    }

    const nextRemaining = Math.max(0, Number((pkt.remainingSec - simDeltaSec).toFixed(3)));
    if (nextRemaining <= 0) {
      return {
        ...pkt,
        remainingSec: 0,
        status: 'delivered',
        deliveredAtMs: opts.nowMs,
        attempts: pkt.attempts + 1,
      };
    }

    return {
      ...pkt,
      remainingSec: nextRemaining,
      status: 'in_flight',
    };
  });
}

function createIndexedDbStorage(): StateStorage {
  return {
    getItem: async (name: string): Promise<string | null> => {
      if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
        return null;
      }
      try {
        const value = await idbGet<string>(name);
        return typeof value === 'string' ? value : null;
      } catch {
        return null;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
        return;
      }
      try {
        await idbSet(name, value);
      } catch {
        // Silencioso en modos restringidos de almacenamiento
      }
    },
    removeItem: async (name: string): Promise<void> => {
      if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
        return;
      }
      try {
        await del(name);
      } catch {
        // Silencioso en modos restringidos
      }
    },
  };
}

export interface OutboxState {
  packets: OutboxPacket[];
  speedup: OutboxSpeedup;
  conjunctionBlackout: boolean;
  lastTickMs: number | null;
  enqueuePacket: (input: EnqueueOutboxInput) => OutboxPacket;
  processQueue: (nowMs: number, isOffline: boolean) => void;
  setSpeedup: (speedup: OutboxSpeedup) => void;
  setConjunctionBlackout: (active: boolean) => void;
  retryFailed: (id: string) => void;
  clearDelivered: () => void;
  resetOutbox: () => void;
}

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      packets: [],
      speedup: 1,
      conjunctionBlackout: false,
      lastTickMs: null,

      enqueuePacket: (input: EnqueueOutboxInput) => {
        const nowMs = input.nowMs ?? Date.now();
        const comms = getMissionComms(input.missionProfileId);
        const latencySec = comms.oneWayLatencyNominalSec;
        const packetId =
          input.id ??
          `pkt-${nowMs}-${Math.random().toString(36).slice(2, 7)}`;

        const nextPacket: OutboxPacket = {
          id: packetId,
          kind: input.kind,
          title: input.title,
          missionProfileId: input.missionProfileId,
          priority: input.priority ?? 'routine',
          payload: input.payload,
          createdAtMs: nowMs,
          oneWayLatencySec: latencySec,
          remainingSec: latencySec,
          status: get().conjunctionBlackout ? 'held_conjunction' : 'queued',
          attempts: 0,
        };

        set((state) => ({
          packets: [nextPacket, ...state.packets].slice(0, 50),
          lastTickMs: state.lastTickMs ?? nowMs,
        }));

        return nextPacket;
      },

      processQueue: (nowMs: number, isOffline: boolean) => {
        const state = get();
        if (state.packets.length === 0) {
          if (state.lastTickMs !== null) set({ lastTickMs: null });
          return;
        }

        const prevMs = state.lastTickMs ?? nowMs;
        const deltaRealSec = Math.max(0, (nowMs - prevMs) / 1000);
        const nextPackets = advanceOutboxPackets(state.packets, {
          deltaRealSec,
          speedup: state.speedup,
          offline: isOffline,
          conjunctionBlackout: state.conjunctionBlackout,
          nowMs,
        });

        set({
          packets: nextPackets,
          lastTickMs: nowMs,
        });
      },

      setSpeedup: (speedup: OutboxSpeedup) => {
        set({ speedup });
      },

      setConjunctionBlackout: (active: boolean) => {
        set({ conjunctionBlackout: Boolean(active) });
      },

      retryFailed: (id: string) => {
        set((state) => ({
          packets: state.packets.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: state.conjunctionBlackout
                    ? 'held_conjunction'
                    : 'queued',
                  remainingSec: p.oneWayLatencySec,
                  lastError: undefined,
                }
              : p
          ),
        }));
      },

      clearDelivered: () => {
        set((state) => ({
          packets: state.packets.filter((p) => p.status !== 'delivered'),
        }));
      },

      resetOutbox: () => {
        set({
          packets: [],
          speedup: 1,
          conjunctionBlackout: false,
          lastTickMs: null,
        });
      },
    }),
    {
      name: 'exovitals-earth-outbox-v1',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(createIndexedDbStorage),
      partialize: (state) => ({
        packets: state.packets,
        speedup: state.speedup,
        conjunctionBlackout: state.conjunctionBlackout,
      }),
    }
  )
);
