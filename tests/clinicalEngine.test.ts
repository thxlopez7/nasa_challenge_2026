import { describe, expect, it } from 'vitest';
import { CLINICAL_RULES, RULES_VERSION } from '../config/rules';
import {
  DEFAULT_MISSION_PROFILE_HOOK,
  resolveMissionProfileHook,
} from '../config/missionProfile';
import { mockInitialState } from '../types/telemetry';
import {
  computeNlr,
  evaluateClinicalAlerts,
  evaluateRulesWithTrace,
  evaluateTelemetry,
  getAlertSeverity,
  getTelemetrySeverity,
  isCo2Pocket,
  isHiddenNephropathy,
  isRadiationImmunosuppression,
} from '../utils/clinicalEngine';

function makeSeededPrng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Clinical Engine & Declarative Rules (P3)', () => {
  it('stays optimal at deterministic nominal baseline', () => {
    const alerts = evaluateTelemetry(mockInitialState, mockInitialState);
    expect(alerts).toEqual({
      isRenalWarning: false,
      isRadiationWarning: false,
      isCo2Warning: false,
    });
    expect(getAlertSeverity({ isEmergency: false, ...alerts })).toBe('OPTIMAL');
    expect(getTelemetrySeverity(mockInitialState)).toBe('OPTIMAL');
  });

  it('prevents creatinine false positive when Cystatin C is low (Cre 3.0 / CysC 0.2)', () => {
    const bio = {
      ...mockInitialState,
      creatinina: 3.0,
      cistatinaC: 0.2,
      calcioIonico: 1.1,
    };
    expect(isHiddenNephropathy(bio)).toBe(false);
    const traces = evaluateRulesWithTrace({ ...bio, ...mockInitialState });
    const r1 = traces.find((t) => t.ruleId === 'R1_HIDDEN_NEPHROPATHY');
    expect(r1?.triggered).toBe(false);
  });

  it('triggers R1 hidden nephropathy with masked creatinine or CisC/Cr dissociation', () => {
    const masked = {
      ...mockInitialState,
      creatinina: 0.9,
      cistatinaC: 1.4,
      calcioIonico: 1.5,
    };
    expect(isHiddenNephropathy(masked)).toBe(true);

    const dissociated = {
      ...mockInitialState,
      creatinina: 1.4,
      cistatinaC: 2.0,
      calcioIonico: 1.3,
    };
    expect(isHiddenNephropathy(dissociated)).toBe(true);

    const traces = evaluateRulesWithTrace({ ...mockInitialState, ...dissociated });
    const r1 = traces.find((t) => t.ruleId === 'R1_HIDDEN_NEPHROPATHY');
    expect(r1?.triggered).toBe(true);
    expect(r1?.criteria.find((c) => c.id === 'r1-cis-cr-ratio')?.passed).toBe(true);
  });

  it('handles R2 radiation immunosuppression and linfocitos=0 NLR=Infinity boundary', () => {
    const storm = {
      ...mockInitialState,
      radiationRate: 120,
      radiationAccumulated: 80,
      neutrofilos: 4500,
      linfocitos: 0,
    };
    expect(computeNlr(storm)).toBe(Number.POSITIVE_INFINITY);
    expect(isRadiationImmunosuppression(storm, storm)).toBe(true);

    const traces = evaluateRulesWithTrace(storm);
    const r2 = traces.find((t) => t.ruleId === 'R2_RADIATION_IMMUNOSUPPRESSION');
    expect(r2?.triggered).toBe(true);
    expect(r2?.criteria.find((c) => c.id === 'r2-nlr')?.passed).toBe(true);

    // Non-radiation high rate without lymphopenia must not trigger R2
    const nominalBlood = { ...storm, linfocitos: 1500 };
    expect(isRadiationImmunosuppression(nominalBlood, storm)).toBe(false);
  });

  it('handles R3 CO2 subclinical pocket only when CO2 > 3500 and SpO2 >= 96', () => {
    const pocket = { ...mockInitialState, co2Level: 4200, spO2: 98 };
    expect(isCo2Pocket(pocket, pocket)).toBe(true);

    const hypoxic = { ...mockInitialState, co2Level: 4200, spO2: 92 };
    expect(isCo2Pocket(hypoxic, hypoxic)).toBe(false);
  });

  it('safely returns false and marks missingInputs on NaN, Infinity, negative, or empty payloads', () => {
    expect(Number.isNaN(computeNlr({ neutrofilos: -1, linfocitos: 100 }))).toBe(true);
    expect(
      isHiddenNephropathy({
        ...mockInitialState,
        creatinina: 0,
        cistatinaC: 2,
        calcioIonico: 2,
      })
    ).toBe(false);

    const invalid = {
      ...mockInitialState,
      cistatinaC: Number.NaN,
      radiationRate: Number.POSITIVE_INFINITY,
      co2Level: -50,
    };
    const alerts = evaluateClinicalAlerts(invalid, false);
    expect(alerts.isRenalWarning).toBe(false);
    expect(alerts.isRadiationWarning).toBe(false);
    expect(alerts.isCo2Warning).toBe(false);

    const emptyTraces = evaluateRulesWithTrace({});
    expect(emptyTraces.length).toBe(CLINICAL_RULES.length);
    for (const trace of emptyTraces) {
      expect(trace.triggered).toBe(false);
      expect(trace.hasMissingInputs).toBe(true);
    }
  });

  it('maintains parity between evaluateTelemetry and evaluateRulesWithTrace across 250 fuzzed inputs in <1ms avg', () => {
    const rand = makeSeededPrng(42);
    const start = performance.now();

    for (let i = 0; i < 250; i += 1) {
      const sample = {
        ...mockInitialState,
        heartRate: rand() * 140,
        spO2: 80 + rand() * 20,
        cistatinaC: rand() * 2.5,
        creatinina: rand() < 0.05 ? 0 : rand() * 3.0,
        calcioIonico: rand() * 2.0,
        linfocitos: rand() < 0.05 ? 0 : rand() * 3000,
        neutrofilos: rand() * 8000,
        co2Level: rand() * 6500,
        radiationRate: rand() * 160,
        radiationAccumulated: rand() * 120,
        isEmergency: rand() < 0.1,
      };

      const alerts = evaluateTelemetry(sample, sample);
      const traces = evaluateRulesWithTrace(
        sample,
        resolveMissionProfileHook(DEFAULT_MISSION_PROFILE_HOOK.profileId, {
          baseline: { crewId: 'crew-test' },
        })
      );

      const r1 = traces.find((t) => t.ruleId === 'R1_HIDDEN_NEPHROPATHY');
      const r2 = traces.find((t) => t.ruleId === 'R2_RADIATION_IMMUNOSUPPRESSION');
      const r3 = traces.find((t) => t.ruleId === 'R3_CO2_SUBCLINICAL');

      expect(r1?.triggered).toBe(alerts.isRenalWarning);
      expect(r2?.triggered).toBe(alerts.isRadiationWarning);
      expect(r3?.triggered).toBe(alerts.isCo2Warning);
    }

    const avgMs = (performance.now() - start) / 250;
    expect(avgMs).toBeLessThan(1);
    expect(RULES_VERSION).toBe('1.3.0-proto');
  });

  it('evaluates P2 dynamic rules R5-R8 including context-aware glucose and R4 emergency override', () => {
    const traces = evaluateRulesWithTrace({
      ...mockInitialState,
      isEmergency: true,
      systolicMmHg: 152,
      diastolicMmHg: 94,
      glucoseMgDl: 150,
      glucoseContext: 'fasting',
      bodyTempC: 38.4,
      behavioralCheckIn: {
        mood: 2,
        sleepQuality: 2,
        fatigue: 4,
        stress: 4,
        workload: 4,
        socialContact: 2,
        phq2Anhedonia: 2,
        phq2Dysphoria: 2,
        selfHarmFlag: true,
        behavioralRiskIndex: 100,
        sharePsychWithAi: false,
        updatedAt: '2026-11-15T08:00:00.000Z',
      },
    });

    expect(traces.find((r) => r.ruleId === 'R4_CODE_RED_EMERGENCY')?.triggered).toBe(true);
    expect(traces.find((r) => r.ruleId === 'R5_BLOOD_PRESSURE')?.triggered).toBe(true);
    expect(traces.find((r) => r.ruleId === 'R6_DYSGLYCEMIA')?.triggered).toBe(true);
    expect(traces.find((r) => r.ruleId === 'R7_THERMAL_ANOMALY')?.triggered).toBe(true);
    const r8 = traces.find((r) => r.ruleId === 'R8_BEHAVIORAL_RISK');
    expect(r8?.triggered).toBe(true);
    expect(r8?.escalation).toBe('emergency');

    // Postprandial 150 mg/dL must stay nominal (< 200 postprandial limit)
    const postMeal = evaluateRulesWithTrace({
      ...mockInitialState,
      glucoseMgDl: 150,
      glucoseContext: 'postprandial',
    });
    expect(postMeal.find((r) => r.ruleId === 'R6_DYSGLYCEMIA')?.triggered).toBe(false);
  });
});
