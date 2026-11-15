import type { SupportedLang } from '../config/missionComms';
import type {
  Achievement,
  DayKey,
  DayRecord,
  Diagnosis,
  EvaluationStepId,
  Finding,
  Mission,
  MissionProfile,
  MissionProfileId,
  Rank,
  SelfReport,
} from '../types/mission';
import type { TelemetryData } from '../types/telemetry';
import { RIDGE_THRESHOLDS as T, computeNlr } from './clinicalEngine';
import { formatDateShort, formatDecimal } from './formatters';
import {
  EVALUATION_STEPS,
  MISSION_PROFILES,
  RANKS,
  WEEKDAY_SHORT,
  WEEKLY_TARGET_DAYS,
  computeAchievements,
  getProfile,
  rankFor,
  type StepDefinition,
} from './missionPlan';
import { SLEEP_THRESHOLDS } from './sleepSensing';

const EN_PROFILES: Record<
  MissionProfileId,
  { name: string; summary: string; phases: Record<string, { name: string; description: string }> }
> = {
  ISS_6M: {
    name: 'ISS Expedition · 6 months',
    summary: 'Low Earth Orbit. Ideal to validate crew routines and countermeasures.',
    phases: {
      LEO: {
        name: 'Low Earth Orbit',
        description: 'Continuous microgravity with real-time ground support.',
      },
    },
  },
  LUNAR_ARTEMIS: {
    name: 'Moon · Artemis Base Camp',
    summary: 'Short transit, lunar south pole stay, and return: ~6 weeks.',
    phases: {
      TRANSIT_OUT: {
        name: 'Transit to Moon',
        description: 'Microgravity and passage through the Van Allen radiation belts.',
      },
      SURFACE: {
        name: 'Lunar Surface (South Pole)',
        description: '0.16 g gravity, abrasive lunar regolith, and ~1.3 s comm delay.',
      },
      TRANSIT_BACK: {
        name: 'Return to Earth',
        description: 'Re-entry and readaptation to 1 g after lunar stay.',
      },
    },
  },
  MARS_CONJUNCTION: {
    name: 'Mars · Conjunction Class',
    summary: 'Outbound transit, extended surface stay, and return: ~2.5 years.',
    phases: {
      TRANSIT_OUT: {
        name: 'Transit to Mars',
        description: 'Deep-space microgravity and radiation without Earth magnetic shield.',
      },
      SURFACE: {
        name: 'Martian Surface',
        description: '0.38 g gravity, dust exposure, and up to ~20 min one-way delay.',
      },
      TRANSIT_BACK: {
        name: 'Return to Earth',
        description: 'Final microgravity leg prior to 1 g readaptation.',
      },
    },
  },
};

export function getLocalizedProfile(
  id: MissionProfileId,
  lang: SupportedLang
): MissionProfile {
  const base = getProfile(id);
  if (lang === 'es') return base;
  const tr = EN_PROFILES[id];
  return {
    ...base,
    name: tr.name,
    summary: tr.summary,
    phases: base.phases.map((ph) => ({
      ...ph,
      name: tr.phases[ph.id]?.name ?? ph.name,
      description: tr.phases[ph.id]?.description ?? ph.description,
    })),
  };
}

export function getLocalizedAllProfiles(lang: SupportedLang): MissionProfile[] {
  return (Object.keys(MISSION_PROFILES) as MissionProfileId[]).map((id) =>
    getLocalizedProfile(id, lang)
  );
}

const EN_EVAL_STEPS: Record<
  EvaluationStepId,
  { title: string; short: string; description: string }
> = {
  CHECK_IN: {
    title: 'Crew behavioral check-in',
    short: 'Check-in',
    description:
      'The ultrasonic sensor already recorded your night: sync its report and log how you feel (~20 seconds).',
  },
  VITALS: {
    title: 'Biomarker snapshot',
    short: 'Biomarkers',
    description: 'Captures a snapshot of live telemetry and runs it through the RIDGE engine.',
  },
  RESISTIVE: {
    title: 'Resistive exercise (ARED)',
    short: 'Resistive',
    description: 'Strength loading per your training plan to counter bone and muscle loss.',
  },
  AEROBIC: {
    title: 'Aerobic exercise',
    short: 'Aerobic',
    description: 'Treadmill or cycle ergometer session to maintain cardiovascular fitness.',
  },
  HYDRATION: {
    title: 'Hydration & citrate',
    short: 'Hydration',
    description: 'Log water intakes and potassium citrate if prescribed by the flight surgeon.',
  },
  MIND: {
    title: 'Cardiac coherence break',
    short: 'Mindfulness',
    description: '1-minute paced breathing at 6 cycles/min (5 s inhale · 5 s exhale).',
  },
  DEBRIEF: {
    title: 'Day summary & diagnosis',
    short: 'Debrief',
    description: 'Review clinical findings and earn daily mission XP.',
  },
};

export function getLocalizedEvaluationSteps(
  lang: SupportedLang
): readonly StepDefinition[] {
  if (lang === 'es') return EVALUATION_STEPS;
  return EVALUATION_STEPS.map((s) => ({
    ...s,
    ...EN_EVAL_STEPS[s.id],
  }));
}

const EN_RANK_TITLES: Record<number, string> = {
  1: 'Cadet',
  2: 'Crew Member',
  3: 'Mission Specialist',
  4: 'Flight Engineer',
  5: 'Crew Medical Officer',
  6: 'Mission Commander',
  7: 'Deep-Space Veteran',
  8: 'Legend of Mars',
};

export function localizeRank(rank: Rank, lang: SupportedLang): Rank {
  if (lang === 'es') return rank;
  return {
    ...rank,
    title: EN_RANK_TITLES[rank.level] ?? rank.title,
  };
}

export function getLocalizedRankFor(xp: number, lang: SupportedLang) {
  const { rank, next, progress } = rankFor(xp);
  return {
    rank: localizeRank(rank, lang),
    next: next ? localizeRank(next, lang) : null,
    progress,
    allRanks: lang === 'es' ? RANKS : RANKS.map((r) => localizeRank(r, lang)),
  };
}

export function computeLocalizedAchievements(
  mission: Mission,
  records: Record<DayKey, DayRecord>,
  lang: SupportedLang
): Achievement[] {
  const base = computeAchievements(mission, records);
  if (lang === 'es') return base;

  const isMars = mission.profileId === 'MARS_CONJUNCTION';
  const enMap: Record<string, { title: string; description: string }> = {
    FIRST_EVAL: {
      title: 'First Contact',
      description: 'Complete your first daily evaluation.',
    },
    FIRST_WEEK: {
      title: 'Solid Week',
      description: `Reach the weekly goal of ${WEEKLY_TARGET_DAYS} out of 7 days.`,
    },
    SELF_CARE: {
      title: 'Self-Care Priority',
      description: 'Pause an evaluation for clinical review and resume safely.',
    },
    DAY_30: {
      title: '30 Days in Space',
      description: 'Log mission day 30.',
    },
    DAY_100: {
      title: 'Centurion',
      description: 'Log mission day 100.',
    },
    HALFWAY: {
      title: 'Mission Halfway Point',
      description: 'Surpass half of the total mission duration.',
    },
    PHASE_SURFACE: {
      title: isMars ? 'Martian Bootprint' : 'Lunar Bootprint',
      description: isMars
        ? 'Log your first day on the surface of Mars.'
        : 'Log your first day on the surface of the Moon.',
    },
    PHASE_RETURN: {
      title: 'Homeward Bound',
      description: 'Log your first day on the return transit to Earth.',
    },
    MISSION_COMPLETE: {
      title: 'Mission Accomplished',
      description: 'Reach the final day of the mission.',
    },
  };

  return base.map((a) => ({
    ...a,
    title: enMap[a.id]?.title ?? a.title,
    description: enMap[a.id]?.description ?? a.description,
  }));
}

export function getLocalizedWeekdays(lang: SupportedLang): readonly string[] {
  return lang === 'es' ? WEEKDAY_SHORT : (['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const);
}

export function formatMissionDay(key: DayKey, lang: SupportedLang): string {
  return formatDateShort(key, lang);
}

/**
 * Versión bilingüe pura de `buildDiagnosis` que mantiene idéntica lógica de
 * disparo determinista que `utils/missionPlan.ts` para ES y EN.
 */
export function buildLocalizedDiagnosis(
  vitals: TelemetryData,
  selfReport: SelfReport | undefined,
  lang: SupportedLang
): Diagnosis {
  const es = lang === 'es';
  const findings: Finding[] = [];

  if (vitals.isEmergency) {
    findings.push({
      id: 'CODE_RED',
      severity: 'CRITICAL',
      title: es ? 'Code Red activo' : 'Code Red Active',
      detail: es
        ? 'Se activó el protocolo de emergencia médica.'
        : 'Medical emergency protocol has been triggered.',
      action: es
        ? 'Detén la evaluación, sigue el protocolo de emergencia y contacta al cirujano de vuelo.'
        : 'Halt routine evaluation, follow emergency protocol steps, and contact the flight surgeon.',
    });
  }

  if (vitals.isRenalWarning) {
    findings.push({
      id: 'R1',
      severity: 'WARNING',
      title: es
        ? 'R1 · Patrón de nefropatía oculta'
        : 'R1 · Masked Nephropathy Pattern',
      detail: es
        ? `Cistatina C ${formatDecimal(vitals.cistatinaC, 2, lang)} mg/L (> ${formatDecimal(T.renal.minCistatinaC, 2, lang)}), Ca²⁺ ${formatDecimal(vitals.calcioIonico, 2, lang)} mmol/L (> ${formatDecimal(T.renal.minCalcioIonico, 2, lang)}) con creatinina ${formatDecimal(vitals.creatinina, 2, lang)} mg/dL.`
        : `Cystatin C ${formatDecimal(vitals.cistatinaC, 2, lang)} mg/L (> ${formatDecimal(T.renal.minCistatinaC, 2, lang)}), Ca²⁺ ${formatDecimal(vitals.calcioIonico, 2, lang)} mmol/L (> ${formatDecimal(T.renal.minCalcioIonico, 2, lang)}) with creatinine ${formatDecimal(vitals.creatinina, 2, lang)} mg/dL.`,
      action: es
        ? 'Prioriza la hidratación y el citrato prescrito, y repórtalo al cirujano de vuelo.'
        : 'Prioritize oral hydration and prescribed potassium citrate, and notify the flight surgeon.',
    });
  }

  if (vitals.isRadiationWarning) {
    const nlr = computeNlr(vitals);
    const nlrText = Number.isFinite(nlr) ? formatDecimal(nlr, 2, lang) : '∞';
    findings.push({
      id: 'R2',
      severity: 'WARNING',
      title: es
        ? 'R2 · Posible inmunosupresión por radiación'
        : 'R2 · Possible Radiation Immunosuppression',
      detail: es
        ? `Radiación ${Math.round(vitals.radiationRate)} µSv/h, linfocitos ${Math.round(vitals.linfocitos)} cél/µL, NLR ${nlrText}.`
        : `Radiation ${Math.round(vitals.radiationRate)} µSv/h, lymphocytes ${Math.round(vitals.linfocitos)} cells/µL, NLR ${nlrText}.`,
      action: es
        ? 'Sigue el protocolo de refugio ante eventos solares y repórtalo al cirujano de vuelo.'
        : 'Move to radiation storm shelter per SPE protocol and report to the flight surgeon.',
    });
  }

  if (vitals.isCo2Warning) {
    findings.push({
      id: 'R3',
      severity: 'WARNING',
      title: es ? 'R3 · Bolsillo de CO₂' : 'R3 · Cabin CO₂ Pocket',
      detail: es
        ? `CO₂ ${Math.round(vitals.co2Level)} ppm (> ${T.co2.minCo2Level}) con SpO₂ ${Math.round(vitals.spO2)}% conservada.`
        : `CO₂ ${Math.round(vitals.co2Level)} ppm (> ${T.co2.minCo2Level}) with preserved SpO₂ ${Math.round(vitals.spO2)}%.`,
      action: es
        ? 'Desplázate a una zona ventilada y avisa al equipo de soporte vital (ECLSS).'
        : 'Relocate to a well-ventilated module and notify ECLSS life-support operations.',
    });
  }

  if (selfReport) {
    if (selfReport.sleepHours < SLEEP_THRESHOLDS.minHours) {
      findings.push({
        id: 'SLEEP',
        severity: 'WARNING',
        title: es ? 'Sueño corto' : 'Short Sleep Duration',
        detail: es
          ? `${formatDecimal(selfReport.sleepHours, 1, lang)} h de sueño ${selfReport.sleep ? 'medidas por el sensor' : 'registradas'}.`
          : `${formatDecimal(selfReport.sleepHours, 1, lang)} h of sleep ${selfReport.sleep ? 'measured by sensor' : 'logged'}.`,
        action: es
          ? 'Tenlo en cuenta al dosificar el esfuerzo de hoy. Si se repite varios días, coméntalo con el cirujano de vuelo.'
          : 'Pace today’s operational workload accordingly. Mention to the flight surgeon if persistent.',
      });
    }

    const night = selfReport.sleep;
    if (night) {
      if (night.breathingPauses >= SLEEP_THRESHOLDS.maxBreathingPauses) {
        findings.push({
          id: 'SLEEP_BREATHING',
          severity: 'WARNING',
          title: es
            ? 'Pausas respiratorias durante el sueño'
            : 'Sleep Breathing Pauses Detected',
          detail: es
            ? `${night.breathingPauses} pausas por hora detectadas por el sensor ultrasónico.`
            : `${night.breathingPauses} breathing pauses per hour detected by ultrasonic sensor.`,
          action: es
            ? 'Revisa la ventilación del módulo de descanso (el CO₂ se acumula junto a la cabeza en 0 g) y coméntalo con el cirujano de vuelo si se repite.'
            : 'Inspect sleep berth airflow (CO₂ can pool near the face in microgravity) and alert the flight surgeon if recurrent.',
        });
      }

      const { min, max } = SLEEP_THRESHOLDS.roomTemp;
      if (night.roomTempC < min || night.roomTempC > max) {
        findings.push({
          id: 'SLEEP_TEMP',
          severity: 'WARNING',
          title: es
            ? 'Temperatura del módulo de descanso fuera de rango'
            : 'Sleep Module Temperature Out of Range',
          detail: es
            ? `${formatDecimal(night.roomTempC, 1, lang)} °C de media durante la noche (cómodo: ${min}–${max} °C).`
            : `${formatDecimal(night.roomTempC, 1, lang)} °C overnight average (comfort zone: ${min}–${max} °C).`,
          action: es
            ? 'Ajusta el termostato o el flujo de aire del módulo antes de la próxima noche.'
            : 'Adjust cabin thermostat or airflow diffuser prior to next sleep period.',
        });
      }

      if (
        night.efficiency < SLEEP_THRESHOLDS.minEfficiency &&
        selfReport.sleepHours >= SLEEP_THRESHOLDS.minHours
      ) {
        findings.push({
          id: 'SLEEP_EFFICIENCY',
          severity: 'WARNING',
          title: es ? 'Sueño fragmentado' : 'Fragmented Sleep Efficiency',
          detail: es
            ? `Eficiencia ${night.efficiency}% con ${night.awakenings} despertares.`
            : `${night.efficiency}% efficiency with ${night.awakenings} awakenings.`,
          action: es
            ? 'Reduce luz y ruido en el módulo y evita pantallas la hora previa a dormir.'
            : 'Reduce cabin noise/light and limit screen exposure during the hour before sleep.',
        });
      }
    }

    if (selfReport.fatigue >= 4) {
      findings.push({
        id: 'FATIGUE',
        severity: 'WARNING',
        title: es ? 'Fatiga elevada' : 'Elevated Fatigue',
        detail: es ? `Fatiga ${selfReport.fatigue}/5.` : `Fatigue ${selfReport.fatigue}/5.`,
        action: es
          ? 'Puedes pausar o adaptar el ejercicio de hoy. Si persiste, repórtalo.'
          : 'Adapt or pause today’s physical training. Report if fatigue persists.',
      });
    }

    if (selfReport.mood <= 2) {
      findings.push({
        id: 'MOOD',
        severity: 'WARNING',
        title: es ? 'Ánimo bajo' : 'Low Mood Score',
        detail: es ? `Ánimo ${selfReport.mood}/5.` : `Mood ${selfReport.mood}/5.`,
        action: es
          ? 'Haz la pausa de coherencia y busca contacto con la tripulación o tu red de apoyo. Si persiste, habla con el equipo de salud conductual.'
          : 'Complete the breathing coherence break and reach out to crewmates or behavioral health support.',
      });
    }
  }

  const severity = findings.some((f) => f.severity === 'CRITICAL')
    ? 'CRITICAL'
    : findings.length > 0
      ? 'WARNING'
      : 'OPTIMAL';

  return { severity, findings };
}
