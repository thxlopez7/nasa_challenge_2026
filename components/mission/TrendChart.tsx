'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SupportedLang } from '../../config/missionComms';
import { useT } from '../../i18n/I18nContext';
import type { DayKey, DayRecord } from '../../types/mission';
import { RIDGE_THRESHOLDS as T, computeNlr } from '../../utils/clinicalEngine';
import { formatDateShort, formatDecimal } from '../../utils/formatters';
import { SLEEP_THRESHOLDS as SL } from '../../utils/sleepSensing';

type MetricId =
  | 'cistatinaC'
  | 'calcioIonico'
  | 'linfocitos'
  | 'nlr'
  | 'heartRate'
  | 'hrvRmssdMs'
  | 'ctxNtxIndex'
  | 'p1npIndex'
  | 'radiationAccumulated'
  | 'sleepHours'
  | 'sleepEfficiency'
  | 'breathingRate'
  | 'breathingPauses'
  | 'roomTemp'
  | 'mood'
  | 'fatigue';

type GroupId = 'bio' | 'env' | 'sleep' | 'self';

interface MetricDef {
  label: { es: string; en: string };
  unit: { es: string; en: string };
  group: GroupId;
  read: (r: DayRecord) => number | undefined;
  threshold?: { value: number; label: { es: string; en: string } };
  digits: number;
  why: { es: string; en: string };
}

const METRICS: Record<MetricId, MetricDef> = {
  cistatinaC: {
    label: { es: 'Cistatina C', en: 'Cystatin C' },
    unit: { es: 'mg/L', en: 'mg/L' },
    group: 'bio',
    digits: 2,
    read: (r) => r.vitals?.cistatinaC,
    threshold: {
      value: T.renal.minCistatinaC,
      label: { es: `R1 > ${T.renal.minCistatinaC}`, en: `R1 > ${T.renal.minCistatinaC}` },
    },
    why: {
      es: 'Marcador renal mucho menos dependiente de la masa muscular; puede subir aunque la creatinina basal baje en microgravedad.',
      en: 'Renal filtration marker independent of muscle mass; rises even if creatinine falls in microgravity.',
    },
  },
  calcioIonico: {
    label: { es: 'Calcio iónico', en: 'Ionized Calcium' },
    unit: { es: 'mmol/L', en: 'mmol/L' },
    group: 'bio',
    digits: 2,
    read: (r) => r.vitals?.calcioIonico,
    threshold: {
      value: T.renal.minCalcioIonico,
      label: { es: `R1 > ${T.renal.minCalcioIonico}`, en: `R1 > ${T.renal.minCalcioIonico}` },
    },
    why: {
      es: 'Sube con la resorción ósea: refleja la pérdida de hueso sin carga.',
      en: 'Elevates during bone demineralization in reduced gravity, increasing renal stone risk.',
    },
  },
  linfocitos: {
    label: { es: 'Linfocitos', en: 'Lymphocytes' },
    unit: { es: 'cél/µL', en: 'cells/µL' },
    group: 'bio',
    digits: 0,
    read: (r) => r.vitals?.linfocitos,
    threshold: {
      value: T.radiation.maxLinfocitos,
      label: { es: `R2 < ${T.radiation.maxLinfocitos}`, en: `R2 < ${T.radiation.maxLinfocitos}` },
    },
    why: {
      es: 'Caen tras exposición a radiación: indicador de inmunosupresión.',
      en: 'Drop rapidly after ionizing radiation exposure: early immunosuppression signal.',
    },
  },
  nlr: {
    label: { es: 'Ratio N/L (NLR)', en: 'N/L Ratio (NLR)' },
    unit: { es: '', en: '' },
    group: 'bio',
    digits: 2,
    read: (r) => (r.vitals ? computeNlr(r.vitals) : undefined),
    threshold: {
      value: T.radiation.minNlr,
      label: { es: `R2 > ${T.radiation.minNlr}`, en: `R2 > ${T.radiation.minNlr}` },
    },
    why: {
      es: 'Neutrófilos / linfocitos: marcador de estrés inmunitario.',
      en: 'Neutrophils-to-lymphocytes ratio: systemic stress and immune response marker.',
    },
  },
  heartRate: {
    label: { es: 'Frecuencia cardíaca', en: 'Heart Rate' },
    unit: { es: 'lpm', en: 'bpm' },
    group: 'bio',
    digits: 0,
    read: (r) => r.vitals?.heartRate,
    why: {
      es: 'Tendencia en reposo: ayuda a ver estrés y desacondicionamiento.',
      en: 'Resting HR trend: helps track stress load and cardiovascular deconditioning.',
    },
  },
  hrvRmssdMs: {
    label: { es: 'HRV (RMSSD)', en: 'HRV (RMSSD)' },
    unit: { es: 'ms', en: 'ms' },
    group: 'bio',
    digits: 0,
    read: (r) => r.vitals?.hrvRmssdMs,
    threshold: { value: 25, label: { es: 'Bajo < 25 ms', en: 'Low < 25 ms' } },
    why: {
      es: 'Variabilidad cardíaca parasimpática: cae con desacondicionamiento y estrés acumulado.',
      en: 'Parasympathetic heart rate variability: drops with deconditioning and cumulative strain.',
    },
  },
  ctxNtxIndex: {
    label: { es: 'Resorción CTX/NTX', en: 'Resorption CTX/NTX' },
    unit: { es: 'idx', en: 'idx' },
    group: 'bio',
    digits: 2,
    read: (r) => r.vitals?.ctxNtxIndex,
    threshold: { value: 1.35, label: { es: 'Alerta ≥ 1,35', en: 'Alert ≥ 1.35' } },
    why: {
      es: 'Marcador bioquímico de resorción ósea en 0 g (DXA no disponible a bordo).',
      en: 'Biochemical bone resorption proxy in 0g (no onboard DXA scanner).',
    },
  },
  p1npIndex: {
    label: { es: 'Formación ósea P1NP', en: 'Bone Formation P1NP' },
    unit: { es: 'idx', en: 'idx' },
    group: 'bio',
    digits: 2,
    read: (r) => r.vitals?.p1npIndex,
    threshold: { value: 0.75, label: { es: 'Bajo ≤ 0,75', en: 'Low ≤ 0.75' } },
    why: {
      es: 'Marcador bioquímico de formación osteoblástica frente a carga ARED.',
      en: 'Osteoblastic bone-formation marker reflecting response to ARED loading.',
    },
  },
  radiationAccumulated: {
    label: { es: 'Dosis acumulada', en: 'Accumulated Dose' },
    unit: { es: 'mSv', en: 'mSv' },
    group: 'env',
    digits: 1,
    read: (r) => r.vitals?.radiationAccumulated,
    why: {
      es: 'Dosis total de la misión; los eventos solares se ven como escalones.',
      en: 'Cumulative mission radiation dose; solar particle events appear as step increases.',
    },
  },
  sleepHours: {
    label: { es: 'Horas de sueño', en: 'Sleep Duration' },
    unit: { es: 'h', en: 'h' },
    group: 'sleep',
    digits: 1,
    read: (r) => r.selfReport?.sleepHours,
    threshold: {
      value: SL.minHours,
      label: { es: `Sueño corto < ${SL.minHours} h`, en: `Short sleep < ${SL.minHours} h` },
    },
    why: {
      es: 'El sueño corto repetido merece comentarse con el cirujano de vuelo.',
      en: 'Repeated short sleep should be reviewed with the flight surgeon.',
    },
  },
  sleepEfficiency: {
    label: { es: 'Eficiencia del sueño', en: 'Sleep Efficiency' },
    unit: { es: '%', en: '%' },
    group: 'sleep',
    digits: 0,
    read: (r) => r.selfReport?.sleep?.efficiency,
    threshold: {
      value: SL.minEfficiency,
      label: { es: `Fragmentado < ${SL.minEfficiency}%`, en: `Fragmented < ${SL.minEfficiency}%` },
    },
    why: {
      es: 'Tiempo dormido sobre tiempo en el saco: baja con ruido, luz, CO₂ o estrés.',
      en: 'Time asleep over time in berth: drops with noise, CO₂ buildup, or stress.',
    },
  },
  breathingRate: {
    label: { es: 'Respiración dormido', en: 'Sleep Breathing Rate' },
    unit: { es: 'rpm', en: 'rpm' },
    group: 'sleep',
    digits: 1,
    read: (r) => r.selfReport?.sleep?.breathingRate,
    threshold: {
      value: SL.breathingRate.max,
      label: { es: `Alta > ${SL.breathingRate.max} rpm`, en: `High > ${SL.breathingRate.max} rpm` },
    },
    why: {
      es: 'Medida por el eco ultrasónico del pecho; sube con CO₂ alto o fiebre.',
      en: 'Measured via ultrasonic chest echo; increases with elevated CO₂ or fever.',
    },
  },
  breathingPauses: {
    label: { es: 'Pausas respiratorias', en: 'Breathing Pauses' },
    unit: { es: '/h', en: '/h' },
    group: 'sleep',
    digits: 1,
    read: (r) => r.selfReport?.sleep?.breathingPauses,
    threshold: {
      value: SL.maxBreathingPauses,
      label: { es: `Aviso ≥ ${SL.maxBreathingPauses} /h`, en: `Alert ≥ ${SL.maxBreathingPauses} /h` },
    },
    why: {
      es: 'Pausas al respirar mientras duermes: vigila la ventilación del módulo.',
      en: 'Overnight breathing pauses: inspect berth ventilation immediately.',
    },
  },
  roomTemp: {
    label: { es: 'Temperatura del módulo', en: 'Module Temperature' },
    unit: { es: '°C', en: '°C' },
    group: 'env',
    digits: 1,
    read: (r) => r.selfReport?.sleep?.roomTempC,
    threshold: {
      value: SL.roomTemp.max,
      label: { es: `Cálido > ${SL.roomTemp.max} °C`, en: `Warm > ${SL.roomTemp.max} °C` },
    },
    why: {
      es: 'Temperatura media nocturna del módulo de descanso, medida por el sensor.',
      en: 'Average overnight sleeping module temperature measured by environmental sensor.',
    },
  },
  mood: {
    label: { es: 'Ánimo', en: 'Mood' },
    unit: { es: '/5', en: '/5' },
    group: 'self',
    digits: 0,
    read: (r) => r.selfReport?.mood,
    threshold: { value: 2, label: { es: 'Ánimo bajo ≤ 2', en: 'Low mood ≤ 2' } },
    why: {
      es: 'El aislamiento prolongado puede bajar el ánimo a mitad de misión.',
      en: 'Extended isolation can depress mood around mission mid-point.',
    },
  },
  fatigue: {
    label: { es: 'Fatiga', en: 'Fatigue' },
    unit: { es: '/5', en: '/5' },
    group: 'self',
    digits: 0,
    read: (r) => r.selfReport?.fatigue,
    threshold: { value: 4, label: { es: 'Fatiga alta ≥ 4', en: 'High fatigue ≥ 4' } },
    why: {
      es: 'Fatiga alta sostenida: señal para adaptar la carga.',
      en: 'Sustained high fatigue signals a need to adjust physical/EVA workload.',
    },
  },
};

const fmt = (v: number, digits: number, lang: SupportedLang) =>
  formatDecimal(v, digits, lang);

export function TrendChart({ records }: { records: Record<DayKey, DayRecord> }) {
  const { t, lang } = useT();
  const tr = t.missionUi.trend;
  const [metric, setMetric] = useState<MetricId>('cistatinaC');
  const [range, setRange] = useState<number>(90);
  const def = METRICS[metric];

  const sorted = useMemo(
    () => Object.values(records).sort((a, b) => a.missionDay - b.missionDay),
    [records]
  );
  const lastDay = sorted.at(-1)?.missionDay ?? 0;

  const data = sorted
    .filter((r) => range === 0 || r.missionDay > lastDay - range)
    .map((r) => ({ day: r.missionDay, date: r.date, value: def.read(r) }))
    .filter(
      (p): p is { day: number; date: string; value: number } =>
        p.value !== undefined && Number.isFinite(p.value)
    );

  const values = data.map((d) => d.value);
  const latest = values.at(-1);
  const first = values[0];
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;

  const groups: GroupId[] = ['bio', 'env', 'sleep', 'self'];
  const ranges = [
    { id: 7, label: tr.ranges.d7 },
    { id: 30, label: tr.ranges.d30 },
    { id: 90, label: tr.ranges.d90 },
    { id: 0, label: tr.ranges.all },
  ];

  const statRows: Array<{ id: 'latest' | 'avg' | 'change'; label: string; val: number | undefined }> = [
    { id: 'latest', label: tr.statLatest, val: latest },
    { id: 'avg', label: tr.statAvg, val: avg },
    {
      id: 'change',
      label: tr.statChange,
      val: latest !== undefined && first !== undefined ? latest - first : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400 inline-flex items-center gap-2">
          {tr.metricLabel}
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricId)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100"
          >
            {groups.map((g) => (
              <optgroup key={g} label={tr.groups[g]}>
                {(Object.keys(METRICS) as MetricId[])
                  .filter((id) => METRICS[id].group === g)
                  .map((id) => (
                    <option key={id} value={id}>
                      {METRICS[id].label[lang]}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div role="group" aria-label={tr.rangeAria} className="inline-flex rounded-lg border border-slate-700 p-0.5">
          {ranges.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={range === r.id}
              onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                range === r.id ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-bold text-slate-100">
          {def.label[lang]}
          {def.unit[lang] && <span className="text-slate-500 font-normal"> ({def.unit[lang]})</span>}
        </h4>
        <p className="text-xs text-slate-400">{def.why[lang]}</p>
      </div>

      {data.length < 2 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
          {tr.minDataHint}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {statRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <dt className="text-[11px] uppercase text-slate-500">{row.label}</dt>
                <dd className="text-lg font-bold text-slate-100 tabular-nums">
                  {row.val === undefined
                    ? '—'
                    : `${row.id === 'change' && row.val > 0 ? '+' : ''}${fmt(row.val, def.digits, lang)}`}
                </dd>
              </div>
            ))}
          </dl>

          <div className="h-64" role="img" aria-label={def.label[lang]}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="day"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(d) => `D${d}`}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => fmt(v, def.digits, lang)}
                />
                {def.threshold && (
                  <ReferenceLine
                    y={def.threshold.value}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    label={{
                      value: def.threshold.label[lang],
                      fill: '#fbbf24',
                      fontSize: 11,
                      position: 'insideTopRight',
                    }}
                  />
                )}
                <Tooltip
                  cursor={{ stroke: '#475569' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { day: number; date: string; value: number };
                    return (
                      <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs shadow-lg">
                        <p className="text-slate-400">
                          {tr.dayPrefix} {p.day} · {formatDateShort(p.date, lang)}
                        </p>
                        <p className="text-slate-100 font-semibold tabular-nums">
                          {fmt(p.value, def.digits, lang)} {def.unit[lang]}
                        </p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: '#0f172a', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer">{tr.tableToggle}</summary>
            <div className="max-h-48 overflow-y-auto mt-2">
              <table className="w-full text-left tabular-nums">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1">{tr.colDay}</th>
                    <th>{tr.colDate}</th>
                    <th>{def.label[lang]}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((d) => (
                    <tr key={d.day} className="border-t border-slate-800">
                      <td className="py-1">{d.day}</td>
                      <td>{formatDateShort(d.date, lang)}</td>
                      <td>
                        {fmt(d.value, def.digits, lang)} {def.unit[lang]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

export default TrendChart;
