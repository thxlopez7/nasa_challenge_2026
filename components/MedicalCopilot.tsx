'use client';

import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bot, RefreshCw, Send, ShieldCheck, Sparkles, WifiOff } from 'lucide-react';
import { AI_MODEL_LABEL } from '../config/ai';
import { useT } from '../i18n/I18nContext';
import { useClinicalSnapshot } from '../store/selectors';
import { useOutboxStore } from '../store/useOutboxStore';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { runLocalTriage, type LocalTriageReport } from '../utils/localTriage';
import type { MissionSlug } from '../utils/missionChoice';

export interface ChatMessage {
  role: 'user' | 'assistant';
  kind?: 'welcome' | 'local-triage' | 'ai-suggestion' | 'error';
  content: string;
  localReport?: LocalTriageReport;
}

const BACKOFF_DELAYS_MS = [800, 1600, 3200] as const;

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

function getOnlineState(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function MedicalCopilot({ mision }: { mision?: MissionSlug }) {
  const { t, lang } = useT();
  const snapshot = useClinicalSnapshot(mision);
  const enqueuePacket = useOutboxStore((s) => s.enqueuePacket);

  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [queuedNoticeId, setQueuedNoticeId] = useState<number | null>(null);

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const navigatorOnline = useSyncExternalStore(subscribeOnline, getOnlineState, () => true);
  const isOffline = !navigatorOnline || snapshot.simulateOffline;

  const missionDisplayName =
    snapshot.missionProfileId === 'LUNAR_ARTEMIS'
      ? lang === 'en'
        ? 'Moon (Artemis Base)'
        : 'Luna (Base Artemis)'
      : lang === 'en'
        ? 'Mars (Transit / Surface)'
        : 'Marte (Tránsito / Superficie)';

  const welcomeMessage: ChatMessage = {
    role: 'assistant',
    kind: 'welcome',
    content: t.copilot.welcome(missionDisplayName, snapshot.comms.commsMode[lang]),
  };

  const renderedMessages = [welcomeMessage, ...messages];

  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [renderedMessages.length, isLoading]);

  const queueQueryForEarth = (msgIdx: number, question: string) => {
    enqueuePacket({
      kind: 'CLINICAL_ALERT',
      title:
        lang === 'es'
          ? `Consulta Cirujano de Vuelo: "${question.slice(0, 42)}"`
          : `Flight Surgeon Query: "${question.slice(0, 42)}"`,
      missionProfileId: snapshot.missionProfileId,
      priority: snapshot.globalSeverity === 'CRITICAL' ? 'emergency' : 'priority',
      payload: {
        query: question,
        escalationLevel: snapshot.escalationLevel,
        measuredAt: snapshot.measuredAt,
      },
    });
    setQueuedNoticeId(msgIdx);
    window.setTimeout(() => setQueuedNoticeId(null), 2500);
  };

  const handleSend = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();

    const trimmedQuery = input.trim();
    if (!trimmedQuery || isLoading) return;

    const currentTelemetry = useTelemetryStore.getState();

    // 1. Evaluar Triaje Local Determinista de inmediato (< 1 ms, funciona offline)
    const localReport = runLocalTriage(
      {
        heartRate: currentTelemetry.heartRate,
        spO2: currentTelemetry.spO2,
        cistatinaC: currentTelemetry.cistatinaC,
        creatinina: currentTelemetry.creatinina,
        calcioIonico: currentTelemetry.calcioIonico,
        linfocitos: currentTelemetry.linfocitos,
        neutrofilos: currentTelemetry.neutrofilos,
        cortisol: currentTelemetry.cortisol,
        systolicMmHg: currentTelemetry.systolicMmHg,
        diastolicMmHg: currentTelemetry.diastolicMmHg,
        glucoseMgDl: currentTelemetry.glucoseMgDl,
        glucoseContext: currentTelemetry.glucoseContext,
        bodyTempC: currentTelemetry.bodyTempC,
        co2Level: currentTelemetry.co2Level,
        radiationRate: currentTelemetry.radiationRate,
        radiationAccumulated: currentTelemetry.radiationAccumulated,
        isEmergency: currentTelemetry.isEmergency,
        isRenalWarning: currentTelemetry.isRenalWarning,
        isRadiationWarning: currentTelemetry.isRadiationWarning,
        isCo2Warning: currentTelemetry.isCo2Warning,
        behavioralCheckIn: currentTelemetry.behavioralCheckIn,
      },
      snapshot.ruleTraces,
      lang,
      trimmedQuery
    );

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmedQuery,
    };

    const localMessage: ChatMessage = {
      role: 'assistant',
      kind: 'local-triage',
      content: localReport.headline,
      localReport,
    };

    setMessages((prev) => [...prev, userMessage, localMessage]);
    setInput('');

    // Si el enlace está simulado caído o el navegador está offline, no llamar al servidor IA
    if (isOffline) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          kind: 'error',
          content:
            lang === 'es'
              ? 'Enlace Tierra–Nave inactivo (modo offline): se aplicó el Triaje Local determinista de a bordo. Puedes encolar un reporte SBAR al Outbox.'
              : 'Earth–Spacecraft link offline: deterministic Onboard Local Triage executed. You may queue an SBAR report to the Earth Outbox.',
        },
      ]);
      return;
    }

    // 2. Complemento opcional por IA con backoff exponencial (1s -> 2s -> 4s aprox.)
    setIsLoading(true);
    setRetryStatus(null);

    try {
      let lastError = 'Error';

      for (let attempt = 0; attempt <= BACKOFF_DELAYS_MS.length; attempt += 1) {
        if (attempt > 0) {
          const delay = BACKOFF_DELAYS_MS[attempt - 1];
          setRetryStatus(
            lang === 'es'
              ? `Reintentando conexión (${attempt}/${BACKOFF_DELAYS_MS.length})…`
              : `Retrying connection (${attempt}/${BACKOFF_DELAYS_MS.length})…`
          );
          await sleep(delay);
        }

        try {
          const res = await fetch('/api/triage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: trimmedQuery,
              telemetry: currentTelemetry,
              missionProfileId: snapshot.missionProfileId,
              lang,
              simulateOffline: snapshot.simulateOffline,
            }),
          });

          const data = (await res.json()) as {
            response?: string;
            error?: string;
          };

          if (res.ok && data.response) {
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                kind: 'ai-suggestion',
                content: data.response ?? '',
              },
            ]);
            setRetryStatus(null);
            return;
          }

          lastError = data.error ?? `HTTP ${res.status}`;
          // Errores 4xx (salvo 429) no se reintentan
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            break;
          }
        } catch (err: unknown) {
          lastError =
            err instanceof Error ? err.message : 'Network error connecting /api/triage';
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          kind: 'error',
          content:
            lang === 'es'
              ? `IA no disponible (${lastError}). El Triaje Local determinista anterior sigue vigente.`
              : `AI advisor unavailable (${lastError}). Rely on the deterministic Onboard Local Triage above.`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setRetryStatus(null);
    }
  };

  return (
    <section
      aria-labelledby="copilot-title"
      className="flex flex-col h-[640px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Cabecera */}
      <div className="bg-slate-800/80 border-b border-slate-700 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="copilot-title" className="text-base font-bold text-cyan-400 uppercase tracking-wider">
            {t.copilot.title}
          </h2>
          <p className="text-[11px] text-slate-400">
            {t.copilot.subtitleModelPrefix}: {AI_MODEL_LABEL} · {t.copilot.subtitleLiveSuffix}
          </p>
        </div>

        <div
          className={`flex items-center gap-2 border px-3 py-1 rounded-full text-xs font-mono ${
            isOffline
              ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
              : 'bg-slate-950/60 border-slate-700 text-emerald-300'
          }`}
        >
          {isOffline ? (
            <WifiOff className="h-3.5 w-3.5 text-amber-300" aria-hidden />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
          )}
          <span>
            {isOffline
              ? lang === 'es'
                ? 'OFFLINE · Triaje local activo'
                : 'OFFLINE · Local Triage active'
              : `${t.copilot.commsBannerPrefix}: ${snapshot.comms.commsMode[lang]}`}
          </span>
        </div>
      </div>

      {/* Historial */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {renderedMessages.map((msg, index) => {
          const isUser = msg.role === 'user';

          if (msg.kind === 'local-triage' && msg.localReport) {
            const report = msg.localReport;
            return (
              <div key={`${index}-local`} className="flex justify-start">
                <div className="w-full rounded-xl px-4 py-3 text-xs leading-relaxed bg-cyan-950/35 border border-cyan-500/60 text-slate-100 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                      <ShieldCheck className="w-4 h-4" aria-hidden />
                      {lang === 'es'
                        ? 'Triaje Local Determinista (A Bordo)'
                        : 'Deterministic Onboard Local Triage'}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-200 uppercase">
                      {report.escalationLevel}
                    </span>
                  </div>

                  <p className="font-semibold text-slate-100">{report.headline}</p>

                  {report.immediateSteps.length > 0 && (
                    <ol className="list-decimal list-inside space-y-1 text-slate-200">
                      {report.immediateSteps.slice(0, 4).map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cyan-500/20">
                    <span className="text-[11px] text-cyan-200/80">
                      {report.protocols.map((p) => p.title).join(' · ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => queueQueryForEarth(index, report.sbarSummary.assessment)}
                      className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1 rounded-lg border border-cyan-400/50 bg-slate-900 hover:bg-slate-800 text-cyan-200 text-[11px] font-semibold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" aria-hidden />
                      {queuedNoticeId === index
                        ? lang === 'es'
                          ? 'Encolado en Outbox'
                          : 'Queued in Outbox'
                        : lang === 'es'
                          ? 'Enviar SBAR a Outbox'
                          : 'Send SBAR to Outbox'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          if (msg.kind === 'ai-suggestion') {
            return (
              <div key={`${index}-ai`} className="flex justify-start">
                <div className="max-w-[92%] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap bg-slate-800/90 border border-amber-500/50 text-slate-100 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300 border-b border-amber-500/25 pb-1.5">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden />
                    <span>
                      {lang === 'es'
                        ? 'Sugerencia de IA, no es una alerta'
                        : 'AI Suggestion — Not a Clinical Alert'}
                    </span>
                  </div>
                  <p>{msg.content}</p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`${index}-${msg.role}`}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-cyan-600 text-white rounded-br-none'
                    : msg.kind === 'error'
                      ? 'bg-amber-950/40 text-amber-100 border border-amber-500/50 rounded-bl-none'
                      : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                }`}
              >
                {!isUser && msg.kind === 'welcome' && (
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-300 uppercase mb-1">
                    <Bot className="w-3.5 h-3.5" aria-hidden />
                    <span>ExoVitals Triage</span>
                  </p>
                )}
                <p>{msg.content}</p>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 text-cyan-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden />
              <span>{retryStatus ?? t.copilot.sending}</span>
            </div>
          </div>
        )}
      </div>

      <p className="px-5 py-2 bg-slate-950/70 border-t border-slate-800 text-[11px] text-slate-400">
        {t.copilot.aiDisclaimer}
      </p>

      {/* Entrada */}
      <form
        onSubmit={handleSend}
        className="p-4 bg-slate-900/90 border-t border-slate-700 flex items-center gap-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.copilot.placeholder}
          aria-label={t.copilot.placeholder}
          disabled={isLoading}
          className="flex-1 min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="min-h-[44px] bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold text-sm px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          {t.copilot.send}
        </button>
      </form>
    </section>
  );
}

export default MedicalCopilot;
