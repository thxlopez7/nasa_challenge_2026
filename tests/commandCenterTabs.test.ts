import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMissionComms } from '../config/missionComms';
import {
  type ClinicalSnapshot,
  deriveSystemSnapshots,
} from '../store/selectors';
import { useCommandUiStore } from '../store/useCommandUiStore';
import {
  type BehavioralCheckInData,
  type Biomarkers,
  type ClinicalAlerts,
  type Environment,
  type EscalationLevel,
  mockInitialState,
  type TrackedIndicatorKey,
  type IndicatorMeta,
} from '../types/telemetry';
import {
  computeNlr,
  evaluateClinicalAlerts,
  evaluateRulesWithTrace,
} from '../utils/clinicalEngine';
import {
  deriveSystemTiles,
  getNextAction,
  mapRuleToSystemId,
  parseCommandTabHash,
} from '../utils/nextAction';

const NOW_MS = Date.UTC(2026, 10, 15, 12, 0, 0);
const FRESH_ISO = new Date(NOW_MS - 30 * 60 * 1000).toISOString();
const STALE_ISO = new Date(NOW_MS - 120 * 60 * 60 * 1000).toISOString();

function fullFreshMeta(iso = FRESH_ISO): Partial<Record<TrackedIndicatorKey, IndicatorMeta>> {
  return {
    bp: { measuredAt: iso, source: 'manual' },
    glucose: { measuredAt: iso, source: 'manual' },
    temp: { measuredAt: iso, source: 'manual' },
    bloodPanel: { measuredAt: iso, source: 'manual' },
    behavioral: { measuredAt: iso, source: 'manual' },
  };
}

function makeBehavioral(
  overrides: Partial<BehavioralCheckInData> = {}
): BehavioralCheckInData {
  return {
    mood: 4,
    sleepQuality: 4,
    fatigue: 2,
    stress: 2,
    workload: 3,
    socialContact: 4,
    phq2Anhedonia: 0,
    phq2Dysphoria: 0,
    selfHarmFlag: false,
    behavioralRiskIndex: 20,
    sharePsychWithAi: false,
    updatedAt: FRESH_ISO,
    ...overrides,
  };
}

function makeSnapshot(opts: {
  biomarkers?: Partial<Biomarkers>;
  environment?: Partial<Environment>;
  alerts?: Partial<ClinicalAlerts>;
  escalationLevel?: EscalationLevel;
  behavioralCheckIn?: BehavioralCheckInData;
  indicatorMeta?: Partial<Record<TrackedIndicatorKey, IndicatorMeta>>;
  sleepHoursRecorded?: number | null;
} = {}): ClinicalSnapshot {
  const biomarkers: Biomarkers = {
    heartRate: mockInitialState.heartRate,
    spO2: mockInitialState.spO2,
    cistatinaC: mockInitialState.cistatinaC,
    creatinina: mockInitialState.creatinina,
    calcioIonico: mockInitialState.calcioIonico,
    linfocitos: mockInitialState.linfocitos,
    neutrofilos: mockInitialState.neutrofilos,
    cortisol: mockInitialState.cortisol,
    systolicMmHg: mockInitialState.systolicMmHg,
    diastolicMmHg: mockInitialState.diastolicMmHg,
    glucoseMgDl: mockInitialState.glucoseMgDl,
    glucoseContext: mockInitialState.glucoseContext,
    bodyTempC: mockInitialState.bodyTempC,
    ctxNtxIndex: 1.0,
    p1npIndex: 1.0,
    aredLoadPct: 90,
    hrvRmssdMs: 42,
    orthostaticDeltaHr: 10,
    orthostaticDeltaSys: -4,
    ...opts.biomarkers,
  };
  const environment: Environment = {
    co2Level: mockInitialState.co2Level,
    radiationRate: mockInitialState.radiationRate,
    radiationAccumulated: mockInitialState.radiationAccumulated,
    ...opts.environment,
  };
  const evaluatedAlerts = evaluateClinicalAlerts(
    { ...biomarkers, ...environment },
    Boolean(opts.alerts?.isEmergency)
  );
  const alerts: ClinicalAlerts = {
    ...evaluatedAlerts,
    ...opts.alerts,
  };
  const ruleTraces = evaluateRulesWithTrace({
    ...biomarkers,
    ...environment,
    ...alerts,
    behavioralCheckIn: opts.behavioralCheckIn,
  });
  const hasCriticalTrace = ruleTraces.some(
    (tr) => tr.triggered && tr.configuredSeverity === 'CRITICAL'
  );
  const hasAnyTrace = ruleTraces.some((tr) => tr.triggered);
  const globalSeverity =
    alerts.isEmergency || hasCriticalTrace
      ? 'CRITICAL'
      : hasAnyTrace
        ? 'WARNING'
        : 'OPTIMAL';

  const escalationLevel: EscalationLevel =
    opts.escalationLevel ??
    (alerts.isEmergency || opts.behavioralCheckIn?.selfHarmFlag
      ? 'emergency'
      : hasAnyTrace
        ? 'notify-flight-surgeon'
        : 'self-manage');

  const sleepHoursRecorded =
    opts.sleepHoursRecorded === undefined ? 7.2 : opts.sleepHoursRecorded;

  const systems = deriveSystemSnapshots({
    biomarkers,
    environment,
    alerts,
    sleepHoursRecorded,
  });

  return {
    biomarkers,
    environment,
    alerts,
    systems,
    worstSystemStatus: 'green',
    globalSeverity,
    nlr: computeNlr(biomarkers),
    cisCRatio: Number((biomarkers.cistatinaC / biomarkers.creatinina).toFixed(2)),
    isManualOverride: false,
    measuredAt: FRESH_ISO,
    source: 'sensor',
    indicatorMeta: opts.indicatorMeta ?? fullFreshMeta(),
    behavioralCheckIn: opts.behavioralCheckIn,
    sharePsychWithAi: false,
    escalationLevel,
    simulateOffline: false,
    sleepHoursRecorded,
    sleepIsFromToday: sleepHoursRecorded !== null,
    missionProfileId: 'LUNAR_ARTEMIS',
    comms: getMissionComms('LUNAR_ARTEMIS'),
    ruleTraces,
  };
}

describe('Command Center Tabs, NextAction, Mosaic & UI Store (Fase B)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useCommandUiStore.setState({
      activeTab: 'hoy',
      activeLogSection: 'vitals',
      selectedSystemId: null,
      focusGuideOnOpen: false,
      demoDrawerOpen: false,
      rulesModalOpen: false,
      copilotCollapsed: false,
      mobileCopilotOpen: false,
      showFullPanelInEmergency: false,
      spotDraft: null,
      pocDraft: null,
      behavioralDraft: null,
    });
    useCommandUiStore.getState().resetEmergencyChecklist();
  });

  it('parses legacy #mando and tab hashes deterministically', () => {
    expect(parseCommandTabHash('')).toBe('hoy');
    expect(parseCommandTabHash('#mando')).toBe('hoy');
    expect(parseCommandTabHash('#hoy')).toBe('hoy');
    expect(parseCommandTabHash(' #REGISTRAR ')).toBe('registrar');
    expect(parseCommandTabHash('#mision')).toBe('mision');
    expect(parseCommandTabHash('#tierra')).toBe('tierra');
    expect(parseCommandTabHash('#unknown')).toBe('hoy');
  });

  it('maps every rule id to its clinical mosaic system', () => {
    expect(mapRuleToSystemId('R1_HIDDEN_NEPHROPATHY')).toBe('renal');
    expect(mapRuleToSystemId('R2_RADIATION_IMMUNOSUPPRESSION')).toBe('radiation');
    expect(mapRuleToSystemId('R3_CO2_SUBCLINICAL')).toBe('cabin');
    expect(mapRuleToSystemId('R4_CODE_RED_EMERGENCY')).toBe('cardio');
    expect(mapRuleToSystemId('R5_BLOOD_PRESSURE')).toBe('cardio');
    expect(mapRuleToSystemId('R6_DYSGLYCEMIA')).toBe('metabolic');
    expect(mapRuleToSystemId('R7_THERMAL_ANOMALY')).toBe('metabolic');
    expect(mapRuleToSystemId('R8_BEHAVIORAL_RISK')).toBe('neural');
  });

  it('prioritizes NextAction tiers 1 through 6 in both ES and EN', () => {
    // Tier 1: Emergency
    const emergencySnap = makeSnapshot({
      alerts: { isEmergency: true },
      behavioralCheckIn: makeBehavioral(),
    });
    const t1Es = getNextAction(emergencySnap, { nowMs: NOW_MS }, 'es');
    const t1En = getNextAction(emergencySnap, { nowMs: NOW_MS }, 'en');
    expect(t1Es.tier).toBe(1);
    expect(t1Es.openEmergencyCard).toBe(true);
    expect(t1En.urgency).toBe('critical');
    expect(t1En.title).not.toBe(t1Es.title);

    // Tier 2: Warning rule firing (e.g. R3 CO2) & critical rule without emergency
    const co2Snap = makeSnapshot({
      environment: { co2Level: 4200 },
      behavioralCheckIn: makeBehavioral(),
    });
    const t2Warn = getNextAction(co2Snap, { nowMs: NOW_MS }, 'en');
    expect(t2Warn.tier).toBe(2);
    expect(t2Warn.urgency).toBe('warning');
    expect(t2Warn.targetSystemId).toBe('cabin');

    const bpWarnSnap = makeSnapshot({
      biomarkers: { systolicMmHg: 185, diastolicMmHg: 120 },
      behavioralCheckIn: makeBehavioral(),
      escalationLevel: 'notify-flight-surgeon',
      alerts: { isEmergency: false },
    });
    const t2Bp = getNextAction(bpWarnSnap, { nowMs: NOW_MS }, 'es');
    expect(t2Bp.tier).toBe(2);
    expect(t2Bp.urgency).toBe('warning');
    expect(t2Bp.targetSystemId).toBe('cardio');

    // Tier 3: Stale POC / Spot physical measurement
    const stalePocSnap = makeSnapshot({
      behavioralCheckIn: makeBehavioral(),
      indicatorMeta: {
        ...fullFreshMeta(),
        bloodPanel: { measuredAt: STALE_ISO, source: 'manual' },
      },
    });
    const t3Poc = getNextAction(stalePocSnap, { nowMs: NOW_MS }, 'en');
    expect(t3Poc.tier).toBe(3);
    expect(t3Poc.targetTab).toBe('registrar');
    expect(t3Poc.targetLogSection).toBe('poc');

    const staleBpSnap = makeSnapshot({
      behavioralCheckIn: makeBehavioral(),
      indicatorMeta: {
        ...fullFreshMeta(),
        bp: { measuredAt: STALE_ISO, source: 'manual' },
      },
    });
    const t3Vitals = getNextAction(staleBpSnap, { nowMs: NOW_MS }, 'es');
    expect(t3Vitals.tier).toBe(3);
    expect(t3Vitals.targetLogSection).toBe('vitals');

    // Tier 4: Behavioral check-in missing
    const noBehSnap = makeSnapshot({ behavioralCheckIn: undefined });
    const t4 = getNextAction(noBehSnap, { nowMs: NOW_MS }, 'es');
    expect(t4.tier).toBe(4);
    expect(t4.targetLogSection).toBe('behavioral');

    // Tier 5: Pending countermeasure
    const freshSnap = makeSnapshot({ behavioralCheckIn: makeBehavioral() });
    const t5 = getNextAction(
      freshSnap,
      { nowMs: NOW_MS, pendingCountermeasureTitle: 'ARED Loading' },
      'en'
    );
    expect(t5.tier).toBe(5);
    expect(t5.targetTab).toBe('mision');
    expect(t5.title).toContain('ARED Loading');

    // Tier 6: Nominal
    const t6 = getNextAction(freshSnap, { nowMs: NOW_MS }, 'en');
    expect(t6.tier).toBe(6);
    expect(t6.urgency).toBe('nominal');
  });

  it('derives all 8 system tiles accurately across nominal, warning, critical, and missing states', () => {
    const nominalTiles = deriveSystemTiles(
      makeSnapshot({
        environment: { radiationRate: 12, radiationAccumulated: 10, co2Level: 800 },
        behavioralCheckIn: makeBehavioral(),
      }),
      'en',
      NOW_MS
    );
    expect(nominalTiles).toHaveLength(8);
    expect(nominalTiles.every((tile) => tile.status === 'green')).toBe(true);

    // Warning / amber branches
    const amberTiles = deriveSystemTiles(
      makeSnapshot({
        biomarkers: {
          cistatinaC: 1.45,
          calcioIonico: 2.65,
          linfocitos: 1100,
          neutrofilos: 3300, // NLR = 3.0 -> amber
          ctxNtxIndex: 1.45,
          aredLoadPct: 50,
          bodyTempC: 37.9,
        },
        environment: {
          co2Level: 3900,
          radiationRate: 45,
          radiationAccumulated: 40,
        },
        alerts: {
          isCo2Warning: false,
        },
        behavioralCheckIn: makeBehavioral({ stress: 5, mood: 2 }),
      }),
      'es',
      NOW_MS
    );
    expect(amberTiles.find((t) => t.id === 'cabin')?.status).toBe('amber');
    expect(amberTiles.find((t) => t.id === 'bone')?.status).toBe('amber');
    expect(amberTiles.find((t) => t.id === 'immune')?.status).toBe('amber');
    expect(amberTiles.find((t) => t.id === 'radiation')?.status).toBe('amber');

    // Missing & edge numeric branches (no BP, no bone, no glucose, no behavioral, NLR inf & NaN)
    const missingSnap = makeSnapshot({
      biomarkers: {
        systolicMmHg: undefined,
        diastolicMmHg: undefined,
        glucoseMgDl: undefined,
        bodyTempC: undefined,
        ctxNtxIndex: undefined,
        aredLoadPct: undefined,
        linfocitos: 0,
        neutrofilos: 1000, // NLR Infinity
      },
      behavioralCheckIn: undefined,
      sleepHoursRecorded: null,
      indicatorMeta: {},
    });
    const missingTiles = deriveSystemTiles(missingSnap, 'en', NOW_MS);
    expect(missingTiles.find((t) => t.id === 'bone')?.status).toBe('missing');
    expect(missingTiles.find((t) => t.id === 'metabolic')?.status).toBe('missing');
    expect(missingTiles.find((t) => t.id === 'neural')?.status).toBe('missing');
    expect(missingTiles.find((t) => t.id === 'immune')?.primaryValue).toBe('∞');

    // NaN NLR + Red bone + Sleep-only neural
    const edgeSnap = makeSnapshot({
      biomarkers: {
        linfocitos: 0,
        neutrofilos: 0, // NaN
        ctxNtxIndex: 1.75,
        p1npIndex: 0.7,
        bodyTempC: 36.6,
        glucoseMgDl: undefined,
      },
      alerts: {
        isCo2Warning: true,
        isRadiationWarning: true,
        isRenalWarning: true,
      },
      sleepHoursRecorded: 6.5,
    });
    const edgeTiles = deriveSystemTiles(edgeSnap, 'es', NOW_MS);
    expect(edgeTiles.find((t) => t.id === 'immune')?.primaryValue).toBe('—');
    expect(edgeTiles.find((t) => t.id === 'bone')?.status).toBe('red');
    expect(edgeTiles.find((t) => t.id === 'neural')?.primaryValue).toContain('6,5');
    expect(edgeTiles.find((t) => t.id === 'metabolic')?.guideId).toBe('temp');
  });

  it('persists UI store navigation, drafts, emergency checklist, and copilot collapse in localStorage', () => {
    const storeMap = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => storeMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storeMap.set(k, v);
        },
      },
    });

    const ui = useCommandUiStore.getState();
    ui.openLogSection('poc');
    expect(useCommandUiStore.getState().activeTab).toBe('registrar');
    expect(useCommandUiStore.getState().activeLogSection).toBe('poc');

    ui.openSystemDrawer('renal', true);
    expect(useCommandUiStore.getState().selectedSystemId).toBe('renal');
    expect(useCommandUiStore.getState().focusGuideOnOpen).toBe(true);
    ui.closeSystemDrawer();
    expect(useCommandUiStore.getState().selectedSystemId).toBeNull();

    ui.toggleDemoDrawer();
    expect(useCommandUiStore.getState().demoDrawerOpen).toBe(true);

    ui.setCopilotCollapsed(true);
    expect(storeMap.get('exovitals-copilot-collapsed')).toBe('1');
    useCommandUiStore.setState({ copilotCollapsed: false });
    ui.hydrateCopilotCollapsed();
    expect(useCommandUiStore.getState().copilotCollapsed).toBe(true);

    ui.setSpotDraft({
      systolic: 132,
      diastolic: 84,
      glucose: 105,
      glucoseCtx: 'postprandial',
      bodyTemp: 37.1,
      measuredInput: '',
    });
    expect(useCommandUiStore.getState().spotDraft?.systolic).toBe(132);
    ui.clearSpotDraft();
    expect(useCommandUiStore.getState().spotDraft).toBeNull();

    ui.setPocDraft({
      cistatinaC: 1.5,
      creatinina: 1.0,
      calcioIonico: 2.5,
      linfocitos: 1400,
      neutrofilos: 3500,
      cortisol: 16,
    });
    expect(useCommandUiStore.getState().pocDraft?.cistatinaC).toBe(1.5);
    ui.clearPocDraft();
    expect(useCommandUiStore.getState().pocDraft).toBeNull();

    ui.setBehavioralDraft({
      mood: 3,
      sleepQuality: 3,
      fatigue: 3,
      stress: 3,
      workload: 4,
      socialContact: 3,
      phq2Anhedonia: 1,
      phq2Dysphoria: 0,
      selfHarmFlag: false,
      shareWithAi: true,
      step: 2,
      showAll: false,
    });
    expect(useCommandUiStore.getState().behavioralDraft?.step).toBe(2);
    ui.clearBehavioralDraft();
    expect(useCommandUiStore.getState().behavioralDraft).toBeNull();

    ui.toggleEmergencyStep('s1');
    expect(useCommandUiStore.getState().emergencyChecklist.s1).toBe(true);
    ui.resetEmergencyChecklist();
    expect(useCommandUiStore.getState().emergencyChecklist.s1).toBe(false);
  });
});
