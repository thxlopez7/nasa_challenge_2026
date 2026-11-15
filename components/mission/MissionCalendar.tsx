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
  WEEKLY_TARGET_DAYS,
  dateOfMissionDay,
  missionDayOf,
  missionWeekOf,
  phaseOfDay,
  totalDays,
  weekProgress,
  weekdayOf,
} from '../../utils/missionPlan';
import {
  buildLocalizedDiagnosis,
  formatMissionDay,
  getLocalizedEvaluationSteps,
  getLocalizedProfile,
  getLocalizedWeekdays,
} from '../../utils/missionPlanL10n';
import { formatDecimal, formatNumber } from '../../utils/formatters';
import { useT } from '../../i18n/I18nContext';
import DiagnosticPanel from './DiagnosticPanel';

/* Paleta validada (modo oscuro, superficie slate-900): cian 400/700 como
 * escala ordinal de cumplimiento y ámbar 600 para pausa médica. Siempre
 * acompañada de icono y texto: el color nunca va solo. */
type CellKind = DayStatus | 'EMPTY' | 'TODAY' | 'FUTURE';

const CELL_STYLE: Record<CellKind, { fill: string; icon: LucideIcon }> = {
  COMPLETE: { fill: 'bg-[#22d3ee]', icon: CheckCircle2 },
  PARTIAL: { fill: 'bg-[#0e7490]', icon: CircleDot },
  EXCUSED: { fill: 'bg-[#d97706]', icon: HeartPulse },
  EMPTY: { fill: 'bg-slate-800', icon: Minus },
  TODAY: { fill: 'bg-slate-800 ring-2 ring-cyan-400', icon: CircleDashed },
  FUTURE: { fill: 'border border-dashed border-slate-700', icon: CircleDashed },
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
  const { t } = useT();
  const kinds: CellKind[] = ['COMPLETE', 'PARTIAL', 'EXCUSED', 'EMPTY', 'FUTURE'];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
      {kinds.map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-sm ${CELL_STYLE[k].fill}`} aria-hidden />
          {t.missionUi.cal.cells[k]}
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
  const { lang, t } = useT();
  const isToday = date === today;
  const isFuture = date > today;
  const header = (
    <p className="text-xs uppercase tracking-wider text-cyan-500">
      {t.missionUi.cal.dayPrefix} {missionDay} · {formatMissionDay(date, lang)} · {phaseName}
    </p>
  );

  if (!record) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-1">
        {header}
        <p className="text-sm text-slate-400">
          {isToday
            ? t.missionUi.cal.todayPending
            : isFuture
              ? t.missionUi.cal.futureDay
              : t.missionUi.cal.noRecordDay}
        </p>
      </div>
    );
  }

  const v = record.vitals;
  const sr = record.selfReport;
  const Icon = CELL_STYLE[record.status].icon;
  const steps = getLocalizedEvaluationSteps(lang);
  const skipped = steps.filter((s) => record.skippedSteps.includes(s.id));

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {header}
          <p className="text-base font-bold text-slate-100 inline-flex items-center gap-2 mt-1">
            <Icon className="h-4 w-4" aria-hidden /> {t.missionUi.cal.cells[record.status]} · {formatNumber(record.xp, lang)} XP
          </p>
          {skipped.length > 0 && (
            <p className="text-xs text-slate-500">
              {t.missionUi.cal.omittedLabel} {skipped.map((s) => s.short).join(', ')}
            </p>
          )}
          {record.pauses > 0 && (
            <p className="text-xs text-slate-500">
              {t.missionUi.cal.pausesLabel} {record.pauses}
            </p>
          )}
        </div>
        {record.simulated && (
          <span className="text-[10px] uppercase tracking-wider text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
            {t.missionUi.cal.simulatedTag}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {sr && (
          <>
            <div><dt className="text-[11px] text-slate-500">{t.missionUi.cal.statSleep}</dt><dd className="tabular-nums">{formatDecimal(sr.sleepHours, 1, lang)} h{sr.sleep && ` · ${sr.sleep.efficiency}%`}</dd></div>
            {sr.sleep && (
              <>
                <div><dt className="text-[11px] text-slate-500">{t.missionUi.cal.statBreath}</dt><dd className="tabular-nums">{sr.sleep.breathingRate} rpm · {sr.sleep.breathingPauses}/h</dd></div>
                <div><dt className="text-[11px] text-slate-500">{t.missionUi.cal.statRoomTemp}</dt><dd className="tabular-nums">{formatDecimal(sr.sleep.roomTempC, 1, lang)} °C</dd></div>
              </>
            )}
            <div><dt className="text-[11px] text-slate-500">{t.missionUi.cal.statMoodFatigue}</dt><dd className="tabular-nums">{sr.mood}/5 · {sr.fatigue}/5</dd></div>
          </>
        )}
        {v && (
          <>
            <div><dt className="text-[11px] text-slate-500">{t.missionUi.cal.statHrSpo2}</dt><dd className="tabular-nums">{formatNumber(v.heartRate, lang)} bpm · {formatNumber(v.spO2, lang)}%</dd></div>
            <div><dt className="text-[11px] text-slate-500">{t.missionUi.cal.statCysC}</dt><dd className="tabular-nums">{formatDecimal(v.cistatinaC, 2, lang)} mg/L</dd></div>
            <div><dt className="text-[11px] text-slate-500">{t.missionUi.cal.statLymph}</dt><dd className="tabular-nums">{formatNumber(v.linfocitos, lang)} {t.dashboardExtra.lymphUnit}</dd></div>
            <div><dt className="text-[11px] text-slate-500">{t.missionUi.cal.statRad}</dt><dd className="tabular-nums">{formatNumber(v.radiationRate, lang)} µSv/h</dd></div>
            <div><dt className="text-[11px] text-slate-500">{t.missionUi.cal.statRadAcc}</dt><dd className="tabular-nums">{formatDecimal(v.radiationAccumulated, 1, lang)} mSv</dd></div>
            <div><dt className="text-[11px] text-slate-500">{t.missionUi.cal.statCo2}</dt><dd className="tabular-nums">{formatNumber(v.co2Level, lang)} ppm</dd></div>
          </>
        )}
      </dl>

      {v && <DiagnosticPanel diagnosis={buildLocalizedDiagnosis(v, sr, lang)} title={t.missionUi.cal.diagTitle} />}
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
  const { lang, t } = useT();
  const profile = getLocalizedProfile(mission.profileId, lang);
  const weekdays = getLocalizedWeekdays(lang);
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
        <div role="tablist" aria-label={t.missionUi.cal.viewAria} className="inline-flex rounded-lg border border-slate-700 p-0.5">
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
              {v === 'week' ? t.missionUi.cal.weekTab : t.missionUi.cal.yearTab}
            </button>
          ))}
        </div>
        <Legend />
      </div>

      {view === 'week' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <NavButton dir="prev" disabled={week <= 1} onClick={() => setWeek(week - 1)} label={t.missionUi.cal.weekPrev} />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-100">
                {t.missionUi.cal.weekPrefix} {week} {t.missionUi.cal.ofLabel} {totalWeeks}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">
                {t.missionUi.cal.goalPrefix} {Math.min(weekDone, WEEKLY_TARGET_DAYS)}/{WEEKLY_TARGET_DAYS} {t.missionUi.cal.daysUnit}
                {weekDone >= WEEKLY_TARGET_DAYS ? ` ${t.missionUi.cal.goalMetSuffix}` : ''}
              </p>
            </div>
            <NavButton dir="next" disabled={week >= totalWeeks} onClick={() => setWeek(week + 1)} label={t.missionUi.cal.weekNext} />
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekDays.map((d) => {
              const date = dateOfMissionDay(mission, d);
              const kind = kindOf(date, today, records);
              const r = records[date];
              const Icon = CELL_STYLE[kind].icon;
              const cellLabel = t.missionUi.cal.cells[kind];
              const formattedDate = formatMissionDay(date, lang);
              const done = kind === 'COMPLETE' || kind === 'EXCUSED';
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelected(d)}
                  aria-pressed={selected === d}
                  aria-label={`${t.missionUi.cal.dayPrefix} ${d}, ${formattedDate}: ${cellLabel}`}
                  className={`rounded-lg border p-2 text-left transition cursor-pointer min-w-0 ${
                    selected === d ? 'border-cyan-400 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <p className="text-[11px] text-slate-500">{weekdays[weekdayOf(date)]} · {formattedDate}</p>
                  <p className="text-sm font-bold text-slate-200">{t.missionUi.cal.dayPrefix} {d}</p>
                  <div className={`mt-2 h-1.5 rounded-full ${CELL_STYLE[kind].fill}`} aria-hidden />
                  <p className={`mt-2 text-[11px] inline-flex items-center gap-1 ${done ? 'text-slate-200' : 'text-slate-500'}`}>
                    <Icon className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate hidden sm:inline">{cellLabel}</span>
                  </p>
                  {r && <p className="text-[11px] text-slate-500 tabular-nums hidden sm:block">{formatNumber(r.xp, lang)} XP</p>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <NavButton dir="prev" disabled={year <= 1} onClick={() => setYear(year - 1)} label={t.missionUi.cal.yearPrev} />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-100">
                {t.missionUi.cal.yearPrefix} {year} {t.missionUi.cal.yearSuffix}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">
                {t.missionUi.cal.yearDaysPrefix} {yearFirst}–{yearLast} · {yearCounts.COMPLETE} {t.missionUi.cal.completedShort} ·{' '}
                {yearCounts.PARTIAL} {t.missionUi.cal.partialShort} · {yearCounts.EXCUSED} {t.missionUi.cal.excusedShort}
              </p>
            </div>
            <NavButton dir="next" disabled={year >= totalYears} onClick={() => setYear(year + 1)} label={t.missionUi.cal.yearNext} />
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="inline-block">
              <div className="flex gap-[2px] mb-2 h-5 text-[10px] text-slate-400" aria-label={t.missionUi.cal.phasesAria}>
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
                  {weekdays.map((w, i) => (
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
                    const cellLabel = t.missionUi.cal.cells[kind];
                    const formattedDate = formatMissionDay(date, lang);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelected(d)}
                        title={`${t.missionUi.cal.dayPrefix} ${d} · ${formattedDate} · ${cellLabel}`}
                        aria-label={`${t.missionUi.cal.dayPrefix} ${d}, ${formattedDate}: ${cellLabel}`}
                        className={`h-[11px] w-[11px] rounded-[2px] cursor-pointer ${CELL_STYLE[kind].fill} ${
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
