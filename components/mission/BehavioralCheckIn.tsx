'use client';

import { useState } from 'react';
import { Brain, CheckCircle2, Lock, ShieldAlert, Unlock } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { useClinicalSnapshot } from '../../store/selectors';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { computeBehavioralRiskIndex } from '../../utils/behavioralScoring';

type ScaleKey = 'mood' | 'sleepQuality' | 'fatigue' | 'stress' | 'workload' | 'socialContact';

interface ScaleSpec {
  key: ScaleKey;
  label: { es: string; en: string };
  lowLabel: { es: string; en: string };
  highLabel: { es: string; en: string };
}

const SCALES: ScaleSpec[] = [
  { key: 'mood', label: { es: 'Estado de ánimo', en: 'Mood' }, lowLabel: { es: '1 Muy bajo', en: '1 Very low' }, highLabel: { es: '5 Óptimo', en: '5 Great' } },
  { key: 'sleepQuality', label: { es: 'Calidad de sueño', en: 'Sleep quality' }, lowLabel: { es: '1 Fragmentado', en: '1 Poor' }, highLabel: { es: '5 Reparador', en: '5 Restorative' } },
  { key: 'fatigue', label: { es: 'Fatiga física/mental', en: 'Fatigue' }, lowLabel: { es: '1 Descansado', en: '1 Rested' }, highLabel: { es: '5 Agotado', en: '5 Exhausted' } },
  { key: 'stress', label: { es: 'Estrés percibido', en: 'Perceived stress' }, lowLabel: { es: '1 Calma', en: '1 Calm' }, highLabel: { es: '5 Máximo', en: '5 High' } },
  { key: 'workload', label: { es: 'Carga de trabajo', en: 'Workload' }, lowLabel: { es: '1 Ligera', en: '1 Light' }, highLabel: { es: '5 Sobrecarga', en: '5 Overloaded' } },
  { key: 'socialContact', label: { es: 'Contacto social / equipo', en: 'Social connection' }, lowLabel: { es: '1 Aislado', en: '1 Isolated' }, highLabel: { es: '5 Conectado', en: '5 Connected' } },
];

export function BehavioralCheckIn() {
  const { lang } = useT();
  const snapshot = useClinicalSnapshot();
  const submitBehavioralCheckIn = useTelemetryStore((s) => s.submitBehavioralCheckIn);
  const setSharePsychWithAi = useTelemetryStore((s) => s.setSharePsychWithAi);

  const initial = snapshot.behavioralCheckIn;
  const [scores, setScores] = useState<Record<ScaleKey, number>>({
    mood: initial?.mood ?? 4,
    sleepQuality: initial?.sleepQuality ?? 4,
    fatigue: initial?.fatigue ?? 2,
    stress: initial?.stress ?? 2,
    workload: initial?.workload ?? 3,
    socialContact: initial?.socialContact ?? 4,
  });
  const [phq2Anhedonia, setPhq2Anhedonia] = useState<0 | 1 | 2 | 3>(initial?.phq2Anhedonia ?? 0);
  const [phq2Dysphoria, setPhq2Dysphoria] = useState<0 | 1 | 2 | 3>(initial?.phq2Dysphoria ?? 0);
  const [selfHarmFlag, setSelfHarmFlag] = useState<boolean>(initial?.selfHarmFlag ?? false);
  const [shareWithAi, setShareWithAi] = useState<boolean>(snapshot.sharePsychWithAi);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const previewIndex = computeBehavioralRiskIndex({
    ...scores,
    phq2Anhedonia,
    phq2Dysphoria,
    selfHarmFlag,
  });
  const phq2Total = phq2Anhedonia + phq2Dysphoria;

  const phqOptions: Array<{ value: 0 | 1 | 2 | 3; label: { es: string; en: string } }> = [
    { value: 0, label: { es: '0 · Nunca', en: '0 · Not at all' } },
    { value: 1, label: { es: '1 · Varios días', en: '1 · Several days' } },
    { value: 2, label: { es: '2 · > mitad días', en: '2 · > half days' } },
    { value: 3, label: { es: '3 · Casi diario', en: '3 · Nearly every day' } },
  ];

  const handleSubmit = () => {
    const nowIso = new Date().toISOString();
    submitBehavioralCheckIn({
      ...scores,
      phq2Anhedonia,
      phq2Dysphoria,
      selfHarmFlag,
      sharePsychWithAi: shareWithAi,
      updatedAt: nowIso,
    });
    setSavedAt(nowIso);
  };

  return (
    <section
      aria-labelledby="behavioral-checkin-title"
      className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-cyan-400">
            {lang === 'es' ? 'RIESGO NASA: AISLAMIENTO Y CONFINAMIENTO' : 'NASA RISK: ISOLATION & CONFINEMENT'}
          </p>
          <h2 id="behavioral-checkin-title" className="text-lg font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 mt-0.5">
            <Brain className="h-5 w-5 text-cyan-400" aria-hidden />
            <span>{lang === 'es' ? 'Check-in Conductual Diario y PHQ-2' : 'Daily Behavioral & PHQ-2 Check-In'}</span>
          </h2>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-right">
          <p className="text-[10px] uppercase text-slate-400">
            {lang === 'es' ? 'Índice conductual' : 'Behavioral risk index'}
          </p>
          <p
            className={`text-xl font-bold tabular-nums ${
              previewIndex >= 65 ? 'text-rose-400' : previewIndex >= 40 ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {previewIndex} / 100
          </p>
        </div>
      </div>

      {/* 6 escalas rápidas (1–5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SCALES.map((s) => (
          <div key={s.key} className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">{s.label[lang]}</span>
              <span className="text-[11px] text-slate-400">
                {s.lowLabel[lang]} ↔ {s.highLabel[lang]}
              </span>
            </div>
            <div role="group" aria-label={s.label[lang]} className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = scores[s.key] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setScores((prev) => ({ ...prev, [s.key]: n }))}
                    className={`min-h-[44px] rounded-lg border font-bold text-sm cursor-pointer transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Tamizaje PHQ-2 */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase text-cyan-300">
            {lang === 'es' ? 'Tamizaje breve PHQ-2 (últimas 2 semanas)' : 'Brief PHQ-2 Screen (past 2 weeks)'}
          </p>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded ${
              phq2Total >= 3 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-300'
            }`}
          >
            PHQ-2: {phq2Total}/6 {phq2Total >= 3 ? (lang === 'es' ? '· Sugiere apoyo médico' : '· Suggests surgeon check') : ''}
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-200">
            1. {lang === 'es' ? 'Poco interés o placer en hacer las cosas:' : 'Little interest or pleasure in doing things:'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {phqOptions.map((opt) => (
              <button
                key={`a-${opt.value}`}
                type="button"
                aria-pressed={phq2Anhedonia === opt.value}
                onClick={() => setPhq2Anhedonia(opt.value)}
                className={`min-h-[44px] px-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                  phq2Anhedonia === opt.value
                    ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100'
                }`}
              >
                {opt.label[lang]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-200">
            2. {lang === 'es' ? 'Sentirse desanimado, deprimido o sin esperanza:' : 'Feeling down, depressed, or hopeless:'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {phqOptions.map((opt) => (
              <button
                key={`d-${opt.value}`}
                type="button"
                aria-pressed={phq2Dysphoria === opt.value}
                onClick={() => setPhq2Dysphoria(opt.value)}
                className={`min-h-[44px] px-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                  phq2Dysphoria === opt.value
                    ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100'
                }`}
              >
                {opt.label[lang]}
              </button>
            ))}
          </div>
        </div>

        {/* Seguridad / autolesión */}
        <div className="border-t border-slate-800 pt-3 space-y-3">
          <button
            type="button"
            role="switch"
            aria-checked={selfHarmFlag}
            onClick={() => setSelfHarmFlag((v) => !v)}
            className={`min-h-[44px] w-full text-left px-4 py-2 rounded-lg border text-xs font-semibold cursor-pointer flex items-center justify-between gap-3 ${
              selfHarmFlag
                ? 'border-rose-500 bg-rose-500/20 text-rose-100'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span>
              {lang === 'es'
                ? 'Marcar si presentas pensamientos de hacerte daño o angustia aguda hoy'
                : 'Flag if experiencing thoughts of self-harm or acute psychological crisis today'}
            </span>
            <span className="uppercase font-bold shrink-0">
              {selfHarmFlag ? (lang === 'es' ? 'Activado' : 'Flagged') : lang === 'es' ? 'No' : 'No'}
            </span>
          </button>

          {selfHarmFlag && (
            <div
              role="alert"
              className="rounded-lg border-2 border-rose-500 bg-rose-950/70 p-4 text-xs text-rose-100 space-y-2"
            >
              <p className="font-bold flex items-center gap-2 text-sm text-rose-200">
                <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />
                <span>
                  {lang === 'es'
                    ? 'Protocolo inmediato de apoyo y cuidado prioritario'
                    : 'Immediate Supportive Care & Priority Protocol'}
                </span>
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  {lang === 'es'
                    ? 'No permanezcas solo: avisa al comandante o compañero asignado para acompañamiento cercano.'
                    : 'Do not isolate yourself: notify your crewmate buddy or commander for immediate support.'}
                </li>
                <li>
                  {lang === 'es'
                    ? 'Solicita comunicación prioritaria confidencial con el Cirujano de Vuelo / equipo de salud conductual.'
                    : 'Initiate priority confidential contact with the Flight Surgeon / behavioral health team.'}
                </li>
                <li>
                  {lang === 'es'
                    ? 'Pausa tareas operativas críticas o EVA y realiza respiración lenta (4 s inhalar · 6 s exhalar).'
                    : 'Stand down from critical tasks / EVA and use paced breathing (4s inhale · 6s exhale).'}
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Control explícito de privacidad para IA */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 rounded-lg p-4">
        <button
          type="button"
          role="switch"
          aria-checked={shareWithAi}
          onClick={() => {
            const next = !shareWithAi;
            setShareWithAi(next);
            setSharePsychWithAi(next);
          }}
          className="min-h-[44px] inline-flex items-center gap-2.5 text-left text-xs cursor-pointer text-slate-200"
        >
          {shareWithAi ? (
            <Unlock className="h-4 w-4 text-amber-400 shrink-0" aria-hidden />
          ) : (
            <Lock className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden />
          )}
          <span>
            {shareWithAi
              ? lang === 'es'
                ? 'Compartir este check-in conductual con el asistente de IA (Activado)'
                : 'Share behavioral check-in summary with AI Assistant (Enabled)'
              : lang === 'es'
                ? 'Privacidad activa: check-in conductual NO enviado al asistente de IA (Solo local)'
                : 'Privacy active: behavioral check-in kept OFF AI prompts (Local only)'}
          </span>
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          className="min-h-[48px] px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm uppercase tracking-wider cursor-pointer transition"
        >
          {lang === 'es' ? 'Guardar check-in diario' : 'Save daily check-in'}
        </button>
      </div>

      {savedAt && (
        <p role="status" className="inline-flex items-center gap-2 text-xs text-emerald-300 font-semibold">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {lang === 'es' ? 'Check-in conductual guardado localmente.' : 'Behavioral check-in saved locally.'}
        </p>
      )}
    </section>
  );
}

export default BehavioralCheckIn;
