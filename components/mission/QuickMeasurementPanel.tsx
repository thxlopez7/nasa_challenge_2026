'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, Plus, Minus, AlertTriangle, Thermometer, Droplets, HeartPulse } from 'lucide-react';
import { INDICATORS_EN } from '../../content/indicators.en';
import { INDICATORS_ES, type EducationalIndicatorId } from '../../content/indicators.es';
import { useT } from '../../i18n/I18nContext';
import { useClinicalSnapshot } from '../../store/selectors';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import type { GlucoseContext } from '../../types/telemetry';
import { evaluateMeasurementSchedule } from '../../utils/measurementSchedule';

const EDU_KEYS: EducationalIndicatorId[] = [
  'bp',
  'glucose',
  'temp',
  'heartRate',
  'co2',
  'renal',
  'radiation',
  'behavioral',
];

function toLocalDateTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function QuickMeasurementPanel() {
  const { lang } = useT();
  const snapshot = useClinicalSnapshot();
  const logManualVitals = useTelemetryStore((s) => s.logManualVitals);

  const [systolic, setSystolic] = useState<number>(snapshot.biomarkers.systolicMmHg ?? 118);
  const [diastolic, setDiastolic] = useState<number>(snapshot.biomarkers.diastolicMmHg ?? 76);
  const [glucose, setGlucose] = useState<number>(snapshot.biomarkers.glucoseMgDl ?? 92);
  const [glucoseCtx, setGlucoseCtx] = useState<GlucoseContext>(
    snapshot.biomarkers.glucoseContext ?? 'fasting'
  );
  const [bodyTemp, setBodyTemp] = useState<number>(snapshot.biomarkers.bodyTempC ?? 36.7);
  const [measuredInput, setMeasuredInput] = useState<string>('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<EducationalIndicatorId>('bp');
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const t0 = window.setTimeout(() => setNowMs(Date.now()), 0);
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(id);
    };
  }, []);

  const schedule = useMemo(() => {
    if (nowMs === null) return [];
    return evaluateMeasurementSchedule(
      snapshot.indicatorMeta,
      nowMs,
      snapshot.behavioralCheckIn?.updatedAt
    );
  }, [snapshot.indicatorMeta, snapshot.behavioralCheckIn?.updatedAt, nowMs]);

  const guides = lang === 'es' ? INDICATORS_ES : INDICATORS_EN;
  const activeGuide = guides[selectedGuide];

  const handleSave = () => {
    if (!Number.isFinite(systolic) || systolic < 50 || systolic > 260) {
      setFeedback({
        kind: 'err',
        text: lang === 'es' ? 'Sistólica fuera de rango plausible (50–260 mmHg).' : 'Systolic out of range (50–260 mmHg).',
      });
      return;
    }
    if (!Number.isFinite(diastolic) || diastolic < 30 || diastolic > 160 || diastolic >= systolic) {
      setFeedback({
        kind: 'err',
        text:
          lang === 'es'
            ? 'Diastólica inválida (debe ser menor que la sistólica y entre 30–160).'
            : 'Invalid diastolic BP (must be < systolic and within 30–160).',
      });
      return;
    }
    if (!Number.isFinite(glucose) || glucose < 20 || glucose > 600) {
      setFeedback({
        kind: 'err',
        text: lang === 'es' ? 'Glucosa fuera de rango (20–600 mg/dL).' : 'Glucose out of range (20–600 mg/dL).',
      });
      return;
    }
    if (!Number.isFinite(bodyTemp) || bodyTemp < 32 || bodyTemp > 43) {
      setFeedback({
        kind: 'err',
        text: lang === 'es' ? 'Temperatura fuera de rango (32,0–43,0 °C).' : 'Temperature out of range (32.0–43.0 °C).',
      });
      return;
    }

    const iso = measuredInput ? new Date(measuredInput).toISOString() : new Date().toISOString();
    logManualVitals({
      systolicMmHg: Math.round(systolic),
      diastolicMmHg: Math.round(diastolic),
      glucoseMgDl: Math.round(glucose),
      glucoseContext: glucoseCtx,
      bodyTempC: Number(bodyTemp.toFixed(1)),
      measuredAt: iso,
    });
    setNowMs(Date.now());
    setFeedback({
      kind: 'ok',
      text:
        lang === 'es'
          ? 'Signos vitales registrados manualmente y evaluados.'
          : 'Manual vitals saved with timestamp and evaluated.',
    });
  };

  return (
    <section
      aria-labelledby="quick-vitals-title"
      className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-cyan-400">
            {lang === 'es' ? 'CAPTURA MANUAL (APTA PARA GUANTES)' : 'MANUAL ENTRY (GLOVE-FRIENDLY)'}
          </p>
          <h2 id="quick-vitals-title" className="text-lg font-bold text-slate-100 uppercase tracking-wider mt-0.5">
            {lang === 'es' ? 'Presión, Glucosa, Temperatura y Guía' : 'BP, Glucose, Temp & Reference Guide'}
          </h2>
        </div>
        {snapshot.source && (
          <span className="text-[11px] font-mono px-2.5 py-1 rounded border border-slate-700 bg-slate-950/60 text-slate-300">
            {lang === 'es' ? 'Origen último dato:' : 'Latest source:'}{' '}
            <strong className="text-cyan-300 uppercase">{snapshot.source}</strong>
          </span>
        )}
      </div>

      {/* Recordatorios de rutina y frescura */}
      {schedule.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={lang === 'es' ? 'Frescura de mediciones' : 'Measurement freshness'}>
          {schedule.map((item) => (
            <span
              key={item.key}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold border ${
                item.isStale
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              <Clock className="h-3 w-3" aria-hidden />
              <span>{item.label[lang]}:</span>
              <span>
                {item.neverMeasured
                  ? lang === 'es'
                    ? 'Pendiente hoy'
                    : 'Due today'
                  : item.isStale
                    ? lang === 'es'
                      ? `Vencida (${item.ageHours} h > ${item.maxAgeHours} h)`
                      : `Stale (${item.ageHours}h > ${item.maxAgeHours}h)`
                    : lang === 'es'
                      ? `Hace ${item.ageHours} h`
                      : `${item.ageHours}h ago`}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Entradas rápidas con botones grandes (>=44px) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Presión arterial */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase">
            <HeartPulse className="h-4 w-4" aria-hidden />
            <span>{lang === 'es' ? 'Presión arterial (mmHg)' : 'Blood pressure (mmHg)'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSystolic((v) => Math.max(60, v - 5))}
              aria-label={lang === 'es' ? 'Disminuir sistólica 5' : 'Decrease systolic by 5'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <div className="text-center">
              <span className="block text-[10px] text-slate-400 uppercase">{lang === 'es' ? 'Sistólica' : 'Systolic'}</span>
              <input
                type="number"
                value={systolic}
                onChange={(e) => setSystolic(Number(e.target.value))}
                aria-label={lang === 'es' ? 'Presión sistólica' : 'Systolic pressure'}
                className="w-20 bg-transparent text-center text-xl font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-cyan-400 rounded"
              />
            </div>
            <button
              type="button"
              onClick={() => setSystolic((v) => Math.min(250, v + 5))}
              aria-label={lang === 'es' ? 'Aumentar sistólica 5' : 'Increase systolic by 5'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setDiastolic((v) => Math.max(35, v - 5))}
              aria-label={lang === 'es' ? 'Disminuir diastólica 5' : 'Decrease diastolic by 5'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <div className="text-center">
              <span className="block text-[10px] text-slate-400 uppercase">{lang === 'es' ? 'Diastólica' : 'Diastolic'}</span>
              <input
                type="number"
                value={diastolic}
                onChange={(e) => setDiastolic(Number(e.target.value))}
                aria-label={lang === 'es' ? 'Presión diastólica' : 'Diastolic pressure'}
                className="w-20 bg-transparent text-center text-xl font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-cyan-400 rounded"
              />
            </div>
            <button
              type="button"
              onClick={() => setDiastolic((v) => Math.min(150, v + 5))}
              aria-label={lang === 'es' ? 'Aumentar diastólica 5' : 'Increase diastolic by 5'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Glucosa capilar */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase">
            <Droplets className="h-4 w-4" aria-hidden />
            <span>{lang === 'es' ? 'Glucosa capilar (mg/dL)' : 'Capillary glucose (mg/dL)'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setGlucose((v) => Math.max(20, v - 5))}
              aria-label={lang === 'es' ? 'Disminuir glucosa 5' : 'Decrease glucose by 5'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <input
              type="number"
              value={glucose}
              onChange={(e) => setGlucose(Number(e.target.value))}
              aria-label={lang === 'es' ? 'Glucosa en mg/dL' : 'Glucose mg/dL'}
              className="w-24 bg-transparent text-center text-2xl font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-cyan-400 rounded"
            />
            <button
              type="button"
              onClick={() => setGlucose((v) => Math.min(500, v + 5))}
              aria-label={lang === 'es' ? 'Aumentar glucosa 5' : 'Increase glucose by 5'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div role="group" aria-label={lang === 'es' ? 'Contexto glucosa' : 'Glucose context'} className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGlucoseCtx('fasting')}
              aria-pressed={glucoseCtx === 'fasting'}
              className={`min-h-[44px] rounded-lg border text-xs font-semibold cursor-pointer ${
                glucoseCtx === 'fasting'
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                  : 'border-slate-700 text-slate-400 hover:text-slate-100'
              }`}
            >
              {lang === 'es' ? 'Ayunas' : 'Fasting'}
            </button>
            <button
              type="button"
              onClick={() => setGlucoseCtx('postprandial')}
              aria-pressed={glucoseCtx === 'postprandial'}
              className={`min-h-[44px] rounded-lg border text-xs font-semibold cursor-pointer ${
                glucoseCtx === 'postprandial'
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                  : 'border-slate-700 text-slate-400 hover:text-slate-100'
              }`}
            >
              {lang === 'es' ? 'Posprandial' : 'Postprandial'}
            </button>
          </div>
        </div>

        {/* Temperatura corporal + timestamp */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase">
            <Thermometer className="h-4 w-4" aria-hidden />
            <span>{lang === 'es' ? 'Temperatura (°C)' : 'Body temp (°C)'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setBodyTemp((v) => Number(Math.max(32, v - 0.2).toFixed(1)))}
              aria-label={lang === 'es' ? 'Disminuir temperatura 0.2' : 'Decrease temp by 0.2'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <input
              type="number"
              step="0.1"
              value={bodyTemp}
              onChange={(e) => setBodyTemp(Number(e.target.value))}
              aria-label={lang === 'es' ? 'Temperatura corporal en °C' : 'Body temperature in °C'}
              className="w-24 bg-transparent text-center text-2xl font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-cyan-400 rounded"
            />
            <button
              type="button"
              onClick={() => setBodyTemp((v) => Number(Math.min(43, v + 0.2).toFixed(1)))}
              aria-label={lang === 'es' ? 'Aumentar temperatura 0.2' : 'Increase temp by 0.2'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={measuredInput}
              onChange={(e) => setMeasuredInput(e.target.value)}
              aria-label={lang === 'es' ? 'Fecha y hora de medición' : 'Measurement timestamp'}
              className="flex-1 min-h-[44px] bg-slate-900 border border-slate-700 rounded-lg px-2 text-xs text-slate-200"
            />
            <button
              type="button"
              onClick={() => setMeasuredInput(toLocalDateTimeValue(new Date()))}
              className="min-h-[44px] px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
            >
              {lang === 'es' ? 'Ahora' : 'Now'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="min-h-[48px] px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm uppercase tracking-wider cursor-pointer transition"
        >
          {lang === 'es' ? 'Guardar signos manuales' : 'Save manual vitals'}
        </button>

        {feedback && (
          <p
            role="status"
            className={`inline-flex items-center gap-2 text-xs font-semibold ${
              feedback.kind === 'err' ? 'text-rose-300' : 'text-emerald-300'
            }`}
          >
            {feedback.kind === 'err' ? (
              <AlertTriangle className="h-4 w-4" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            )}
            {feedback.text}
          </p>
        )}
      </div>

      {/* Guía educativa accionable por indicador */}
      <div className="border-t border-slate-800 pt-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
          <BookOpen className="h-4 w-4" aria-hidden />
          <span>{lang === 'es' ? 'Guía rápida para la tripulación (qué, por qué y cómo actuar)' : 'Crew Quick Reference (what, why, how to act)'}</span>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Indicator educational guide">
          {EDU_KEYS.map((key) => {
            const g = guides[key];
            const active = selectedGuide === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedGuide(key)}
                className={`min-h-[40px] px-3 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                  active
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-100'
                }`}
              >
                {g.title.split(' (')[0]}
              </button>
            );
          })}
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-2 text-xs leading-relaxed">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-100">{activeGuide.title}</h3>
            <span className="font-mono text-[11px] text-slate-400">
              {activeGuide.unit} · {activeGuide.verified ? (lang === 'es' ? 'Referencia verificada' : 'Verified reference') : lang === 'es' ? 'Umbral prototipo' : 'Prototype threshold'}
            </span>
          </div>
          <p><strong className="text-cyan-300">{lang === 'es' ? 'Qué mide:' : 'What it measures:'}</strong> {activeGuide.whatItMeasures}</p>
          <p><strong className="text-cyan-300">{lang === 'es' ? 'Por qué en el espacio:' : 'Why in space:'}</strong> {activeGuide.whyInSpace}</p>
          <p><strong className="text-cyan-300">{lang === 'es' ? 'Cómo medir:' : 'How to measure:'}</strong> {activeGuide.howToMeasure}</p>
          <p><strong className="text-emerald-300">{lang === 'es' ? 'Rango referencia:' : 'Reference range:'}</strong> {activeGuide.referenceRange}</p>
          <p><strong className="text-amber-300">{lang === 'es' ? 'Cuándo preocuparse:' : 'When to worry:'}</strong> {activeGuide.whenToWorry}</p>
          <p><strong className="text-rose-300">{lang === 'es' ? 'Cuándo escalar:' : 'When to escalate:'}</strong> {activeGuide.whenToEscalate}</p>
          <p><strong className="text-slate-200">{lang === 'es' ? 'Prevención:' : 'Prevention:'}</strong> {activeGuide.prevention}</p>
          <p className="text-[11px] text-slate-500 pt-1">{activeGuide.sourceNote}</p>
        </div>
      </div>
    </section>
  );
}

export default QuickMeasurementPanel;
