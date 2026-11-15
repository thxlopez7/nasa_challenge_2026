'use client';

import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bot, RefreshCw, Send, ShieldCheck, Sparkles, WifiOff } from 'lucide-react';
import { AI_MODEL_LABEL } from '../config/ai';
import type { SupportedLang } from '../config/missionComms';
import type { RuleEvaluationTrace } from '../config/rules';
import { useT } from '../i18n/I18nContext';
import { useClinicalSnapshot } from '../store/selectors';
import { useOutboxStore } from '../store/useOutboxStore';
import { useTelemetryStore } from '../store/useTelemetryStore';
import type { TelemetryData } from '../types/telemetry';
import { runLocalTriage, type LocalTriageReport } from '../utils/localTriage';
import type { MissionSlug } from '../utils/missionChoice';

export interface ChatMessage {
  role: 'user' | 'assistant';
  kind?: 'welcome' | 'local-triage' | 'ai-suggestion' | 'error';
  content: string;
  query?: string;
  telemetrySnapshot?: Partial<TelemetryData>;
  ruleTracesSnapshot?: RuleEvaluationTrace[];
  localReport?: LocalTriageReport;
  aiLocale?: SupportedLang;
  errorKind?: 'offline' | 'api';
  errorDetail?: string;
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

function pickTelemetryForTriage(): Partial<TelemetryData> {
  const s = useTelemetryStore.getState();
  return {
    heartRate: s.heartRate,
    spO2: s.spO2,
    cistatinaC: s.cistatinaC,
    creatinina: s.creatinina,
    calcioIonico: s.calcioIonico,
    linfocitos: s.linfocitos,
    neutrofilos: s.neutrofilos,
    cortisol: s.cortisol,
    systolicMmHg: s.systolicMmHg,
    diastolicMmHg: s.diastolicMmHg,
    glucoseMgDl: s.glucoseMgDl,
    glucoseContext: s.glucoseContext,
    bodyTempC: s.bodyTempC,
    co2Level: s.co2Level,
    radiationRate: s.radiationRate,
    radiationAccumulated: s.radiationAccumulated,
    isEmergency: s.isEmergency,
    isRenalWarning: s.isRenalWarning,
    isRadiationWarning: s.isRadiationWarning,
    isCo2Warning: s.isCo2Warning,
    behavioralCheckIn: s.behavioralCheckIn,
  };
}

export function MedicalCopilot({
  mision,
  compactHeight,
}: {
  mision?: MissionSlug;
  compactHeight?: boolean;
}) {
  const { t, lang } = useT();
  const snapshot = useClinicalSnapshot(mision);
  const enqueuePacket = useOutboxStore((s) => s.enqueuePacket);

  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [queuedNoticeId, setQueuedNoticeId] = useState<number | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const navigatorOnline = useSyncExternalStore(subscribeOnline, getOnlineState, () => true);
  const isOffline = !navigatorOnline || snapshot.simulateOffline;

  const missionDisplayName =
    snapshot.missionProfileId === 'LUNAR_ARTEMIS'
      ? t.copilotUi.missionMoon
      : t.copilotUi.missionMars;

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
      title: question.slice(0, 60),
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

  const fetchAiSuggestion = async (
    queryText: string,
    telemetryPayload: Partial<TelemetryData>,
    targetLang: SupportedLang
  ): Promise<{ ok: true; response: string } | { ok: false; error: string }> => {
    let lastError = 'Error';

    for (let attempt = 0; attempt <= BACKOFF_DELAYS_MS.length; attempt += 1) {
      if (attempt > 0) {
        const delay = BACKOFF_DELAYS_MS[attempt - 1];
        setRetryStatus(
          `${t.copilotUi.retrying} (${attempt}/${BACKOFF_DELAYS_MS.length})…`
        );
        await sleep(delay);
      }

      try {
        const res = await fetch('/api/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: queryText,
            telemetry: telemetryPayload,
            missionProfileId: snapshot.missionProfileId,
            lang: targetLang,
            simulateOffline: snapshot.simulateOffline,
          }),
        });

        const data = (await res.json()) as {
          response?: string;
          error?: string;
        };

        if (res.ok && data.response) {
          return { ok: true, response: data.response };
        }

        lastError = data.error ?? `HTTP ${res.status}`;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          break;
        }
      } catch (err: unknown) {
        lastError =
          err instanceof Error ? err.message : 'Network error connecting /api/triage';
      }
    }

    return { ok: false, error: lastError };
  };

  const handleSend = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();

    const trimmedQuery = input.trim();
    if (!trimmedQuery || isLoading) return;

    const currentTelemetry = pickTelemetryForTriage();
    const ruleTracesSnapshot = snapshot.ruleTraces;
    const localReport = runLocalTriage(
      currentTelemetry,
      ruleTracesSnapshot,
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
      query: trimmedQuery,
      telemetrySnapshot: currentTelemetry,
      ruleTracesSnapshot,
      localReport,
    };

    setMessages((prev) => [...prev, userMessage, localMessage]);
    setInput('');

    if (isOffline) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          kind: 'error',
          content: '',
          errorKind: 'offline',
        },
      ]);
      return;
    }

    setIsLoading(true);
    setRetryStatus(null);

    try {
      const res = await fetchAiSuggestion(trimmedQuery, currentTelemetry, lang);
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            kind: 'ai-suggestion',
            content: res.response,
            query: trimmedQuery,
            telemetrySnapshot: currentTelemetry,
            aiLocale: lang,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            kind: 'error',
            content: '',
            errorKind: 'api',
            errorDetail: res.error,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      setRetryStatus(null);
    }
  };

  const handleRegenerateAi = async (renderedIndex: number, msg: ChatMessage) => {
    const stateIndex = renderedIndex - 1;
    if (stateIndex < 0 || !msg.query || isLoading || isOffline) return;

    setRegeneratingIndex(renderedIndex);
    setIsLoading(true);
    setRetryStatus(null);
    try {
      const payload = msg.telemetrySnapshot ?? pickTelemetryForTriage();
      const res = await fetchAiSuggestion(msg.query, payload, lang);
      if (res.ok) {
        setMessages((prev) =>
          prev.map((item, idx) =>
            idx === stateIndex
              ? { ...item, content: res.response, aiLocale: lang }
              : item
          )
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            kind: 'error',
            content: '',
            errorKind: 'api',
            errorDetail: res.error,
          },
        ]);
      }
    } finally {
      setRegeneratingIndex(null);
      setIsLoading(false);
      setRetryStatus(null);
    }
  };

  const escalationBadgeText = (level: LocalTriageReport['escalationLevel']) => {
    if (level === 'emergency') return t.copilotUi.escalationLabels.emergency;
    if (level === 'notify-flight-surgeon') return t.copilotUi.escalationLabels.surgeon;
    return t.copilotUi.escalationLabels.selfManage;
  };

  return (
    <section
      aria-labelledby="copilot-title"
      className={`flex flex-col ${
        compactHeight
          ? 'h-[min(540px,calc(100vh-14.5rem))] min-h-[380px]'
          : 'h-[620px]'
      } bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden`}
    >
      {/* Cabecera */}
      <div className="bg-slate-800/80 border-b border-slate-700 px-4 py-3.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="copilot-title" className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
            {t.copilot.title}
          </h2>
          <p className="text-[11px] text-slate-400">
            {t.copilot.subtitleModelPrefix}: {AI_MODEL_LABEL} · {t.copilot.subtitleLiveSuffix}
          </p>
        </div>

        <div
          className={`flex items-center gap-2 border px-2.5 py-1 rounded-full text-[11px] font-mono ${
            isOffline
              ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
              : 'bg-slate-950/60 border-slate-700 text-emerald-300'
          }`}
        >
          {isOffline ? (
            <WifiOff className="h-3.5 w-3.5 text-amber-300" aria-hidden />
          ) : (
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
          )}
          <span>
            {isOffline
              ? t.copilotUi.offlineBanner
              : `${t.copilot.commsBannerPrefix}: ${snapshot.comms.commsMode[lang]}`}
          </span>
        </div>
      </div>

      {/* Historial */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {renderedMessages.map((msg, index) => {
          const isUser = msg.role === 'user';

          if (msg.kind === 'local-triage') {
            const report =
              msg.telemetrySnapshot && msg.ruleTracesSnapshot
                ? runLocalTriage(
                    msg.telemetrySnapshot,
                    msg.ruleTracesSnapshot,
                    lang,
                    msg.query
                  )
                : msg.localReport;

            if (!report) return null;

            return (
              <div key={`${index}-local`} className="flex justify-start">
                <div className="w-full rounded-xl px-4 py-3 text-xs leading-relaxed bg-cyan-950/35 border border-cyan-500/60 text-slate-100 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                      <ShieldCheck className="w-4 h-4" aria-hidden />
                      {t.copilotUi.localTriageTitle}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-200 uppercase">
                      {escalationBadgeText(report.escalationLevel)}
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
                        ? t.copilotUi.queuedOutboxBtn
                        : t.copilotUi.sendSbarBtn}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          if (msg.kind === 'ai-suggestion') {
            const localeMismatch = msg.aiLocale && msg.aiLocale !== lang;
            return (
              <div key={`${index}-ai`} className="flex justify-start">
                <div className="max-w-[92%] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap bg-slate-800/90 border border-amber-500/50 text-slate-100 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-300 border-b border-amber-500/25 pb-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" aria-hidden />
                      <span>{t.copilotUi.aiSuggestionTitle}</span>
                    </span>
                    {msg.aiLocale && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px]">
                        {t.copilotUi.generatedInLabel}: {msg.aiLocale.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p>{msg.content}</p>
                  {localeMismatch && !isOffline && msg.query && (
                    <button
                      type="button"
                      disabled={isLoading || regeneratingIndex === index}
                      onClick={() => handleRegenerateAi(index, msg)}
                      className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 rounded border border-amber-400/50 bg-slate-900 hover:bg-slate-800 text-amber-200 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden />
                      {t.copilotUi.regenerateBtn}
                    </button>
                  )}
                </div>
              </div>
            );
          }

          const renderedContent =
            msg.kind === 'error'
              ? msg.errorKind === 'offline'
                ? t.copilotUi.offlineFallbackMsg
                : msg.errorKind === 'api'
                  ? `${t.copilotUi.aiUnavailablePrefix} (${msg.errorDetail ?? 'Error'}). ${t.copilotUi.aiUnavailableSuffix}`
                  : msg.content
              : msg.content;

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
                    <span>{t.copilotUi.assistantName}</span>
                  </p>
                )}
                <p>{renderedContent}</p>
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

      <p className="px-4 py-2 bg-slate-950/70 border-t border-slate-800 text-[11px] text-slate-400">
        {t.copilot.aiDisclaimer}
      </p>

      {/* Entrada */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-slate-900/90 border-t border-slate-700 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.copilot.placeholder}
          aria-label={t.copilot.placeholder}
          disabled={isLoading}
          className="flex-1 min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="min-h-[44px] bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          {t.copilot.send}
        </button>
      </form>
    </section>
  );
}

export default MedicalCopilot;
