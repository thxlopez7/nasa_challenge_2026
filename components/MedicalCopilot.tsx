'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { AI_MODEL_LABEL } from '../config/ai';
import { useT } from '../i18n/I18nContext';
import { useClinicalSnapshot } from '../store/selectors';
import { useTelemetryStore } from '../store/useTelemetryStore';
import type { MissionSlug } from '../utils/missionChoice';

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export function MedicalCopilot({ mision }: { mision?: MissionSlug }) {
  const { t, lang } = useT();
  const snapshot = useClinicalSnapshot(mision);
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const messagesRef = useRef<HTMLDivElement | null>(null);

  const missionDisplayName =
    snapshot.missionProfileId === 'LUNAR_ARTEMIS'
      ? `${t.common.moon} (Artemis)`
      : snapshot.missionProfileId === 'ISS_6M'
        ? t.common.iss
        : `${t.common.mars} (Conjunction)`;

  const welcomeMessage: ChatMessage = {
    role: 'ai',
    content: t.copilot.welcome(missionDisplayName, snapshot.comms.commsMode[lang]),
  };

  const renderedMessages = [welcomeMessage, ...messages];

  // Desplaza solo la caja del chat al último mensaje.
  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isLoading]);

  const handleSend = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault();
    }

    const trimmedQuery = input.trim();
    if (!trimmedQuery || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmedQuery,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const currentTelemetry = useTelemetryStore.getState();

      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmedQuery,
          telemetry: currentTelemetry,
          missionProfileId: snapshot.missionProfileId,
          lang,
        }),
      });

      const data = (await res.json()) as {
        response?: string;
        error?: string;
      };

      if (!res.ok || !data.response) {
        throw new Error(
          data.error ||
            (lang === 'es'
              ? 'Error en el enlace con el módulo clínico autónomo.'
              : 'Unable to reach autonomous clinical module.')
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: data.response as string,
        },
      ]);
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : lang === 'es'
            ? 'Error al consultar el asistente clínico.'
            : 'Failed to query clinical assistant.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: `${t.copilot.errorPrefix} ${errorMsg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="copilot-title"
      className="flex flex-col h-[540px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Cabecera */}
      <div className="bg-slate-800/80 border-b border-slate-700 px-6 py-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="copilot-title" className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
            {t.copilot.title}
          </h2>
          <p className="text-xs text-slate-400">
            {t.copilot.subtitleModelPrefix}: {AI_MODEL_LABEL} · {t.copilot.subtitleLiveSuffix}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-700 px-3 py-1 rounded-full">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
          <span className="text-xs font-mono text-emerald-300">
            {t.copilot.commsBannerPrefix}: {snapshot.comms.commsMode[lang]}
          </span>
        </div>
      </div>

      {/* Historial */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {renderedMessages.map((msg, index) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={`${index}-${msg.role}`}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-slate-700 text-slate-100 border border-slate-600 rounded-br-none'
                    : 'bg-sky-950/90 text-cyan-100 border border-cyan-800/80 rounded-bl-none shadow-md'
                }`}
              >
                <p className="text-[10px] uppercase tracking-widest mb-1 opacity-70 font-semibold">
                  {isUser
                    ? lang === 'es'
                      ? 'Tripulación'
                      : 'Crew'
                    : `ExoVitals IA · ${AI_MODEL_LABEL}`}
                </p>
                <div>{msg.content}</div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start" role="status" aria-live="polite">
            <div className="bg-sky-950/90 text-cyan-200 border border-cyan-800/80 rounded-xl rounded-bl-none px-4 py-3 text-sm flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" aria-hidden />
              <span>{t.copilot.sending}</span>
            </div>
          </div>
        )}
      </div>

      <p className="px-6 py-2 bg-slate-950/70 border-t border-slate-800 text-[11px] text-slate-400">
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
          className="flex-1 min-h-[44px] bg-slate-800 text-white placeholder-slate-400 text-sm rounded-lg px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="min-h-[44px] px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold text-sm uppercase tracking-wider transition cursor-pointer disabled:cursor-not-allowed"
        >
          {t.copilot.send}
        </button>
      </form>
    </section>
  );
}

export default MedicalCopilot;
