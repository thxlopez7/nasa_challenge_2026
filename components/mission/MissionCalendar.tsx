'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  CircleDot,
  HeartPulse,
  Minus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DayKey, DayRecord, DayStatus, Mission } from '../../types/mission';
import {
  EVALUATION_STEPS,
  WEEKDAY_SHORT,
  WEEKLY_TARGET_DAYS,
  buildDiagnosis,
  dateOfMissionDay,
  formatDay,
  getProfile,
  missionDayOf,
  missionWeekOf,
  phaseOfDay,
  totalDays,
  weekProgress,
  weekdayOf,
} from '../../utils/missionPlan';
import DiagnosticPanel from './DiagnosticPanel';

/* Paleta validada (modo oscuro, superficie slate-900): cian 400/700 como
 * escala ordinal de cumplimiento y ámbar 600 para pausa médica. Siempre
 * acompañada de icono y texto: el color nunca va solo. */
type CellKind = DayStatus | 'EMPTY' | 'TODAY' | 'FUTURE';

const CELL: Record<CellKind, { fill: string; label: string; icon: LucideIcon }> = {
  COMPLETE: { fill: 'bg-[#22d3ee]', label: 'Completo', icon: CheckCircle2 },
  PARTIAL: { fill: 'bg-[#0e7490]', label: 'Parcial', icon: CircleDot },
  EXCUSED: { fill: 'bg-[#d97706]', label: 'Motivo médico', icon: HeartPulse },
  EMPTY: { fill: 'bg-slate-800', label: 'Sin evaluación', icon: Minus },
  TODAY: { fill: 'bg-slate-800 ring-2 ring-cyan-400', label: 'Hoy', icon: CircleDashed },
  FUTURE: { fill: 'border border-dashed border-slate-700', label: 'Próximo', icon: CircleDashed },
};

function kindOf(
  date: DayKey,
  today: DayKey,
  records: Record<DayKey, DayRecord>
): CellKind {
  const r = records[date];
  if (r) return r.status;
  if (date === today) return 'TODAY';
  return date > today ? 'FUTURE' : 'EMPTY';
}

function Legend() {
  const kinds: CellKind[] = ['COMPLETE', 'PARTIAL', 'EXCUSED', 'EMPTY', 'FUTURE'];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
      {kinds.map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-sm ${CELL[k].fill}`} aria-hidden />
          {CELL[k].label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

function DayDetail({ record, date, today, missionDay, phaseName }: {
  record?: DayRecord;
  date: DayKey;
  today: DayKey;
  missionDay: number;
  phaseName: string;
}) {
  const isToday = date === today;
  const isFuture = date > today;
  const header = (
    <p className="text-xs uppercase tracking-wider text-cyan-500">
      Día {missionDay} · {formatDay(date)} · {phaseName}
    </p>
  );

  if (!record) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-1">
        {header}
        <p className="text-sm text-slate-400">
          {isToday
            ? 'La evaluación de hoy está pendiente: ábrela en la pestaña «Hoy».'
            : isFuture
              ? 'Día futuro de la misión.'
              : 'No hay evaluación registrada este día.'}
        </p>
      </div>
    );
  }

  const v = record.vitals;
  const sr = record.selfReport;
  const Icon = CELL[record.status].icon;
  const skipped = EVALUATION_STEPS.filter((s) => record.skippedSteps.includes(s.id));

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {header}
          <p className="text-base font-bold text-slate-100 inline-flex items-center gap-2 mt-1">
            <Icon className="h-4 w-4" aria-hidden /> {CELL[record.status].label} · {record.xp} XP
          </p>
          {skipped.length > 0 && (
            <p className="text-xs text-slate-500">Omitido: {skipped.map((s) => s.short).join(', ')}</p>
          )}
          {record.pauses > 0 && (
            <p className="text-xs text-slate-500">Pausas: {record.pauses}</p>
          )}
        </div>
        {record.simulated && (
          <span className="text-[10px] uppercase tracking-wider text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
            Simulado
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {sr && (
          <>
            <div><dt className="text-[11px] text-slate-500">Sueño</dt><dd className="tabular-nums">{sr.sleepHours} h{sr.sleep && ` · ${sr.sleep.efficiency}%`}</dd></div>
            {sr.sleep && (
              <>
                <div><dt className="text-[11px] text-slate-500">Respiración · pausas</dt><dd className="tabular-nums">{sr.sleep.breathingRate} rpm · {sr.sleep.breathingPauses}/h</dd></div>
                <div><dt className="text-[11px] text-slate-500">Temp. del módulo</dt><dd className="tabular-nums">{sr.sleep.roomTempC} °C</dd></div>
              </>
            )}
            <div><dt className="text-[11px] text-slate-500">Ánimo · Fatiga</dt><dd className="tabular-nums">{sr.mood}/5 · {sr.fatigue}/5</dd></div>
          </>
        )}
        {v && (
          <>
            <div><dt className="text-[11px] text-slate-500">FC · SpO2</dt><dd className="tabular-nums">{v.heartRate} bpm · {v.spO2}%</dd></div>
            <div><dt className="text-[11px] text-slate-500">Cistatina C</dt><dd className="tabular-nums">{v.cistatinaC.toFixed(2)} mg/L</dd></div>
            <div><dt className="text-[11px] text-slate-500">Linfocitos</dt><dd className="tabular-nums">{v.linfocitos} cél/µL</dd></div>
            <div><dt className="text-[11px] text-slate-500">Radiación</dt><dd className="tabular-nums">{v.radiationRate} µSv/h</dd></div>
            <div><dt className="text-[11px] text-slate-500">Dosis acumulada</dt><dd className="tabular-nums">{v.radiationAccumulated} mSv</dd></div>
            <div><dt className="text-[11px] text-slate-500">CO2</dt><dd className="tabular-nums">{v.co2Level} ppm</dd></div>
          </>
        )}
      </dl>

      {v && <DiagnosticPanel diagnosis={buildDiagnosis(v, sr)} title="Diagnóstico registrado" />}
    </div>
  );
}

function NavButton({ dir, disabled, onClick, label }: {
  dir: 'prev' | 'next'; disabled: boolean; onClick: () => void; label: string;
}) {
  return (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="h-8 w-8 rounded-lg border border-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
  >
    {dir === 'prev' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
  </button>
);
}

/* ------------------------------------------------------------------ */

export function MissionCalendar({
  mission,
  records,
  today,
}: {
  mission: Mission;
  records: Record<DayKey, DayRecord>;
  today: DayKey;
}) {
  const profile = getProfile(mission.profileId);
  const total = totalDays(profile);
  const lastDay = mission.endedOn ? missionDayOf(mission, mission.endedOn) : total;
  const todayDay = Math.min(Math.max(1, missionDayOf(mission, today)), lastDay);
  const totalWeeks = missionWeekOf(total);
  const totalYears = Math.ceil(total / 365);

  const [view, setView] = useState<'week' | 'year'>('week');
  const [week, setWeek] = useState(missionWeekOf(todayDay));
  const [year, setYear] = useState(Math.ceil(todayDay / 365));
  const [selected, setSelected] = useState(todayDay);

  const selectedDate = dateOfMissionDay(mission, selected);
  const selectedPhase = phaseOfDay(profile, selected).phase.name;

  /* ---------- Semana ---------- */
  const weekDays = Array.from({ length: 7 }, (_, i) => (week - 1) * 7 + i + 1).filter(
    (d) => d <= total
  );
  const weekDone = weekProgress(records, week);

  /* ---------- Año (columnas = semanas de calendario, filas = L…D) ---------- */
  const yearFirst = (year - 1) * 365 + 1;
  const yearLast = Math.min(year * 365, total);
  const firstDate = dateOfMissionDay(mission, yearFirst);
  const offset = weekdayOf(firstDate);
  const yearCells = Array.from({ length: offset + yearLast - yearFirst + 1 }, (_, i) =>
    i < offset ? null : yearFirst + i - offset
  );
  const columns = Math.ceil(yearCells.length / 7);
  const yearRecords = Object.values(records).filter(
    (r) => r.missionDay >= yearFirst && r.missionDay <= yearLast
  );
  const yearCounts = {
    COMPLETE: yearRecords.filter((r) => r.status === 'COMPLETE').length,
    PARTIAL: yearRecords.filter((r) => r.status === 'PARTIAL').length,
    EXCUSED: yearRecords.filter((r) => r.status === 'EXCUSED').length,
  };

  // Franja de fases del año: tramos proporcionales a los días de cada fase.
  const phaseSegments = profile.phases
    .map((p, i) => {
      const start = profile.phases.slice(0, i).reduce((s, x) => s + x.days, 0) + 1;
      const end = start + p.days - 1;
      const from = Math.max(start, yearFirst);
      const to = Math.min(end, yearLast);
      return { name: p.name, days: to - from + 1 };
    })
    .filter((s) => s.days > 0);


  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Vista del calendario" className="inline-flex rounded-lg border border-slate-700 p-0.5">
          {(['week', 'year'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold cursor-pointer ${
                view === v ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v === 'week' ? 'Semana' : 'Año'}
            </button>
          ))}
        </div>
        <Legend />
      </div>

      {view === 'week' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <NavButton dir="prev" disabled={week <= 1} onClick={() => setWeek(week - 1)} label="Semana anterior" />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-100">
                Semana {week} de {totalWeeks}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">
                Meta {Math.min(weekDone, WEEKLY_TARGET_DAYS)}/{WEEKLY_TARGET_DAYS} días
                {weekDone >= WEEKLY_TARGET_DAYS ? ' · cumplida' : ''}
              </p>
            </div>
            <NavButton dir="next" disabled={week >= totalWeeks} onClick={() => setWeek(week + 1)} label="Semana siguiente" />
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekDays.map((d) => {
              const date = dateOfMissionDay(mission, d);
              const kind = kindOf(date, today, records);
              const r = records[date];
              const Icon = CELL[kind].icon;
              const done = kind === 'COMPLETE' || kind === 'EXCUSED';
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelected(d)}
                  aria-pressed={selected === d}
                  aria-label={`Día ${d}, ${formatDay(date)}: ${CELL[kind].label}`}
                  className={`rounded-lg border p-2 text-left transition cursor-pointer min-w-0 ${
                    selected === d ? 'border-cyan-400 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <p className="text-[11px] text-slate-500">{WEEKDAY_SHORT[weekdayOf(date)]} · {formatDay(date)}</p>
                  <p className="text-sm font-bold text-slate-200">Día {d}</p>
                  <div className={`mt-2 h-1.5 rounded-full ${CELL[kind].fill}`} aria-hidden />
                  <p className={`mt-2 text-[11px] inline-flex items-center gap-1 ${done ? 'text-slate-200' : 'text-slate-500'}`}>
                    <Icon className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate hidden sm:inline">{CELL[kind].label}</span>
                  </p>
                  {r && <p className="text-[11px] text-slate-500 tabular-nums hidden sm:block">{r.xp} XP</p>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <NavButton dir="prev" disabled={year <= 1} onClick={() => setYear(year - 1)} label="Año anterior" />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-100">Año {year} de misión</p>
              <p className="text-xs text-slate-400 tabular-nums">
                Días {yearFirst}–{yearLast} · {yearCounts.COMPLETE} completos ·{' '}
                {yearCounts.PARTIAL} parciales · {yearCounts.EXCUSED} médicos
              </p>
            </div>
            <NavButton dir="next" disabled={year >= totalYears} onClick={() => setYear(year + 1)} label="Año siguiente" />
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="inline-block">
              <div className="flex gap-[2px] mb-2 h-5 text-[10px] text-slate-400" aria-label="Fases del año">
                {phaseSegments.map((s, i) => (
                  <div
                    key={s.name}
                    className={`rounded-sm px-1.5 flex items-center overflow-hidden whitespace-nowrap ${i % 2 ? 'bg-slate-800' : 'bg-slate-800/50'}`}
                    style={{ width: `${(s.days / (yearLast - yearFirst + 1)) * columns * 13}px` }}
                  >
                    {s.name}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="grid grid-rows-7 gap-[2px] text-[10px] text-slate-500">
                  {WEEKDAY_SHORT.map((w, i) => (
                    <span key={w + i} className="h-[11px] leading-[11px]">{i % 2 === 0 ? w : ''}</span>
                  ))}
                </div>
                <div
                  className="grid grid-rows-7 grid-flow-col gap-[2px]"
                  style={{ gridTemplateColumns: `repeat(${columns}, 11px)` }}
                >
                  {yearCells.map((d, i) => {
                    if (d === null) return <span key={`pad-${i}`} className="h-[11px] w-[11px]" />;
                    const date = dateOfMissionDay(mission, d);
                    const kind = kindOf(date, today, records);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelected(d)}
                        title={`Día ${d} · ${formatDay(date)} · ${CELL[kind].label}`}
                        aria-label={`Día ${d}, ${formatDay(date)}: ${CELL[kind].label}`}
                        className={`h-[11px] w-[11px] rounded-[2px] cursor-pointer ${CELL[kind].fill} ${
                          selected === d ? 'outline-2 outline-offset-1 outline-white' : ''
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <DayDetail
        record={records[selectedDate]}
        date={selectedDate}
        today={today}
        missionDay={selected}
        phaseName={selectedPhase}
      />
    </div>
  );
}

export default MissionCalendar;
