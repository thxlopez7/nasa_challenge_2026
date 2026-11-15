'use client';

import { create } from 'zustand';
import type { GlucoseContext } from '../types/telemetry';

export type CommandTabId = 'hoy' | 'registrar' | 'mision' | 'tierra';
export type LogSectionId = 'vitals' | 'poc' | 'behavioral';
export type CommandSystemId =
  | 'cardio'
  | 'cabin'
  | 'radiation'
  | 'renal'
  | 'immune'
  | 'bone'
  | 'metabolic'
  | 'neural';

export type EmergencyStepKey = 's1' | 's2' | 's3' | 's4' | 's5';

export interface SpotDraft {
  systolic: number;
  diastolic: number;
  glucose: number;
  glucoseCtx: GlucoseContext;
  bodyTemp: number;
  measuredInput: string;
}

export interface PocDraft {
  cistatinaC: number;
  creatinina: number;
  calcioIonico: number;
  linfocitos: number;
  neutrofilos: number;
  cortisol: number;
}

export interface BehavioralDraft {
  mood: number;
  sleepQuality: number;
  fatigue: number;
  stress: number;
  workload: number;
  socialContact: number;
  phq2Anhedonia: 0 | 1 | 2 | 3;
  phq2Dysphoria: 0 | 1 | 2 | 3;
  selfHarmFlag: boolean;
  shareWithAi?: boolean;
  step: 0 | 1 | 2 | 3;
  showAll: boolean;
}

const COPILOT_STORAGE_KEY = 'exovitals-copilot-collapsed';

const DEFAULT_CHECKLIST: Record<EmergencyStepKey, boolean> = {
  s1: false,
  s2: false,
  s3: false,
  s4: false,
  s5: false,
};

interface CommandUiState {
  activeTab: CommandTabId;
  activeLogSection: LogSectionId;
  selectedSystemId: CommandSystemId | null;
  focusGuideOnOpen: boolean;
  demoDrawerOpen: boolean;
  rulesModalOpen: boolean;
  copilotCollapsed: boolean;
  mobileCopilotOpen: boolean;
  showFullPanelInEmergency: boolean;
  spotDraft: SpotDraft | null;
  pocDraft: PocDraft | null;
  behavioralDraft: BehavioralDraft | null;
  emergencyChecklist: Record<EmergencyStepKey, boolean>;

  setActiveTab: (tab: CommandTabId) => void;
  setActiveLogSection: (section: LogSectionId) => void;
  openLogSection: (section: LogSectionId) => void;
  openSystemDrawer: (id: CommandSystemId, focusGuide?: boolean) => void;
  closeSystemDrawer: () => void;
  setDemoDrawerOpen: (open: boolean) => void;
  toggleDemoDrawer: () => void;
  setRulesModalOpen: (open: boolean) => void;
  setCopilotCollapsed: (collapsed: boolean) => void;
  toggleCopilotCollapsed: () => void;
  hydrateCopilotCollapsed: () => void;
  setMobileCopilotOpen: (open: boolean) => void;
  setShowFullPanelInEmergency: (show: boolean) => void;
  setSpotDraft: (draft: SpotDraft) => void;
  clearSpotDraft: () => void;
  setPocDraft: (draft: PocDraft) => void;
  clearPocDraft: () => void;
  setBehavioralDraft: (draft: BehavioralDraft) => void;
  clearBehavioralDraft: () => void;
  toggleEmergencyStep: (step: EmergencyStepKey) => void;
  resetEmergencyChecklist: () => void;
}

function writeCopilotStorage(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COPILOT_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

export const useCommandUiStore = create<CommandUiState>()((set, get) => ({
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
  emergencyChecklist: { ...DEFAULT_CHECKLIST },

  setActiveTab: (activeTab) => set({ activeTab }),
  setActiveLogSection: (activeLogSection) => set({ activeLogSection }),
  openLogSection: (activeLogSection) => set({ activeTab: 'registrar', activeLogSection }),
  openSystemDrawer: (selectedSystemId, focusGuide = false) =>
    set({ selectedSystemId, focusGuideOnOpen: focusGuide }),
  closeSystemDrawer: () => set({ selectedSystemId: null, focusGuideOnOpen: false }),
  setDemoDrawerOpen: (demoDrawerOpen) => set({ demoDrawerOpen }),
  toggleDemoDrawer: () => set({ demoDrawerOpen: !get().demoDrawerOpen }),
  setRulesModalOpen: (rulesModalOpen) => set({ rulesModalOpen }),
  setCopilotCollapsed: (copilotCollapsed) => {
    writeCopilotStorage(copilotCollapsed);
    set({ copilotCollapsed });
  },
  toggleCopilotCollapsed: () => {
    const next = !get().copilotCollapsed;
    writeCopilotStorage(next);
    set({ copilotCollapsed: next });
  },
  hydrateCopilotCollapsed: () => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(COPILOT_STORAGE_KEY);
      if (saved === '1' || saved === '0') {
        set({ copilotCollapsed: saved === '1' });
      }
    } catch {
      // ignore storage errors
    }
  },
  setMobileCopilotOpen: (mobileCopilotOpen) => set({ mobileCopilotOpen }),
  setShowFullPanelInEmergency: (showFullPanelInEmergency) =>
    set({ showFullPanelInEmergency }),
  setSpotDraft: (spotDraft) => set({ spotDraft }),
  clearSpotDraft: () => set({ spotDraft: null }),
  setPocDraft: (pocDraft) => set({ pocDraft }),
  clearPocDraft: () => set({ pocDraft: null }),
  setBehavioralDraft: (behavioralDraft) => set({ behavioralDraft }),
  clearBehavioralDraft: () => set({ behavioralDraft: null }),
  toggleEmergencyStep: (step) =>
    set((state) => ({
      emergencyChecklist: {
        ...state.emergencyChecklist,
        [step]: !state.emergencyChecklist[step],
      },
    })),
  resetEmergencyChecklist: () =>
    set({ emergencyChecklist: { ...DEFAULT_CHECKLIST } }),
}));
