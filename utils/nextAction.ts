import type { SupportedLang } from '../config/missionComms';
import type { RuleEvaluationTrace, RuleId } from '../config/rules';
import type { EducationalIndicatorId } from '../content/indicators.es';
import { getDict } from '../i18n/I18nContext';
import type { ClinicalSnapshot } from '../store/selectors';
import type {
  CommandSystemId,
  CommandTabId,
  LogSectionId,
} from '../store/useCommandUiStore';
import { computeNlr, RIDGE_THRESHOLDS as T } from './clinicalEngine';
import { formatDecimal, formatNumber } from './formatters';
import { evaluateMeasurementSchedule, type IndicatorFreshness } from './measurementSchedule';

export type ActionUrgency = 'critical' | 'warning' | 'due' | 'routine' | 'nominal';
export type TileStatus = 'green' | 'amber' | 'red' | 'missing';

export interface NextActionRecommendation {
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  urgency: ActionUrgency;
  title: string;
  ctaLabel: string;
  targetTab: CommandTabId;
  targetLogSection?: LogSectionId;
  targetSystemId?: CommandSystemId;
  openEmergencyCard?: boolean;
}

export interface SystemTileData {
  id: CommandSystemId;
  guideId: EducationalIndicatorId;
  logSection: LogSectionId;
  title: string;
  shortTitle: string;
  primaryLabel: string;
  subLabel: string;
  status: TileStatus;
  primaryValue: string;
  unit: string;
  secondarySummary: string;
  isStale: boolean;
  staleAgeHours: number | null;
  sourceLabel: string;
  relatedTraces: RuleEvaluationTrace[];
}

export interface RoutineContextInput {
  pendingCountermeasureTitle?: string | null;
  nowMs?: number;
}

export function parseCommandTabHash(hash: string): CommandTabId {
  const clean = hash.trim().replace(/^#/, '').trim().toLowerCase();
  if (clean === 'hoy' || clean === 'mando' || clean === '') return 'hoy';
  if (clean === 'registrar') return 'registrar';
  if (clean === 'mision') return 'mision';
  if (clean === 'tierra') return 'tierra';
  return 'hoy';
}

export function mapRuleToSystemId(ruleId: RuleId): CommandSystemId {
  switch (ruleId) {
    case 'R1_HIDDEN_NEPHROPATHY':
      return 'renal';
    case 'R2_RADIATION_IMMUNOSUPPRESSION':
      return 'radiation';
    case 'R3_CO2_SUBCLINICAL':
      return 'cabin';
    case 'R4_CODE_RED_EMERGENCY':
    case 'R5_BLOOD_PRESSURE':
      return 'cardio';
    case 'R6_DYSGLYCEMIA':
    case 'R7_THERMAL_ANOMALY':
      return 'metabolic';
    case 'R8_BEHAVIORAL_RISK':
      return 'neural';
  }
}

function logSectionForIndicator(key: IndicatorFreshness['key']): LogSectionId {
  if (key === 'bloodPanel') return 'poc';
  if (key === 'behavioral') return 'behavioral';
  return 'vitals';
}

export function getNextAction(
  snapshot: ClinicalSnapshot,
  routineState: RoutineContextInput,
  lang: SupportedLang
): NextActionRecommendation {
  const dict = getDict(lang).command.nextAction;
  const nowMs = routineState.nowMs ?? Date.now();

  // Tier 1: Active emergency or Code Red
  if (snapshot.alerts.isEmergency || snapshot.escalationLevel === 'emergency') {
    return {
      tier: 1,
      urgency: 'critical',
      title: dict.emergencyTitle,
      ctaLabel: dict.emergencyCta,
      targetTab: 'hoy',
      openEmergencyCard: true,
    };
  }

  // Tier 2: Active clinical rule warning or critical alert
  const firingRules = snapshot.ruleTraces.filter((r) => r.triggered);
  if (firingRules.length > 0) {
    const topRule =
      firingRules.find((r) => r.configuredSeverity === 'CRITICAL') ?? firingRules[0];
    return {
      tier: 2,
      urgency: topRule.configuredSeverity === 'CRITICAL' ? 'critical' : 'warning',
      title: `${dict.warningTitlePrefix} ${topRule.shortCode}: ${topRule.title[lang]}`,
      ctaLabel: dict.warningCta,
      targetTab: 'hoy',
      targetSystemId: mapRuleToSystemId(topRule.ruleId),
    };
  }

  // Tier 3: Stale or pending physical measurement (Spot / POC)
  const freshness = evaluateMeasurementSchedule(
    snapshot.indicatorMeta,
    nowMs,
    snapshot.behavioralCheckIn?.updatedAt
  );
  const stalePhysical = freshness.find((f) => f.key !== 'behavioral' && f.isStale);
  if (stalePhysical) {
    return {
      tier: 3,
      urgency: 'due',
      title: `${dict.staleTitlePrefix} ${stalePhysical.label[lang]}`,
      ctaLabel: dict.staleCta,
      targetTab: 'registrar',
      targetLogSection: logSectionForIndicator(stalePhysical.key),
    };
  }

  // Tier 4: Behavioral check-in pending (~30s)
  const behavioralSchedule = freshness.find((f) => f.key === 'behavioral');
  if (!snapshot.behavioralCheckIn || behavioralSchedule?.isStale) {
    return {
      tier: 4,
      urgency: 'routine',
      title: dict.checkInTitle,
      ctaLabel: dict.checkInCta,
      targetTab: 'registrar',
      targetLogSection: 'behavioral',
    };
  }

  // Tier 5: Pending daily countermeasure
  if (routineState.pendingCountermeasureTitle) {
    return {
      tier: 5,
      urgency: 'routine',
      title: `${dict.countermeasureTitlePrefix} ${routineState.pendingCountermeasureTitle}`,
      ctaLabel: dict.countermeasureCta,
      targetTab: 'mision',
    };
  }

  // Tier 6: Nominal state
  return {
    tier: 6,
    urgency: 'nominal',
    title: dict.nominalTitle,
    ctaLabel: dict.nominalCta,
    targetTab: 'mision',
  };
}

function worstStatus(...statuses: TileStatus[]): TileStatus {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('amber')) return 'amber';
  if (statuses.every((s) => s === 'missing')) return 'missing';
  return 'green';
}

function sourceText(
  source: 'sensor' | 'manual' | undefined,
  defaultSource: 'sensor' | 'manual',
  lang: SupportedLang
): string {
  const s = source ?? defaultSource;
  const qm = getDict(lang).quickMeasure;
  return s === 'manual' ? qm.sourceManual : qm.sourceSensor;
}

export function deriveSystemTiles(
  snapshot: ClinicalSnapshot,
  lang: SupportedLang,
  nowMs?: number
): SystemTileData[] {
  const dict = getDict(lang);
  const labels = dict.command.mosaic.systems;
  const { biomarkers, environment, alerts, ruleTraces, behavioralCheckIn, sleepHoursRecorded } =
    snapshot;
  const effectiveNow = nowMs ?? Date.now();
  const freshnessList = evaluateMeasurementSchedule(
    snapshot.indicatorMeta,
    effectiveNow,
    behavioralCheckIn?.updatedAt
  );
  const freshnessByKey = Object.fromEntries(freshnessList.map((f) => [f.key, f])) as Record<
    IndicatorFreshness['key'],
    IndicatorFreshness
  >;

  const tracesFor = (ids: RuleId[]) =>
    ruleTraces.filter((t) => ids.includes(t.ruleId));

  const firingStatusFor = (traces: RuleEvaluationTrace[]): TileStatus => {
    const fired = traces.filter((tr) => tr.triggered);
    if (fired.some((tr) => tr.configuredSeverity === 'CRITICAL')) return 'red';
    if (fired.length > 0) return 'amber';
    return 'green';
  };

  // 1. Cardio (FC, SpO2, BP)
  const cardioTraces = tracesFor(['R4_CODE_RED_EMERGENCY', 'R5_BLOOD_PRESSURE']);
  const cardioBpStale = freshnessByKey.bp?.isStale ?? false;
  const cardioStatus = worstStatus(
    snapshot.systems.cardio.status,
    firingStatusFor(cardioTraces)
  );
  const bpText =
    biomarkers.systolicMmHg !== undefined && biomarkers.diastolicMmHg !== undefined
      ? `${Math.round(biomarkers.systolicMmHg)}/${Math.round(biomarkers.diastolicMmHg)}`
      : '—';

  // 2. Cabin / CO2
  const cabinTraces = tracesFor(['R3_CO2_SUBCLINICAL']);
  const cabinStatus: TileStatus =
    alerts.isCo2Warning || environment.co2Level > T.co2.minCo2Level + 500
      ? 'red'
      : environment.co2Level > T.co2.minCo2Level
        ? 'amber'
        : firingStatusFor(cabinTraces);

  // 3. Radiation
  const radTraces = tracesFor(['R2_RADIATION_IMMUNOSUPPRESSION']);
  const radStatus: TileStatus =
    alerts.isRadiationWarning || environment.radiationRate >= T.radiation.minRadiationRate
    ? 'red'
    : environment.radiationRate > T.radiation.minRadiationRate * 0.8 ||
        environment.radiationAccumulated > 35
      ? 'amber'
      : firingStatusFor(radTraces);

  // 4. Renal
  const renalTraces = tracesFor(['R1_HIDDEN_NEPHROPATHY']);
  const renalStale = freshnessByKey.bloodPanel?.isStale ?? false;
  const renalStatus: TileStatus = alerts.isRenalWarning
    ? 'red'
    : biomarkers.cistatinaC > T.renal.minCistatinaC ||
        biomarkers.calcioIonico > T.renal.minCalcioIonico
      ? 'amber'
      : firingStatusFor(renalTraces);

  // 5. Immune & Cortisol
  const nlr = computeNlr(biomarkers);
  const nlrDisplay = Number.isNaN(nlr)
    ? '—'
    : !Number.isFinite(nlr)
      ? '∞'
      : formatDecimal(nlr, 2, lang);
  const immuneStatus: TileStatus =
    snapshot.systems.inmune.status === 'red' || nlr > 3.5
      ? 'red'
      : snapshot.systems.inmune.status === 'amber' || nlr > 2.5
        ? 'amber'
        : 'green';

  // 6. Bone & Muscle (CTX/NTX proxy)
  const hasBone = biomarkers.ctxNtxIndex !== undefined;
  const boneStatus: TileStatus = !hasBone
    ? 'missing'
    : biomarkers.ctxNtxIndex! >= 1.6 &&
        biomarkers.p1npIndex !== undefined &&
        biomarkers.p1npIndex <= 0.75
      ? 'red'
      : biomarkers.ctxNtxIndex! >= 1.35 ||
          (biomarkers.aredLoadPct !== undefined && biomarkers.aredLoadPct < 65)
        ? 'amber'
        : 'green';

  // 7. Metabolic & Temp
  const metTraces = tracesFor(['R6_DYSGLYCEMIA', 'R7_THERMAL_ANOMALY']);
  const hasMet =
    biomarkers.glucoseMgDl !== undefined || biomarkers.bodyTempC !== undefined;
  const metStale =
    (freshnessByKey.glucose?.isStale ?? false) ||
    (freshnessByKey.temp?.isStale ?? false);
  const metStatus: TileStatus = !hasMet
    ? 'missing'
    : firingStatusFor(metTraces);

  // 8. Behavioral & Sleep (Neural)
  const neuralTraces = tracesFor(['R8_BEHAVIORAL_RISK']);
  const hasNeural =
    behavioralCheckIn !== undefined || sleepHoursRecorded !== null;
  const neuralStale = !behavioralCheckIn || (freshnessByKey.behavioral?.isStale ?? false);
  const neuralStatus: TileStatus = !hasNeural
    ? 'missing'
    : worstStatus(snapshot.systems.conducta.status, firingStatusFor(neuralTraces));

  const bpmUnit = dict.dashboardExtra.bpmUnit;
  const noReading = dict.command.mosaic.noReading;

  return [
    {
      id: 'cardio',
      guideId: 'bp',
      logSection: 'vitals',
      title: labels.cardio.name,
      shortTitle: labels.cardio.short,
      primaryLabel: labels.cardio.primaryLabel,
      subLabel: labels.cardio.subLabel,
      status: cardioStatus,
      primaryValue: formatNumber(Math.round(biomarkers.heartRate), lang),
      unit: bpmUnit,
      secondarySummary: `PA ${bpText} · SpO₂ ${formatNumber(biomarkers.spO2, lang)}%`,
      isStale: cardioBpStale,
      staleAgeHours: freshnessByKey.bp?.ageHours ?? null,
      sourceLabel: sourceText(freshnessByKey.bp?.source, 'sensor', lang),
      relatedTraces: cardioTraces,
    },
    {
      id: 'cabin',
      guideId: 'co2',
      logSection: 'vitals',
      title: labels.cabin.name,
      shortTitle: labels.cabin.short,
      primaryLabel: labels.cabin.primaryLabel,
      subLabel: labels.cabin.subLabel,
      status: cabinStatus,
      primaryValue: formatNumber(Math.round(environment.co2Level), lang),
      unit: 'ppm',
      secondarySummary: `${dict.evolution.threshold} ${formatNumber(T.co2.minCo2Level, lang)} ppm`,
      isStale: false,
      staleAgeHours: 0,
      sourceLabel: dict.quickMeasure.sourceSensor,
      relatedTraces: cabinTraces,
    },
    {
      id: 'radiation',
      guideId: 'radiation',
      logSection: 'poc',
      title: labels.radiation.name,
      shortTitle: labels.radiation.short,
      primaryLabel: labels.radiation.primaryLabel,
      subLabel: labels.radiation.subLabel,
      status: radStatus,
      primaryValue: formatDecimal(environment.radiationRate, 1, lang),
      unit: 'µSv/h',
      secondarySummary: `${dict.command.mosaic.accumulatedPrefix} ${formatDecimal(environment.radiationAccumulated, 1, lang)} mSv`,
      isStale: false,
      staleAgeHours: 0,
      sourceLabel: dict.quickMeasure.sourceSensor,
      relatedTraces: radTraces,
    },
    {
      id: 'renal',
      guideId: 'renal',
      logSection: 'poc',
      title: labels.renal.name,
      shortTitle: labels.renal.short,
      primaryLabel: labels.renal.primaryLabel,
      subLabel: labels.renal.subLabel,
      status: renalStatus,
      primaryValue: formatDecimal(biomarkers.cistatinaC, 2, lang),
      unit: 'mg/L',
      secondarySummary: `Ca²⁺ ${formatDecimal(biomarkers.calcioIonico, 2, lang)} · Cr ${formatDecimal(biomarkers.creatinina, 2, lang)}`,
      isStale: renalStale,
      staleAgeHours: freshnessByKey.bloodPanel?.ageHours ?? null,
      sourceLabel: sourceText(freshnessByKey.bloodPanel?.source, 'sensor', lang),
      relatedTraces: renalTraces,
    },
    {
      id: 'immune',
      guideId: 'radiation',
      logSection: 'poc',
      title: labels.immune.name,
      shortTitle: labels.immune.short,
      primaryLabel: labels.immune.primaryLabel,
      subLabel: labels.immune.subLabel,
      status: immuneStatus,
      primaryValue: nlrDisplay,
      unit: 'NLR',
      secondarySummary: `${formatNumber(Math.round(biomarkers.linfocitos), lang)} ${dict.dashboardExtra.lymphUnit}`,
      isStale: renalStale,
      staleAgeHours: freshnessByKey.bloodPanel?.ageHours ?? null,
      sourceLabel: sourceText(freshnessByKey.bloodPanel?.source, 'sensor', lang),
      relatedTraces: radTraces,
    },
    {
      id: 'bone',
      guideId: 'renal',
      logSection: 'poc',
      title: labels.bone.name,
      shortTitle: labels.bone.short,
      primaryLabel: labels.bone.primaryLabel,
      subLabel: labels.bone.subLabel,
      status: boneStatus,
      primaryValue: hasBone ? `${formatDecimal(biomarkers.ctxNtxIndex!, 2, lang)}x` : noReading,
      unit: hasBone ? 'CTX' : '',
      secondarySummary:
        biomarkers.aredLoadPct !== undefined
          ? `ARED ${Math.round(biomarkers.aredLoadPct)}%`
          : 'DXA N/A',
      isStale: !hasBone,
      staleAgeHours: null,
      sourceLabel: sourceText(freshnessByKey.bloodPanel?.source, 'sensor', lang),
      relatedTraces: renalTraces,
    },
    {
      id: 'metabolic',
      guideId: biomarkers.bodyTempC !== undefined && biomarkers.glucoseMgDl === undefined ? 'temp' : 'glucose',
      logSection: 'vitals',
      title: labels.metabolic.name,
      shortTitle: labels.metabolic.short,
      primaryLabel: labels.metabolic.primaryLabel,
      subLabel: labels.metabolic.subLabel,
      status: metStatus,
      primaryValue:
        biomarkers.glucoseMgDl !== undefined
          ? formatNumber(Math.round(biomarkers.glucoseMgDl), lang)
          : noReading,
      unit: biomarkers.glucoseMgDl !== undefined ? 'mg/dL' : '',
      secondarySummary:
        biomarkers.bodyTempC !== undefined
          ? `${formatDecimal(biomarkers.bodyTempC, 1, lang)} °C`
          : noReading,
      isStale: metStale,
      staleAgeHours: freshnessByKey.glucose?.ageHours ?? freshnessByKey.temp?.ageHours ?? null,
      sourceLabel: sourceText(freshnessByKey.glucose?.source, 'sensor', lang),
      relatedTraces: metTraces,
    },
    {
      id: 'neural',
      guideId: 'behavioral',
      logSection: 'behavioral',
      title: labels.neural.name,
      shortTitle: labels.neural.short,
      primaryLabel: labels.neural.primaryLabel,
      subLabel: labels.neural.subLabel,
      status: neuralStatus,
      primaryValue: behavioralCheckIn
        ? `${behavioralCheckIn.behavioralRiskIndex}/100`
        : sleepHoursRecorded !== null
          ? `${formatDecimal(sleepHoursRecorded, 1, lang)} h`
          : noReading,
      unit: behavioralCheckIn ? 'idx' : sleepHoursRecorded !== null ? '' : '',
      secondarySummary:
        sleepHoursRecorded !== null
          ? `${formatDecimal(sleepHoursRecorded, 1, lang)} h · ${dict.dashboardExtra.dailyTag}`
          : dict.dashboardExtra.pendingCheckIn,
      isStale: neuralStale,
      staleAgeHours: freshnessByKey.behavioral?.ageHours ?? null,
      sourceLabel: behavioralCheckIn ? dict.quickMeasure.sourceManual : noReading,
      relatedTraces: neuralTraces,
    },
  ];
}

export type OverallLevel = 'nominal' | 'watch' | 'warning' | 'critical';

/**
 * Nivel global único para la barra de estado y la cabecera de Hoy:
 * combina el motor clínico (severidad, Código Rojo) con el mosaico.
 */
export function deriveOverallLevel(
  snapshot: Pick<ClinicalSnapshot, 'globalSeverity' | 'escalationLevel' | 'alerts'>,
  tiles: Pick<SystemTileData, 'status'>[]
): OverallLevel {
  if (
    snapshot.globalSeverity === 'CRITICAL' ||
    snapshot.escalationLevel === 'emergency' ||
    snapshot.alerts.isEmergency ||
    tiles.some((t) => t.status === 'red')
  )
    return 'critical';
  if (snapshot.globalSeverity === 'WARNING') return 'warning';
  if (tiles.some((t) => t.status === 'amber')) return 'watch';
  return 'nominal';
}
