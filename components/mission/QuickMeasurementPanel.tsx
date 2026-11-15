'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, FlaskConical, Plus, Minus, AlertTriangle, Thermometer, Droplets, HeartPulse } from 'lucide-react';
import { INDICATORS_EN } from '../../content/indicators.en';
import { INDICATORS_ES, type EducationalIndicatorId } from '../../content/indicators.es';
import { useT } from '../../i18n/I18nContext';
import { useClinicalSnapshot } from '../../store/selectors';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import type { GlucoseContext } from '../../types/telemetry';
import { evaluateMeasurementSchedule } from '../../utils/measurementSchedule';
import { formatDecimal, formatRelativeAgeHours } from '../../utils/formatters';

type QuickMeasureMessageKey =
  | 'savedSpot'
  | 'savedPoc'
  | 'errSystolic'
  | 'errDiastolic'
  | 'errGlucose'
  | 'errTemp'
  | 'errCistatina'
  | 'errCreatinina'
  | 'errCalcio'
  | 'errLinfocitos'
  | 'errNeutrofilos'
  | 'errCortisol';

type MeasureFeedback = { kind: 'ok' | 'err'; msgKey: QuickMeasureMessageKey };

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

export function QuickMeasurementPanel({
  sectionFilter = 'all',
}: {
  sectionFilter?: 'all' | 'vitals' | 'poc';
} = {}) {
  const { lang, t } = useT();
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
  const [feedback, setFeedback] = useState<MeasureFeedback | null>(null);
  const [cistatinaC, setCistatinaC] = useState<number>(snapshot.biomarkers.cistatinaC);
  const [creatinina, setCreatinina] = useState<number>(snapshot.biomarkers.creatinina);
  const [calcioIonico, setCalcioIonico] = useState<number>(snapshot.biomarkers.calcioIonico);
  const [linfocitos, setLinfocitos] = useState<number>(snapshot.biomarkers.linfocitos);
  const [neutrofilos, setNeutrofilos] = useState<number>(snapshot.biomarkers.neutrofilos);
  const [cortisol, setCortisol] = useState<number>(snapshot.biomarkers.cortisol);
  const [cartridgeFeedback, setCartridgeFeedback] = useState<MeasureFeedback | null>(null);
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
      setFeedback({ kind: 'err', msgKey: 'errSystolic' });
      return;
    }
    if (!Number.isFinite(diastolic) || diastolic < 30 || diastolic > 160 || diastolic >= systolic) {
      setFeedback({ kind: 'err', msgKey: 'errDiastolic' });
      return;
    }
    if (!Number.isFinite(glucose) || glucose < 20 || glucose > 600) {
      setFeedback({ kind: 'err', msgKey: 'errGlucose' });
      return;
    }
    if (!Number.isFinite(bodyTemp) || bodyTemp < 32 || bodyTemp > 43) {
      setFeedback({ kind: 'err', msgKey: 'errTemp' });
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
    setFeedback({ kind: 'ok', msgKey: 'savedSpot' });
  };

  const handleSyncCartridgeFromSnapshot = () => {
    setCistatinaC(Number(snapshot.biomarkers.cistatinaC.toFixed(2)));
    setCreatinina(Number(snapshot.biomarkers.creatinina.toFixed(2)));
    setCalcioIonico(Number(snapshot.biomarkers.calcioIonico.toFixed(2)));
    setLinfocitos(Math.round(snapshot.biomarkers.linfocitos));
    setNeutrofilos(Math.round(snapshot.biomarkers.neutrofilos));
    setCortisol(Number(snapshot.biomarkers.cortisol.toFixed(1)));
    setCartridgeFeedback(null);
  };

  const handleSaveCartridge = () => {
    if (!Number.isFinite(cistatinaC) || cistatinaC < 0.3 || cistatinaC > 10) {
      setCartridgeFeedback({ kind: 'err', msgKey: 'errCistatina' });
      return;
    }
    if (!Number.isFinite(creatinina) || creatinina < 0.2 || creatinina > 15) {
      setCartridgeFeedback({ kind: 'err', msgKey: 'errCreatinina' });
      return;
    }
    if (!Number.isFinite(calcioIonico) || calcioIonico < 0.5 || calcioIonico > 3) {
      setCartridgeFeedback({ kind: 'err', msgKey: 'errCalcio' });
      return;
    }
    if (!Number.isFinite(linfocitos) || linfocitos < 100 || linfocitos > 15000) {
      setCartridgeFeedback({ kind: 'err', msgKey: 'errLinfocitos' });
      return;
    }
    if (!Number.isFinite(neutrofilos) || neutrofilos < 200 || neutrofilos > 25000) {
      setCartridgeFeedback({ kind: 'err', msgKey: 'errNeutrofilos' });
      return;
    }
    if (!Number.isFinite(cortisol) || cortisol < 1 || cortisol > 120) {
      setCartridgeFeedback({ kind: 'err', msgKey: 'errCortisol' });
      return;
    }

    const iso = measuredInput ? new Date(measuredInput).toISOString() : new Date().toISOString();
    logManualVitals({
      cistatinaC: Number(cistatinaC.toFixed(2)),
      creatinina: Number(creatinina.toFixed(2)),
      calcioIonico: Number(calcioIonico.toFixed(2)),
      linfocitos: Math.round(linfocitos),
      neutrofilos: Math.round(neutrofilos),
      cortisol: Number(cortisol.toFixed(1)),
      measuredAt: iso,
    });
    setNowMs(Date.now());
    setCartridgeFeedback({ kind: 'ok', msgKey: 'savedPoc' });
  };

  const showVitals = sectionFilter === 'all' || sectionFilter === 'vitals';
  const showPoc = sectionFilter === 'all' || sectionFilter === 'poc';
  const showGuide = sectionFilter === 'all';
  const sourceLabel =
    snapshot.source === 'sensor'
      ? t.quickMeasure.sourceSensor
      : snapshot.source === 'manual'
        ? t.quickMeasure.sourceManual
        : snapshot.source;

  return (
    <section
      aria-labelledby="quick-vitals-title"
      className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-cyan-400">
            {t.quickMeasure.eyebrow}
          </p>
          <h2 id="quick-vitals-title" className="text-lg font-bold text-slate-100 uppercase tracking-wider mt-0.5">
            {t.quickMeasure.title}
          </h2>
        </div>
        {snapshot.source && (
          <span className="text-[11px] font-mono px-2.5 py-1 rounded border border-slate-700 bg-slate-950/60 text-slate-300">
            {t.quickMeasure.latestSource}:{' '}
            <strong className="text-cyan-300 uppercase">{sourceLabel}</strong>
          </span>
        )}
      </div>

      {/* Recordatorios de rutina y frescura */}
      {schedule.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={t.quickMeasure.freshnessAria}>
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
                {item.neverMeasured || item.ageHours === null
                  ? t.quickMeasure.pendingToday
                  : item.isStale
                    ? `${t.quickMeasure.stalePrefix} (${formatDecimal(item.ageHours, 1, lang)} h > ${item.maxAgeHours} h)`
                    : formatRelativeAgeHours(item.ageHours, lang)}
              </span>
            </span>
          ))}
        </div>
      )}

      {showVitals && (
        <>
          {/* Entradas rápidas Spot (Manguito / Glucómetro / Termómetro IR) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              {t.quickMeasure.spotHeading}
            </h3>
            <p className="text-[11px] text-slate-400">{t.quickMeasure.spotTip}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Presión arterial */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase">
                <HeartPulse className="h-4 w-4" aria-hidden />
                <span>{t.quickMeasure.bpTitle}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSystolic((v) => Math.max(60, v - 5))}
                  aria-label={t.quickMeasure.aria.decSys}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <div className="text-center">
                  <span className="block text-[10px] text-slate-400 uppercase">{t.quickMeasure.systolic}</span>
                  <input
                    type="number"
                    value={systolic}
                    onChange={(e) => setSystolic(Number(e.target.value))}
                    aria-label={t.quickMeasure.aria.sysInput}
                    className="w-20 bg-transparent text-center text-xl font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-cyan-400 rounded"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSystolic((v) => Math.min(250, v + 5))}
                  aria-label={t.quickMeasure.aria.incSys}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDiastolic((v) => Math.max(35, v - 5))}
                  aria-label={t.quickMeasure.aria.decDia}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <div className="text-center">
                  <span className="block text-[10px] text-slate-400 uppercase">{t.quickMeasure.diastolic}</span>
                  <input
                    type="number"
                    value={diastolic}
                    onChange={(e) => setDiastolic(Number(e.target.value))}
                    aria-label={t.quickMeasure.aria.diaInput}
                    className="w-20 bg-transparent text-center text-xl font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-cyan-400 rounded"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setDiastolic((v) => Math.min(150, v + 5))}
                  aria-label={t.quickMeasure.aria.incDia}
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
                <span>{t.quickMeasure.glucoseTitle}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setGlucose((v) => Math.max(20, v - 5))}
                  aria-label={t.quickMeasure.aria.decGlu}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <input
                  type="number"
                  value={glucose}
                  onChange={(e) => setGlucose(Number(e.target.value))}
                  aria-label={t.quickMeasure.aria.gluInput}
                  className="w-24 bg-transparent text-center text-2xl font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-cyan-400 rounded"
                />
                <button
                  type="button"
                  onClick={() => setGlucose((v) => Math.min(500, v + 5))}
                  aria-label={t.quickMeasure.aria.incGlu}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div role="group" aria-label={t.quickMeasure.aria.gluContext} className="grid grid-cols-2 gap-2">
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
                  {t.quickMeasure.fasting}
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
                  {t.quickMeasure.postprandial}
                </button>
              </div>
            </div>

            {/* Temperatura corporal + timestamp */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase">
                <Thermometer className="h-4 w-4" aria-hidden />
                <span>{t.quickMeasure.tempTitle}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setBodyTemp((v) => Number(Math.max(32, v - 0.2).toFixed(1)))}
                  aria-label={t.quickMeasure.aria.decTemp}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <input
                  type="number"
                  step="0.1"
                  value={bodyTemp}
                  onChange={(e) => setBodyTemp(Number(e.target.value))}
                  aria-label={t.quickMeasure.aria.tempInput}
                  className="w-24 bg-transparent text-center text-2xl font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-cyan-400 rounded"
                />
                <button
                  type="button"
                  onClick={() => setBodyTemp((v) => Number(Math.min(43, v + 0.2).toFixed(1)))}
                  aria-label={t.quickMeasure.aria.incTemp}
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
                  aria-label={t.quickMeasure.aria.timestamp}
                  className="flex-1 min-h-[44px] bg-slate-900 border border-slate-700 rounded-lg px-2 text-xs text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setMeasuredInput(toLocalDateTimeValue(new Date()))}
                  className="min-h-[44px] px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                >
                  {t.quickMeasure.nowBtn}
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
              {t.quickMeasure.saveSpotBtn}
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
                {t.quickMeasure[feedback.msgKey]}
              </p>
            )}
          </div>
        </>
      )}

      {/* Cartucho Point-of-Care (POC) Renal / Hematológico */}
      {showPoc && (
        <div className={`${showVitals ? 'border-t border-slate-800 pt-5' : ''} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                <FlaskConical className="h-4 w-4" aria-hidden />
                <span>{t.quickMeasure.pocHeading}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t.quickMeasure.pocTip}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncCartridgeFromSnapshot}
              className="min-h-[44px] px-3 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer transition"
            >
              {t.quickMeasure.loadCurrentBtn}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1 text-xs">
              <span className="text-[11px] text-slate-400 uppercase block">
                {t.quickMeasure.cystatinLabel}
              </span>
              <input
                type="number"
                step="0.02"
                value={cistatinaC}
                onChange={(e) => setCistatinaC(Number(e.target.value))}
                className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded px-2.5 text-base font-bold tabular-nums text-slate-100"
              />
            </label>

            <label className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1 text-xs">
              <span className="text-[11px] text-slate-400 uppercase block">
                {t.quickMeasure.creatinineLabel}
              </span>
              <input
                type="number"
                step="0.02"
                value={creatinina}
                onChange={(e) => setCreatinina(Number(e.target.value))}
                className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded px-2.5 text-base font-bold tabular-nums text-slate-100"
              />
            </label>

            <label className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1 text-xs">
              <span className="text-[11px] text-slate-400 uppercase block">
                {t.quickMeasure.calciumLabel}
              </span>
              <input
                type="number"
                step="0.02"
                value={calcioIonico}
                onChange={(e) => setCalcioIonico(Number(e.target.value))}
                className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded px-2.5 text-base font-bold tabular-nums text-slate-100"
              />
            </label>

            <label className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1 text-xs">
              <span className="text-[11px] text-slate-400 uppercase block">
                {t.quickMeasure.lymphocytesLabel}
              </span>
              <input
                type="number"
                step="50"
                value={linfocitos}
                onChange={(e) => setLinfocitos(Number(e.target.value))}
                className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded px-2.5 text-base font-bold tabular-nums text-slate-100"
              />
            </label>

            <label className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1 text-xs">
              <span className="text-[11px] text-slate-400 uppercase block">
                {t.quickMeasure.neutrophilsLabel}
              </span>
              <input
                type="number"
                step="100"
                value={neutrofilos}
                onChange={(e) => setNeutrofilos(Number(e.target.value))}
                className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded px-2.5 text-base font-bold tabular-nums text-slate-100"
              />
            </label>

            <label className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-1 text-xs">
              <span className="text-[11px] text-slate-400 uppercase block">
                {t.quickMeasure.cortisolLabel}
              </span>
              <input
                type="number"
                step="0.5"
                value={cortisol}
                onChange={(e) => setCortisol(Number(e.target.value))}
                className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded px-2.5 text-base font-bold tabular-nums text-slate-100"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSaveCartridge}
              className="min-h-[48px] px-6 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm uppercase tracking-wider cursor-pointer transition"
            >
              {t.quickMeasure.logPocBtn}
            </button>

            {cartridgeFeedback && (
              <p
                role="status"
                className={`inline-flex items-center gap-2 text-xs font-semibold ${
                  cartridgeFeedback.kind === 'err' ? 'text-rose-300' : 'text-emerald-300'
                }`}
              >
                {cartridgeFeedback.kind === 'err' ? (
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                )}
                {t.quickMeasure[cartridgeFeedback.msgKey]}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Guía educativa accionable por indicador */}
      {showGuide && (
        <div className="border-t border-slate-800 pt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <BookOpen className="h-4 w-4" aria-hidden />
            <span>{t.quickMeasure.guideHeading}</span>
          </div>

          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t.quickMeasure.guideAria}>
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
                {activeGuide.unit} · {activeGuide.verified ? t.quickMeasure.verifiedRef : t.quickMeasure.prototypeThreshold}
              </span>
            </div>
            <p><strong className="text-cyan-300">{t.quickMeasure.whatMeasures}</strong> {activeGuide.whatItMeasures}</p>
            <p><strong className="text-cyan-300">{t.quickMeasure.whySpace}</strong> {activeGuide.whyInSpace}</p>
            <p><strong className="text-cyan-300">{t.quickMeasure.howMeasure}</strong> {activeGuide.howToMeasure}</p>
            <p><strong className="text-emerald-300">{t.quickMeasure.refRange}</strong> {activeGuide.referenceRange}</p>
            <p><strong className="text-amber-300">{t.quickMeasure.whenWorry}</strong> {activeGuide.whenToWorry}</p>
            <p><strong className="text-rose-300">{t.quickMeasure.whenEscalate}</strong> {activeGuide.whenToEscalate}</p>
            <p><strong className="text-slate-200">{t.quickMeasure.prevention}</strong> {activeGuide.prevention}</p>
            <p className="text-[11px] text-slate-500 pt-1">{activeGuide.sourceNote}</p>
          </div>
        </div>
      )}
    </section>
  );
}

export default QuickMeasurementPanel;
