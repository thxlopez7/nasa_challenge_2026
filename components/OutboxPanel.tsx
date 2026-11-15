'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Radio,
  Send,
  Sun,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { formatOneWayLatency } from '../config/missionComms';
import { useT } from '../i18n/I18nContext';
import { useClinicalSnapshot } from '../store/selectors';
import {
  type OutboxPacketStatus,
  type OutboxSpeedup,
  useOutboxStore,
} from '../store/useOutboxStore';
import type { MissionSlug } from '../utils/missionChoice';
import SbarReportModal from './SbarReportModal';

function subscribeOnlineStatus(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, sec);
  if (s < 10) return `${s.toFixed(1)} s`;
  if (s < 60) return `${Math.round(s)} s`;
  const mins = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${mins}m ${String(rem).padStart(2, '0')}s`;
}

export function OutboxPanel({ mision }: { mision?: MissionSlug }) {
  const { lang } = useT();
  const snapshot = useClinicalSnapshot(mision);
  const packets = useOutboxStore((s) => s.packets);
  const speedup = useOutboxStore((s) => s.speedup);
  const conjunctionBlackout = useOutboxStore((s) => s.conjunctionBlackout);
  const setSpeedup = useOutboxStore((s) => s.setSpeedup);
  const setConjunctionBlackout = useOutboxStore((s) => s.setConjunctionBlackout);
  const enqueuePacket = useOutboxStore((s) => s.enqueuePacket);
  const processQueue = useOutboxStore((s) => s.processQueue);
  const clearDelivered = useOutboxStore((s) => s.clearDelivered);

  const [sbarOpen, setSbarOpen] = useState(false);

  const navigatorOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    () => true
  );
  const isOffline = !navigatorOnline || snapshot.simulateOffline;

  const hasActivePackets = packets.some(
    (p) => p.status !== 'delivered' && p.status !== 'failed'
  );

  useEffect(() => {
    if (!hasActivePackets) return;
    const id = window.setInterval(() => {
      processQueue(Date.now(), isOffline);
    }, 500);
    return () => window.clearInterval(id);
  }, [hasActivePackets, isOffline, processQueue]);

  const handleQueueTelemetry = () => {
    enqueuePacket({
      kind: 'TELEMETRY_SNAPSHOT',
      title:
        lang === 'es'
          ? `Paquete Telemetría · ${snapshot.globalSeverity}`
          : `Telemetry Packet · ${snapshot.globalSeverity}`,
      missionProfileId: snapshot.missionProfileId,
      priority: snapshot.globalSeverity === 'CRITICAL' ? 'emergency' : 'routine',
      payload: {
        biomarkers: snapshot.biomarkers,
        environment: snapshot.environment,
        alerts: snapshot.alerts,
      },
    });
  };

  const statusMeta: Record<
    OutboxPacketStatus,
    { label: string; badge: string }
  > = {
    queued: {
      label: lang === 'es' ? 'En cola local (offline)' : 'Queued locally (offline)',
      badge: 'border-amber-500/50 bg-amber-500/15 text-amber-200',
    },
    in_flight: {
      label: lang === 'es' ? 'En tránsito espacio–Tierra' : 'In transit Space–Earth',
      badge: 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200',
    },
    held_conjunction: {
      label: lang === 'es' ? 'Retenido (conjunción solar)' : 'Held (solar conjunction)',
      badge: 'border-orange-500/60 bg-orange-500/15 text-orange-200',
    },
    delivered: {
      label: lang === 'es' ? 'Entregado a Tierra' : 'Delivered to Earth',
      badge: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200',
    },
    failed: {
      label: lang === 'es' ? 'Fallo de enlace' : 'Link error',
      badge: 'border-red-500/60 bg-red-500/15 text-red-200',
    },
  };

  const copy =
    lang === 'es'
      ? {
          eyebrow: 'COMUNICACIONES ASINCRÓNICAS (D · DISTANCIA)',
          title: 'Outbox Tierra–Nave (IndexedDB) y SBAR',
          latency: 'Latencia unidireccional',
          offlineTag: 'ENLACE CAÍDO / OFFLINE (se almacena localmente)',
          onlineTag: 'Enlace activo con retardo físico simulado',
          conjunctionBtn: 'Conjunción solar (retención ~14d)',
          speedLabel: 'Velocidad demo',
          sbarBtn: 'Generar SBAR (1 pág.)',
          snapshotBtn: 'Encolar paquete vital',
          clearBtn: 'Limpiar entregados',
          empty:
            'No hay paquetes en cola. Genera un SBAR o encola telemetría incluso sin conexión.',
          remaining: 'ETA Tierra',
        }
      : {
          eyebrow: 'ASYNCHRONOUS COMMS (D · DISTANCE)',
          title: 'Earth–Spacecraft Outbox (IndexedDB) & SBAR',
          latency: 'One-way delay',
          offlineTag: 'LINK DOWN / OFFLINE (buffering locally)',
          onlineTag: 'Active link with physical speed-of-light delay',
          conjunctionBtn: 'Solar Conjunction Hold (~14d blackout)',
          speedLabel: 'Demo speedup',
          sbarBtn: 'Generate 1-Page SBAR',
          snapshotBtn: 'Queue Vital Snapshot',
          clearBtn: 'Clear delivered',
          empty:
            'No queued packets. Generate a 1-page SBAR or queue telemetry seamlessly even offline.',
          remaining: 'Earth ETA',
        };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-cyan-400">
            {copy.eyebrow}
          </p>
          <h2 className="text-lg font-bold text-slate-100 mt-0.5 flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400 shrink-0" aria-hidden="true" />
            <span>{copy.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {copy.latency}:{' '}
            <strong className="text-slate-200">
              {formatOneWayLatency(snapshot.missionProfileId, lang)}
            </strong>
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border shrink-0 ${
            isOffline
              ? 'border-amber-500/70 bg-amber-500/15 text-amber-200'
              : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {isOffline ? (
            <WifiOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{isOffline ? copy.offlineTag : copy.onlineTag}</span>
        </span>
      </div>

      {/* Controles de simulación y acciones SBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 rounded-lg p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSbarOpen(true)}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>{copy.sbarBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleQueueTelemetry}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold cursor-pointer"
          >
            <Send className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            <span>{copy.snapshotBtn}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setConjunctionBlackout(!conjunctionBlackout)}
            aria-pressed={conjunctionBlackout}
            className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              conjunctionBlackout
                ? 'border-orange-500 bg-orange-500/20 text-orange-200'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Sun className="w-4 h-4" aria-hidden="true" />
            <span>{copy.conjunctionBtn}</span>
          </button>

          <div
            className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 p-1"
            role="group"
            aria-label={copy.speedLabel}
          >
            {([1, 60, 600] as OutboxSpeedup[]).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeedup(spd)}
                className={`min-h-[36px] px-2.5 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer ${
                  speedup === spd
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                ×{spd}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de paquetes en IndexedDB */}
      {packets.length === 0 ? (
        <p className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-800 rounded-lg">
          {copy.empty}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearDelivered}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{copy.clearBtn}</span>
            </button>
          </div>
          <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {packets.map((pkt) => {
              const meta = statusMeta[pkt.status];
              return (
                <li
                  key={pkt.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-100 truncate">
                        {pkt.title}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {pkt.missionProfileId}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pkt.status !== 'delivered' && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        {copy.remaining}: {formatDuration(pkt.remainingSec)}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <SbarReportModal
        open={sbarOpen}
        onClose={() => setSbarOpen(false)}
        mision={mision}
      />
    </section>
  );
}

export default OutboxPanel;
