'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTelemetryStore } from '../store/useTelemetryStore';

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export function MedicalCopilot() {
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      content:
        'Oficial Médico Autónomo ExoVitals en línea. Enlace con la Tierra con latencia de 20 min. Estoy monitoreando su telemetría biométrica y ambiental en tiempo real. ¿Qué síntomas o anomalías experimenta?',
    },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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
        }),
      });

      const data = (await res.json()) as {
        response?: string;
        error?: string;
      };

      if (!res.ok || !data.response) {
        throw new Error(
          data.error || 'Error en el enlace con el módulo clínico autónomo.'
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
          : 'Error crítico al consultar al Cirujano de Vuelo Autónomo.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: `[ALERTA DE SISTEMA]: ${errorMsg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex flex-col h-[680px] bg-slate-800/70 border border-slate-700 rounded-xl overflow-hidden">
      {/* Cabecera del Copiloto */}
      <div className="px-6 py-4 bg-slate-900/80 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
            Cirujano de Vuelo Autónomo (AI)
          </h2>
          <p className="text-xs text-slate-400">
            Gemini 3 Flash // Telemetría Inyectada en Tiempo Real
          </p>
        </div>
        <span className="px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-700 text-[11px] text-cyan-300 uppercase tracking-wider">
          Edge-First
        </span>
      </div>

      {/* Historial de Mensajes con Scroll */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={index}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-slate-700 text-slate-100 border border-slate-600 rounded-br-none'
                    : 'bg-sky-950/90 text-cyan-100 border border-cyan-800/80 rounded-bl-none shadow-md'
                }`}
              >
                <p className="text-[10px] uppercase tracking-widest mb-1 opacity-60 font-semibold">
                  {isUser ? 'Astronauta' : 'ExoVitals AI'}
                </p>
                <div>{msg.content}</div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-sky-950/90 text-cyan-200 border border-cyan-800/80 rounded-xl rounded-bl-none px-4 py-3 text-sm flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Cargando evaluación clínica y contramedidas...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Formulario de Entrada */}
      <form
        onSubmit={handleSend}
        className="p-4 bg-slate-900/90 border-t border-slate-700 flex items-center gap-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ej: Tengo dolor de cabeza y mareo leve..."
          disabled={isLoading}
          className="flex-1 bg-slate-800 text-white placeholder-slate-500 text-sm rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold text-sm uppercase tracking-wider transition cursor-pointer disabled:cursor-not-allowed"
        >
          Enviar
        </button>
      </form>
    </section>
  );
}

export default MedicalCopilot;
