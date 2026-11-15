import { describe, expect, it } from 'vitest';
import { formatOneWayLatency, getMissionComms } from '../config/missionComms';
import { advanceOutboxPackets } from '../store/useOutboxStore';
import { mockInitialState } from '../types/telemetry';
import { evaluateRulesWithTrace } from '../utils/clinicalEngine';
import {
  deriveDailyCountermeasures,
  evaluateOrthostaticScreen,
} from '../utils/countermeasures';
import { demoDaysFor, generateDemoHistory } from '../utils/demoHistory';
import { runLocalTriage } from '../utils/localTriage';
import { parseMissionSlug, slugForProfile } from '../utils/missionChoice';
import {
  buildDiagnosis,
  computeAchievements,
  hasClinicalAlert,
  missionDayOf,
  phaseOfDay,
  rankFor,
  totalDays,
  weeklyStreak,
} from '../utils/missionPlan';
import { clockAt, simulateSleepNight } from '../utils/sleepSensing';

describe('Offline Local Triage, Outbox Latency, Countermeasures & Demo History (P4 + P6)', () => {
  it('runs deterministic offline Local Triage combining active rules and crew symptom keywords', () => {
    const telemetry = { ...mockInitialState, co2Level: 4200, spO2: 98, isCo2Warning: true };
    const traces = evaluateRulesWithTrace(telemetry);

    const esReport = runLocalTriage(telemetry, traces, 'es', 'tengo dolor de cabeza y mareo');
    expect(esReport.mode).toBe('deterministic-offline');
    expect(esReport.matchedProtocolIds).toContain('R3_CO2_SUBCLINICAL');
    expect(esReport.immediateSteps.length).toBeGreaterThan(0);
    expect(esReport.sbarSummary.situation).toContain('NOTIFY-FLIGHT-SURGEON');

    const enNominal = runLocalTriage(mockInitialState, evaluateRulesWithTrace(mockInitialState), 'en');
    expect(enNominal.matchedProtocolIds).toEqual(['NOMINAL']);
    expect(enNominal.escalationLevel).toBe('self-manage');
  });

  it('simulates Earth Outbox queueing with Moon ~1.3s, Mars ~20min, conjunction blackout, offline hold, and speedup', () => {
    const moonComms = getMissionComms('LUNAR_ARTEMIS');
    const marsComms = getMissionComms('MARS_CONJUNCTION');
    expect(moonComms.oneWayLatencyNominalSec).toBeCloseTo(1.3, 1);
    expect(marsComms.oneWayLatencyNominalSec).toBe(1200);
    expect(formatOneWayLatency('LUNAR_ARTEMIS', 'en')).toContain('1.3 s');
    expect(formatOneWayLatency('MARS_CONJUNCTION', 'es')).toContain('20 min');

    const initialPkt = {
      id: 'pkt-1',
      kind: 'SBAR_REPORT' as const,
      title: 'Mars SBAR',
      missionProfileId: 'MARS_CONJUNCTION' as const,
      priority: 'priority' as const,
      payload: { ok: true },
      createdAtMs: 0,
      oneWayLatencySec: 1200,
      remainingSec: 1200,
      status: 'queued' as const,
      attempts: 0,
    };

    // Offline holds queue without decrementing ETA
    const offlineStep = advanceOutboxPackets([initialPkt], {
      deltaRealSec: 5,
      speedup: 600,
      offline: true,
      conjunctionBlackout: false,
      nowMs: 5000,
    });
    expect(offlineStep[0].status).toBe('queued');
    expect(offlineStep[0].remainingSec).toBe(1200);

    // Solar conjunction holds in held_conjunction state
    const conjunctionStep = advanceOutboxPackets(offlineStep, {
      deltaRealSec: 5,
      speedup: 600,
      offline: false,
      conjunctionBlackout: true,
      nowMs: 10000,
    });
    expect(conjunctionStep[0].status).toBe('held_conjunction');
    expect(conjunctionStep[0].remainingSec).toBe(1200);

    // Resumed online at ×600 for 2.1s -> 1260 sim sec > 1200 -> delivered
    const delivered = advanceOutboxPackets(conjunctionStep, {
      deltaRealSec: 2.1,
      speedup: 600,
      offline: false,
      conjunctionBlackout: false,
      nowMs: 12100,
    });
    expect(delivered[0].status).toBe('delivered');
    expect(delivered[0].remainingSec).toBe(0);
    expect(delivered[0].deliveredAtMs).toBe(12100);
  });

  it('derives personalized countermeasures and detects orthostatic intolerance without DXA', () => {
    expect(evaluateOrthostaticScreen()).toBe('unmeasured');
    expect(evaluateOrthostaticScreen(12, -5)).toBe('normal');
    expect(evaluateOrthostaticScreen(22, -12)).toBe('borderline');
    expect(evaluateOrthostaticScreen(32, -24)).toBe('positive-intolerance');

    const plan = deriveDailyCountermeasures({
      biomarkers: {
        ...mockInitialState,
        ctxNtxIndex: 1.68,
        p1npIndex: 0.72,
        aredLoadPct: 48,
        hrvRmssdMs: 18,
        orthostaticDeltaHr: 32,
        orthostaticDeltaSys: -24,
      },
      environment: mockInitialState,
      alerts: {
        isEmergency: false,
        isRenalWarning: false,
        isRadiationWarning: false,
        isCo2Warning: false,
      },
      missionProfileId: 'MARS_CONJUNCTION',
      lang: 'es',
    });

    expect(plan.dxaLimitationNote.toLowerCase()).toContain('dxa');
    expect(plan.orthostaticStatus).toBe('positive-intolerance');
    expect(plan.items.find((i) => i.stepId === 'RESISTIVE')?.priority).toBe('high');
    expect(plan.items.find((i) => i.stepId === 'AEROBIC')?.priority).toBe('high');

    // Code Red puts exercise countermeasures on safety hold
    const holdPlan = deriveDailyCountermeasures({
      biomarkers: mockInitialState,
      environment: mockInitialState,
      alerts: {
        isEmergency: true,
        isRenalWarning: false,
        isRadiationWarning: false,
        isCo2Warning: false,
      },
      missionProfileId: 'LUNAR_ARTEMIS',
      lang: 'en',
    });
    expect(holdPlan.items.find((i) => i.stepId === 'RESISTIVE')?.priority).toBe('hold');
  });

  it('generates deterministic 150d Mars and 40d Moon demo history with P6 markers & sleep sensing', () => {
    expect(demoDaysFor('MARS_CONJUNCTION')).toBe(150);
    expect(demoDaysFor('LUNAR_ARTEMIS')).toBe(40);

    const mars = generateDemoHistory('2026-11-15', 'MARS_CONJUNCTION');
    const moon = generateDemoHistory('2026-11-15', 'LUNAR_ARTEMIS');

    const marsKeys = Object.keys(mars.records);
    const moonKeys = Object.keys(moon.records);
    expect(marsKeys.length).toBeGreaterThan(100);
    expect(moonKeys.length).toBeGreaterThan(25);
    expect(moonKeys.length).toBeLessThanOrEqual(40);

    const sampleRec = mars.records[marsKeys[Math.floor(marsKeys.length / 2)]];
    expect(sampleRec.vitals?.ctxNtxIndex).toBeDefined();
    expect(sampleRec.vitals?.hrvRmssdMs).toBeDefined();
    expect(sampleRec.selfReport?.sleep?.efficiency).toBeGreaterThan(0);

    expect(missionDayOf(moon.mission, '2026-11-15')).toBe(40);
    expect(totalDays({ id: 'LUNAR_ARTEMIS', name: 'x', summary: 'x', phases: [{ id: 'SURFACE', name: 's', days: 40, description: 'd' }] })).toBe(40);
    expect(phaseOfDay({ id: 'LUNAR_ARTEMIS', name: 'x', summary: 'x', phases: [{ id: 'SURFACE', name: 's', days: 40, description: 'd' }] }, 10).phase.id).toBe('SURFACE');

    expect(rankFor(500).rank.title).toBeDefined();
    expect(weeklyStreak(mars.records, 5)).toBeGreaterThanOrEqual(0);
    expect(computeAchievements(mars.mission, mars.records).length).toBeGreaterThan(0);
    expect(hasClinicalAlert(mockInitialState)).toBe(false);

    const diag = buildDiagnosis(
      { ...mockInitialState, co2Level: 4200, isCo2Warning: true },
      sampleRec.selfReport
    );
    expect(diag.findings.length).toBeGreaterThan(0);

    const night = simulateSleepNight('2026-11-15', {
      ...mockInitialState,
      cortisol: 15,
    });
    expect(night.summary.totalHours).toBeGreaterThan(3);
    expect(clockAt('22:30', 90)).toBe('00:00');
    expect(parseMissionSlug('luna')).toBe('luna');
    expect(slugForProfile('MARS_CONJUNCTION')).toBe('marte');
  });
});
