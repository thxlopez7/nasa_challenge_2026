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
import type { DayKey, DayRecord } from '../../types/mission';
import { RIDGE_THRESHOLDS as T, computeNlr } from '../../utils/clinicalEngine';
import { formatDay } from '../../utils/missionPlan';
import { SLEEP_THRESHOLDS as SL } from '../../utils/sleepSensing';

type MetricId =
  | 'cistatinaC'
  | 'calcioIonico'
  | 'linfocitos'
  | 'nlr'
  | 'heartRate'
  | 'radiationAccumulated'
  | 'sleepHours'
  | 'sleepEfficiency'
  | 'breathingRate'
  | 'breathingPauses'
  | 'roomTemp'
  | 'mood'
  | 'fatigue';

interface MetricDef {
  label: string;
  unit: string;
  group: 'Biomarcadores' | 'Entorno' | 'Sueño (sensor)' | 'Autoevaluación';
  read: (r: DayRecord) => number | undefined;
  threshold?: { value: number; label: string };
  digits: number;
  why: string;
}

const METRICS: Record<MetricId, MetricDef> = {
  cistatinaC: {
    label: 'Cistatina C', unit: 'mg/L', group: 'Biomarcadores', digits: 2,
    read: (r) => r.vitals?.cistatinaC,
    threshold: { value: T.renal.minCistatinaC, label: `R1 > ${T.renal.minCistatinaC}` },
    why: 'Función renal: en microgravedad puede subir aunque la creatinina siga normal.',
  },
  calcioIonico: {
    label: 'Calcio iónico', unit: 'mmol/L', group: 'Biomarcadores', digits: 2,
    read: (r) => r.vitals?.calcioIonico,
    threshold: { value: T.renal.minCalcioIonico, label: `R1 > ${T.renal.minCalcioIonico}` },
    why: 'Sube con la resorción ósea: refleja la pérdida de hueso sin carga.',
  },
  linfocitos: {
    label: 'Linfocitos', unit: 'cél/µL', group: 'Biomarcadores', digits: 0,
    read: (r) => r.vitals?.linfocitos,
    threshold: { value: T.radiation.maxLinfocitos, label: `R2 < ${T.radiation.maxLinfocitos}` },
    why: 'Caen tras exposición a radiación: indicador de inmunosupresión.',
  },
  nlr: {
    label: 'Ratio N/L (NLR)', unit: '', group: 'Biomarcadores', digits: 2,
    read: (r) => (r.vitals ? computeNlr(r.vitals) : undefined),
    threshold: { value: T.radiation.minNlr, label: `R2 > ${T.radiation.minNlr}` },
    why: 'Neutrófilos / linfocitos: marcador de estrés inmunitario.',
  },
  heartRate: {
    label: 'Frecuencia cardíaca', unit: 'bpm', group: 'Biomarcadores', digits: 0,
    read: (r) => r.vitals?.heartRate,
    why: 'Tendencia en reposo: ayuda a ver estrés y desacondicionamiento.',
  },
  radiationAccumulated: {
    label: 'Dosis acumulada', unit: 'mSv', group: 'Entorno', digits: 1,
    read: (r) => r.vitals?.radiationAccumulated,
    why: 'Dosis total de la misión; los eventos solares se ven como escalones.',
  },
  sleepHours: {
    label: 'Horas de sueño', unit: 'h', group: 'Sueño (sensor)', digits: 1,
    read: (r) => r.selfReport?.sleepHours,
    threshold: { value: SL.minHours, label: `Sueño corto < ${SL.minHours} h` },
    why: 'El sueño corto repetido merece comentarse con el cirujano de vuelo.',
  },
  sleepEfficiency: {
    label: 'Eficiencia del sueño', unit: '%', group: 'Sueño (sensor)', digits: 0,
    read: (r) => r.selfReport?.sleep?.efficiency,
    threshold: { value: SL.minEfficiency, label: `Fragmentado < ${SL.minEfficiency}%` },
    why: 'Tiempo dormido sobre tiempo en el saco: baja con ruido, luz, CO2 o estrés.',
  },
  breathingRate: {
    label: 'Respiración dormido', unit: 'rpm', group: 'Sueño (sensor)', digits: 1,
    read: (r) => r.selfReport?.sleep?.breathingRate,
    threshold: { value: SL.breathingRate.max, label: `Alta > ${SL.breathingRate.max} rpm` },
    why: 'Medida por el eco ultrasónico del pecho; sube con CO2 alto o fiebre.',
  },
  breathingPauses: {
    label: 'Pausas respiratorias', unit: '/h', group: 'Sueño (sensor)', digits: 1,
    read: (r) => r.selfReport?.sleep?.breathingPauses,
    threshold: { value: SL.maxBreathingPauses, label: `Aviso ≥ ${SL.maxBreathingPauses} /h` },
    why: 'Pausas al respirar mientras duermes: vigila la ventilación del módulo.',
  },
  roomTemp: {
    label: 'Temperatura del módulo', unit: '°C', group: 'Entorno', digits: 1,
    read: (r) => r.selfReport?.sleep?.roomTempC,
    threshold: { value: SL.roomTemp.max, label: `Cálido > ${SL.roomTemp.max} °C` },
    why: 'Temperatura media nocturna del módulo de descanso, medida por el sensor.',
  },
  mood: {
    label: 'Ánimo', unit: '/5', group: 'Autoevaluación', digits: 0,
    read: (r) => r.selfReport?.mood,
    threshold: { value: 2, label: 'Ánimo bajo ≤ 2' },
    why: 'El aislamiento prolongado puede bajar el ánimo a mitad de misión.',
  },
  fatigue: {
    label: 'Fatiga', unit: '/5', group: 'Autoevaluación', digits: 0,
    read: (r) => r.selfReport?.fatigue,
    threshold: { value: 4, label: 'Fatiga alta ≥ 4' },
    why: 'Fatiga alta sostenida: señal para adaptar la carga.',
  },
};

const RANGES = [
  { id: 7, label: '7 días' },
  { id: 30, label: '30 días' },
  { id: 90, label: '90 días' },
  { id: 0, label: 'Todo' },
] as const;

const fmt = (v: number, digits: number) =>
  Number.isFinite(v) ? v.toFixed(digits) : '∞';

export function TrendChart({ records }: { records: Record<DayKey, DayRecord> }) {
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
    .filter((p): p is { day: number; date: string; value: number } =>
      p.value !== undefined && Number.isFinite(p.value)
    );

  const values = data.map((d) => d.value);
  const latest = values.at(-1);
  const first = values[0];
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;

  const groups = ['Biomarcadores', 'Entorno', 'Sueño (sensor)', 'Autoevaluación'] as const;

  return (
    <div className="space-y-4">
      {/* Filtros en una sola fila */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400 inline-flex items-center gap-2">
          Métrica
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricId)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100"
          >
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {(Object.keys(METRICS) as MetricId[])
                  .filter((id) => METRICS[id].group === g)
                  .map((id) => (
                    <option key={id} value={id}>{METRICS[id].label}</option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Rango de tiempo" className="inline-flex rounded-lg border border-slate-700 p-0.5">
          {RANGES.map((r) => (
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
          {def.label}{def.unit && <span className="text-slate-500 font-normal"> ({def.unit})</span>}
        </h4>
        <p className="text-xs text-slate-400">{def.why}</p>
      </div>

      {data.length < 2 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
          Necesitas al menos 2 evaluaciones con este dato para ver una tendencia.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {[
              ['Último', latest],
              ['Media', avg],
              ['Cambio', latest !== undefined && first !== undefined ? latest - first : undefined],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <dt className="text-[11px] uppercase text-slate-500">{k as string}</dt>
                <dd className="text-lg font-bold text-slate-100 tabular-nums">
                  {v === undefined
                    ? '—'
                    : `${k === 'Cambio' && (v as number) > 0 ? '+' : ''}${fmt(v as number, def.digits)}`}
                </dd>
              </div>
            ))}
          </dl>

          <div className="h-64" role="img" aria-label={`Tendencia de ${def.label} por día de misión`}>
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
                  tickFormatter={(v) => fmt(v, def.digits)}
                />
                {def.threshold && (
                  <ReferenceLine
                    y={def.threshold.value}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    label={{ value: def.threshold.label, fill: '#fbbf24', fontSize: 11, position: 'insideTopRight' }}
                  />
                )}
                <Tooltip
                  cursor={{ stroke: '#475569' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { day: number; date: string; value: number };
                    return (
                      <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs shadow-lg">
                        <p className="text-slate-400">Día {p.day} · {formatDay(p.date)}</p>
                        <p className="text-slate-100 font-semibold tabular-nums">
                          {fmt(p.value, def.digits)} {def.unit}
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
            <summary className="cursor-pointer">Ver datos en tabla</summary>
            <div className="max-h-48 overflow-y-auto mt-2">
              <table className="w-full text-left tabular-nums">
                <thead className="text-slate-500">
                  <tr><th className="py-1">Día</th><th>Fecha</th><th>{def.label}</th></tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((d) => (
                    <tr key={d.day} className="border-t border-slate-800">
                      <td className="py-1">{d.day}</td>
                      <td>{formatDay(d.date)}</td>
                      <td>{fmt(d.value, def.digits)} {def.unit}</td>
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
