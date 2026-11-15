import { afterEach, describe, expect, it, vi } from 'vitest';
import { INDICATORS_EN } from '../content/indicators.en';
import { INDICATORS_ES } from '../content/indicators.es';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import {
  getDict,
  parseLanguageParam,
  resolveTranslationKey,
} from '../i18n/I18nContext';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { mockInitialState } from '../types/telemetry';
import type { Mission, SelfReport } from '../types/mission';
import { evaluateRulesWithTrace } from '../utils/clinicalEngine';
import {
  formatDateShort,
  formatDateTimeShort,
  formatDecimal,
  formatDurationSec,
  formatNumber,
  formatRelativeAgeHours,
} from '../utils/formatters';
import { runLocalTriage } from '../utils/localTriage';
import { RANKS, totalDays } from '../utils/missionPlan';
import {
  buildLocalizedDiagnosis,
  computeLocalizedAchievements,
  formatMissionDay,
  getLocalizedAllProfiles,
  getLocalizedEvaluationSteps,
  getLocalizedProfile,
  getLocalizedRankFor,
  getLocalizedWeekdays,
  localizeRank,
} from '../utils/missionPlanL10n';

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    collectKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

describe('i18n ES/EN Parity, Formatters, and Emergency Reactivity (Fase A)', () => {
  afterEach(() => {
    useTelemetryStore.getState().simulateScenario('RESET');
    vi.restoreAllMocks();
  });

  it('maintains 100% deep key parity across i18n dictionaries and indicator guides', () => {
    const esKeys = collectKeys(es).sort();
    const enKeys = collectKeys(en).sort();
    expect(esKeys).toEqual(enKeys);

    const indEsKeys = collectKeys(INDICATORS_ES).sort();
    const indEnKeys = collectKeys(INDICATORS_EN).sort();
    expect(indEsKeys).toEqual(indEnKeys);
  });

  it('parses ?lang= query params cleanly and resolves dynamic translation keys with fallback', () => {
    expect(parseLanguageParam('en')).toBe('en');
    expect(parseLanguageParam(' ES ')).toBe('es');
    expect(parseLanguageParam('fr')).toBeNull();
    expect(parseLanguageParam(null)).toBeNull();

    expect(getDict('en').nav.sectionCommand).toBe('Command Center');
    expect(getDict('es').nav.sectionCommand).toBe('Centro de mando');

    expect(resolveTranslationKey('en', 'command.tabs.today')).toBe('Today');
    expect(resolveTranslationKey('es', 'command.tabs.today')).toBe('Hoy');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveTranslationKey('en', 'nonexistent.missing.key', 'Fallback label')).toBe(
      'Fallback label'
    );
    expect(resolveTranslationKey('en', 'nonexistent.missing.key')).toBe('nonexistent.missing.key');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('formats numbers, decimals, dates, durations, and relative hours per locale', () => {
    expect(formatNumber(Number.NaN, 'es')).toBe('—');
    expect(formatNumber(Number.POSITIVE_INFINITY, 'en')).toBe('∞');
    expect(formatDecimal(1.42, 2, 'es')).toContain(',');
    expect(formatDecimal(1.42, 2, 'en')).toContain('.');

    expect(formatDateShort('2026-07-04', 'en')).not.toBe('2026-07-04');
    expect(formatDateShort('invalid-date', 'es')).toBe('invalid-date');
    expect(formatDateTimeShort('invalid', 'en')).toBe('invalid');
    expect(formatDateTimeShort(Date.UTC(2026, 6, 4, 12, 30), 'en').length).toBeGreaterThan(3);

    expect(formatDurationSec(1.3, 'en')).toBe('1.3 s');
    expect(formatDurationSec(25, 'es')).toBe('25 s');
    expect(formatDurationSec(125, 'es')).toBe('2 min 05 s');
    expect(formatDurationSec(125, 'en')).toBe('2m 05s');

    expect(formatRelativeAgeHours(0.2, 'en').length).toBeGreaterThan(2);
    expect(formatRelativeAgeHours(3, 'es').length).toBeGreaterThan(2);
  });

  it('switches deterministic Code Red / emergency clinical outputs cleanly between ES and EN', () => {
    const store = useTelemetryStore.getState();
    store.triggerCodeRed();
    const stateAfterRed = useTelemetryStore.getState();

    expect(stateAfterRed.isEmergency).toBe(true);
    expect(stateAfterRed.escalationLevel).toBe('emergency');

    const telemetry = { ...mockInitialState, isEmergency: true };
    const traces = evaluateRulesWithTrace(telemetry);

    const esTriage = runLocalTriage(telemetry, traces, 'es');
    const enTriage = runLocalTriage(telemetry, traces, 'en');
    expect(esTriage.escalationLevel).toBe('emergency');
    expect(enTriage.escalationLevel).toBe('emergency');
    expect(esTriage.headline).not.toEqual(enTriage.headline);

    const esDiag = buildLocalizedDiagnosis(telemetry, undefined, 'es');
    const enDiag = buildLocalizedDiagnosis(telemetry, undefined, 'en');
    expect(esDiag.severity).toBe('CRITICAL');
    expect(enDiag.severity).toBe('CRITICAL');
    expect(esDiag.findings[0]?.title).toContain('Code Red');
    expect(enDiag.findings[0]?.title).toContain('Code Red Active');
    expect(esDiag.findings[0]?.detail).not.toEqual(enDiag.findings[0]?.detail);
  });

  it('switches all 5 scenario clinical telemetry patterns dynamically across ES and EN', () => {
    const scenarios = [
      'SOLAR_STORM',
      'CO2_LEAK',
      'RENAL_DAMAGE',
      'BONE_LOSS',
      'CARDIO_DECONDITIONING',
    ] as const;

    for (const sc of scenarios) {
      useTelemetryStore.getState().simulateScenario('RESET');
      useTelemetryStore.getState().simulateScenario(sc);
      const s = useTelemetryStore.getState();
      const telemetry = {
        heartRate: s.heartRate,
        spO2: s.spO2,
        cistatinaC: s.cistatinaC,
        creatinina: s.creatinina,
        calcioIonico: s.calcioIonico,
        linfocitos: s.linfocitos,
        neutrofilos: s.neutrofilos,
        cortisol: s.cortisol,
        co2Level: s.co2Level,
        radiationRate: s.radiationRate,
        radiationAccumulated: s.radiationAccumulated,
        isEmergency: s.isEmergency,
        isRenalWarning: s.isRenalWarning,
        isRadiationWarning: s.isRadiationWarning,
        isCo2Warning: s.isCo2Warning,
      };
      const traces = evaluateRulesWithTrace(telemetry);
      const triageEs = runLocalTriage(telemetry, traces, 'es');
      const triageEn = runLocalTriage(telemetry, traces, 'en');
      expect(triageEs.headline).not.toBe(triageEn.headline);
    }
  });

  it('localizes mission profiles, ranks, achievements, weekdays, and sleep/fatigue diagnosis without touching missionPlan', () => {
    const allEs = getLocalizedAllProfiles('es');
    const allEn = getLocalizedAllProfiles('en');
    expect(allEs.length).toBe(3);
    expect(allEn.length).toBe(3);
    expect(totalDays(allEs[0])).toBe(totalDays(allEn[0]));
    expect(getLocalizedProfile('LUNAR_ARTEMIS', 'en').name).toContain('Moon');

    const stepsEs = getLocalizedEvaluationSteps('es');
    const stepsEn = getLocalizedEvaluationSteps('en');
    expect(stepsEs.map((s) => s.id)).toEqual(stepsEn.map((s) => s.id));
    expect(stepsEn[0]?.short).toBe('Check-in');

    expect(localizeRank(RANKS[0], 'es').title).toBe(RANKS[0].title);
    expect(getLocalizedRankFor(0, 'en').rank.title).toBe('Cadet');
    expect(getLocalizedRankFor(100000, 'en').next).toBeNull();

    expect(getLocalizedWeekdays('es')[0]).toBe('L');
    expect(getLocalizedWeekdays('en')[0]).toBe('M');
    expect(formatMissionDay('2026-06-01', 'en').length).toBeGreaterThan(2);

    const mission: Mission = {
      profileId: 'MARS_CONJUNCTION',
      startDate: '2026-01-01',
    };
    const achsEs = computeLocalizedAchievements(mission, {}, 'es');
    const achsEn = computeLocalizedAchievements(mission, {}, 'en');
    expect(achsEs.length).toBe(achsEn.length);
    expect(achsEn.some((a) => a.title === 'First Contact')).toBe(true);

    const lunarMission: Mission = {
      profileId: 'LUNAR_ARTEMIS',
      startDate: '2026-01-01',
    };
    const lunarEn = computeLocalizedAchievements(lunarMission, {}, 'en');
    expect(lunarEn.some((a) => a.title === 'Lunar Bootprint')).toBe(true);

    const warningTelemetry = {
      ...mockInitialState,
      isRenalWarning: true,
      cistatinaC: 1.5,
      calcioIonico: 2.6,
      isRadiationWarning: true,
      radiationRate: 450,
      linfocitos: 700,
      neutrofilos: 4900,
      isCo2Warning: true,
      co2Level: 4500,
    };
    const poorReport: SelfReport = {
      sleepHours: 5.5,
      mood: 2,
      fatigue: 4,
      sleep: {
        bedtime: '22:30',
        inBedHours: 8.0,
        totalHours: 7.2,
        efficiency: 68,
        latencyMin: 25,
        awakenings: 5,
        breathingRate: 16,
        breathingPauses: 7,
        movementIndex: 4,
        outOfBed: 1,
        distanceCm: 55,
        roomTempC: 27.5,
        roomTempMinC: 26.8,
        roomTempMaxC: 28.2,
        deepPct: 18,
        remPct: 20,
      },
    };
    const diagEn = buildLocalizedDiagnosis(warningTelemetry, poorReport, 'en');
    const diagEs = buildLocalizedDiagnosis(warningTelemetry, poorReport, 'es');
    expect(diagEn.severity).toBe('WARNING');
    expect(diagEn.findings.map((f) => f.id)).toEqual(diagEs.findings.map((f) => f.id));

    const fragmentedOnly = buildLocalizedDiagnosis(
      mockInitialState,
      { ...poorReport, sleepHours: 7.4 },
      'en'
    );
    expect(fragmentedOnly.findings.some((f) => f.id === 'SLEEP_EFFICIENCY')).toBe(true);

    const optimal = buildLocalizedDiagnosis(mockInitialState, undefined, 'en');
    expect(optimal.severity).toBe('OPTIMAL');
  });
});
