import { describe, expect, it } from 'vitest';
import { mockInitialState } from '../types/telemetry';
import {
  computeBehavioralRiskIndex,
  deriveEscalationLevel,
} from '../utils/behavioralScoring';
import { evaluateMeasurementSchedule } from '../utils/measurementSchedule';
import { generateClinicalPrompt } from '../utils/systemPrompt';

describe('Behavioral Check-In, Measurement Schedule & AI Privacy Boundary (P2)', () => {
  it('computes bounded 0-100 behavioral risk index and forces 100 on self-harm safety flag', () => {
    const lowRisk = computeBehavioralRiskIndex({
      mood: 5,
      sleepQuality: 5,
      fatigue: 1,
      stress: 1,
      workload: 1,
      socialContact: 5,
      phq2Anhedonia: 0,
      phq2Dysphoria: 0,
      selfHarmFlag: false,
    });
    expect(lowRisk).toBe(0);

    const maxNatural = computeBehavioralRiskIndex({
      mood: 1,
      sleepQuality: 1,
      fatigue: 5,
      stress: 5,
      workload: 5,
      socialContact: 1,
      phq2Anhedonia: 3,
      phq2Dysphoria: 3,
      selfHarmFlag: false,
    });
    expect(maxNatural).toBe(100);

    const flagged = computeBehavioralRiskIndex({
      mood: 5,
      sleepQuality: 5,
      fatigue: 1,
      stress: 1,
      workload: 1,
      socialContact: 5,
      phq2Anhedonia: 0,
      phq2Dysphoria: 0,
      selfHarmFlag: true,
    });
    expect(flagged).toBe(100);
  });

  it('derives escalation levels cleanly across nominal, Flight Surgeon, and emergency triggers', () => {
    const baseAlerts = {
      isEmergency: false,
      isRenalWarning: false,
      isRadiationWarning: false,
      isCo2Warning: false,
    };

    expect(
      deriveEscalationLevel({
        alerts: baseAlerts,
        biomarkers: mockInitialState,
      })
    ).toBe('self-manage');

    expect(
      deriveEscalationLevel({
        alerts: baseAlerts,
        biomarkers: { ...mockInitialState, systolicMmHg: 148, diastolicMmHg: 92 },
      })
    ).toBe('notify-flight-surgeon');

    expect(
      deriveEscalationLevel({
        alerts: baseAlerts,
        biomarkers: mockInitialState,
        behavioralCheckIn: {
          mood: 2,
          sleepQuality: 3,
          fatigue: 3,
          stress: 3,
          workload: 3,
          socialContact: 3,
          phq2Anhedonia: 2,
          phq2Dysphoria: 1,
          selfHarmFlag: false,
          behavioralRiskIndex: 42,
          sharePsychWithAi: false,
          updatedAt: '2026-11-15T08:00:00.000Z',
        },
      })
    ).toBe('notify-flight-surgeon');

    expect(
      deriveEscalationLevel({
        alerts: baseAlerts,
        biomarkers: { ...mockInitialState, bodyTempC: 39.8 },
      })
    ).toBe('emergency');

    expect(
      deriveEscalationLevel({
        alerts: baseAlerts,
        biomarkers: mockInitialState,
        behavioralCheckIn: {
          mood: 4,
          sleepQuality: 4,
          fatigue: 2,
          stress: 2,
          workload: 2,
          socialContact: 4,
          phq2Anhedonia: 0,
          phq2Dysphoria: 0,
          selfHarmFlag: true,
          behavioralRiskIndex: 100,
          sharePsychWithAi: false,
          updatedAt: '2026-11-15T08:00:00.000Z',
        },
      })
    ).toBe('emergency');
  });

  it('evaluates pure deterministic freshness and stale reminder states from explicit nowMs', () => {
    const nowMs = Date.parse('2026-11-15T12:00:00.000Z');
    const results = evaluateMeasurementSchedule(
      {
        bp: { measuredAt: '2026-11-15T10:00:00.000Z', source: 'manual' }, // 2h ago -> fresh
        temp: { measuredAt: '2026-11-14T12:00:00.000Z', source: 'manual' }, // 24h ago -> stale (>12h)
        glucose: { measuredAt: 'invalid-date', source: 'manual' },
      },
      nowMs,
      '2026-11-15T11:30:00.000Z'
    );

    const bp = results.find((r) => r.key === 'bp');
    const temp = results.find((r) => r.key === 'temp');
    const glucose = results.find((r) => r.key === 'glucose');
    const behavioral = results.find((r) => r.key === 'behavioral');
    const bloodPanel = results.find((r) => r.key === 'bloodPanel');

    expect(bp?.isStale).toBe(false);
    expect(bp?.neverMeasured).toBe(false);
    expect(temp?.isStale).toBe(true);
    expect(glucose?.isStale).toBe(true);
    expect(glucose?.neverMeasured).toBe(true);
    expect(behavioral?.isStale).toBe(false);
    expect(bloodPanel?.neverMeasured).toBe(true);
  });

  it('never leaks behavioral check-in metrics to AI prompt without explicit dual opt-in', () => {
    const privateCheckIn = {
      mood: 1,
      sleepQuality: 1,
      fatigue: 5,
      stress: 5,
      workload: 5,
      socialContact: 1,
      phq2Anhedonia: 3 as const,
      phq2Dysphoria: 3 as const,
      selfHarmFlag: true,
      behavioralRiskIndex: 100,
      sharePsychWithAi: false,
      updatedAt: '2026-11-15T09:00:00.000Z',
    };

    const blockedPrompt = generateClinicalPrompt(
      {
        ...mockInitialState,
        sharePsychWithAi: true, // check-in flag itself is still false
        behavioralCheckIn: privateCheckIn,
      },
      { lang: 'en', missionProfileId: 'LUNAR_ARTEMIS' }
    );

    expect(blockedPrompt).not.toContain('phq2Total');
    expect(blockedPrompt).not.toContain('behavioralRiskIndex');
    expect(blockedPrompt).toContain('PRIVACY BOUNDARY');

    const optedInPrompt = generateClinicalPrompt(
      {
        ...mockInitialState,
        sharePsychWithAi: true,
        behavioralCheckIn: { ...privateCheckIn, sharePsychWithAi: true },
      },
      { lang: 'es', missionProfileId: 'MARS_CONJUNCTION' }
    );

    expect(optedInPrompt).toContain('phq2Total');
    expect(optedInPrompt).toContain('behavioralRiskIndex');
    expect(optedInPrompt).not.toContain('LÍMITE DE PRIVACIDAD');
  });
});
