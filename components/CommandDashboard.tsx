'use client';

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BookOpen,
  ClipboardPlus,
  Clock,
  Compass,
  LayoutDashboard,
  SatelliteDish,
} from 'lucide-react';
import { useT } from '../i18n/I18nContext';
import { useClinicalSnapshot } from '../store/selectors';
import {
  type CommandTabId,
  type LogSectionId,
  useCommandUiStore,
} from '../store/useCommandUiStore';
import { useMissionStore } from '../store/useMissionStore';
import type { EvaluationStepId, MissionProfileId } from '../types/mission';
import { deriveDailyCountermeasures } from '../utils/countermeasures';
import { formatDecimal, formatRelativeAgeHours } from '../utils/formatters';
import { evaluateMeasurementSchedule } from '../utils/measurementSchedule';
import type { MissionSlug } from '../utils/missionChoice';
import { toDayKey } from '../utils/missionPlan';
import {
  deriveSystemTiles,
  getNextAction,
  parseCommandTabHash,
} from '../utils/nextAction';
import { ActiveAlertsStrip } from './command/ActiveAlertsStrip';
import { CopilotDock } from './command/CopilotDock';
import { DemoModeDrawer } from './command/DemoModeDrawer';
import { EmergencyBanner, EmergencyCard } from './command/EmergencyView';
import { GlobalStatusBar } from './command/GlobalStatusBar';
import { NextActionBanner } from './command/NextActionBanner';
import { RulesModal } from './command/RulesModal';
import { SystemDetailDrawer } from './command/SystemDetailDrawer';
import { SystemMosaic } from './command/SystemMosaic';
import { TodayRoutineCard } from './command/TodayRoutineCard';
import OutboxPanel from './OutboxPanel';
import SbarReportModal from './SbarReportModal';
import SensorSimulator from './SensorSimulator';
import BehavioralCheckIn from './mission/BehavioralCheckIn';
import MissionCenter from './mission/MissionCenter';
import QuickMeasurementPanel from './mission/QuickMeasurementPanel';
import TodayCountermeasures from './mission/TodayCountermeasures';

const TAB_ORDER: CommandTabId[] = ['hoy', 'registrar', 'mision', 'tierra'];
const LOG_SECTIONS: LogSectionId[] = ['vitals', 'poc', 'behavioral'];

export function CommandDashboard({ mision }: { mision?: MissionSlug }) {
  const { t, lang } = useT();
  const snapshot = useClinicalSnapshot(mision);

  const records = useMissionStore((s) => s.records);
  const session = useMissionStore((s) => s.session);

  const activeTab = useCommandUiStore((s) => s.activeTab);
  const setActiveTab = useCommandUiStore((s) => s.setActiveTab);
  const activeLogSection = useCommandUiStore((s) => s.activeLogSection);
  const setActiveLogSection = useCommandUiStore((s) => s.setActiveLogSection);
  const setDemoDrawerOpen = useCommandUiStore((s) => s.setDemoDrawerOpen);
  const toggleDemoDrawer = useCommandUiStore((s) => s.toggleDemoDrawer);
  const setRulesModalOpen = useCommandUiStore((s) => s.setRulesModalOpen);
  const showFullPanelInEmergency = useCommandUiStore(
    (s) => s.showFullPanelInEmergency
  );

  const [sbarOpen, setSbarOpen] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const commandRootRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedHashRef = useRef(false);
  const userChangedTabRef = useRef(false);
  const tabRefs = useRef<Partial<Record<CommandTabId, HTMLButtonElement | null>>>(
    {}
  );

  const selectTabWithSync = (tab: CommandTabId) => {
    userChangedTabRef.current = true;
    setActiveTab(tab);
  };

  // Tick 60s for freshness calculations without Date.now() during SSR
  useEffect(() => {
    const t0 = window.setTimeout(() => setNowMs(Date.now()), 0);
    const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(interval);
    };
  }, []);

  // Initialize hash (#mando -> #hoy), ?demo=1, and subscribe to hashchange + Shift+D
  useEffect(() => {
    const applyHashFromUrl = () => {
      const rawHash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
      const parsed = parseCommandTabHash(window.location.hash);
      setActiveTab(parsed);
      if (rawHash === 'mando') {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}#hoy`
        );
      } else if (
        rawHash === 'hoy' ||
        rawHash === 'registrar' ||
        rawHash === 'mision' ||
        rawHash === 'tierra'
      ) {
        commandRootRef.current?.scrollIntoView({ block: 'start' });
      }
    };

    applyHashFromUrl();
    hasInitializedHashRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
      setDemoDrawerOpen(true);
    }

    const onHashChange = () => {
      applyHashFromUrl();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.toLowerCase() === 'd'
      ) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        toggleDemoDrawer();
      }
    };

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setActiveTab, setDemoDrawerOpen, toggleDemoDrawer]);

  // Keep URL hash in sync whenever user changes tab or deep-links into a non-default tab
  useEffect(() => {
    if (!hasInitializedHashRef.current) return;
    const rawHash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
    if (!rawHash && activeTab === 'hoy' && !userChangedTabRef.current) return;
    const expectedHash = `#${activeTab}`;
    if (window.location.hash.toLowerCase() !== expectedHash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}${expectedHash}`
      );
    }
  }, [activeTab]);

  const effectiveNowMs = nowMs ?? 0;
  const todayKey = useMemo(
    () => (nowMs !== null ? toDayKey(new Date(nowMs)) : toDayKey(new Date())),
    [nowMs]
  );

  const pendingCountermeasureTitle = useMemo(() => {
    const plan = deriveDailyCountermeasures({
      biomarkers: snapshot.biomarkers,
      environment: snapshot.environment,
      alerts: snapshot.alerts,
      missionProfileId: snapshot.missionProfileId,
      lang,
    });
    const sessionToday = session?.date === todayKey ? session : null;
    const completedSet = new Set<EvaluationStepId>([
      ...(sessionToday?.completedSteps ?? []),
      ...(records[todayKey]?.completedSteps ?? []),
    ]);
    const nextPending = plan.items.find(
      (item) => item.priority !== 'hold' && !completedSet.has(item.stepId)
    );
    return nextPending?.title ?? null;
  }, [
    lang,
    records,
    session,
    snapshot.alerts,
    snapshot.biomarkers,
    snapshot.environment,
    snapshot.missionProfileId,
    todayKey,
  ]);

  const nextAction = useMemo(
    () =>
      getNextAction(
        snapshot,
        {
          pendingCountermeasureTitle,
          nowMs: effectiveNowMs,
        },
        lang
      ),
    [effectiveNowMs, lang, pendingCountermeasureTitle, snapshot]
  );

  const tiles = useMemo(
    () => deriveSystemTiles(snapshot, lang, effectiveNowMs),
    [effectiveNowMs, lang, snapshot]
  );

  const schedule = useMemo(() => {
    if (nowMs === null) return [];
    return evaluateMeasurementSchedule(
      snapshot.indicatorMeta,
      nowMs,
      snapshot.behavioralCheckIn?.updatedAt
    );
  }, [nowMs, snapshot.behavioralCheckIn?.updatedAt, snapshot.indicatorMeta]);

  const isEmergencyActive =
    snapshot.alerts.isEmergency || snapshot.escalationLevel === 'emergency';

  const preferredProfile: MissionProfileId | undefined =
    mision === 'marte'
      ? 'MARS_CONJUNCTION'
      : mision === 'luna'
        ? 'LUNAR_ARTEMIS'
        : undefined;

  const tabsMeta: Array<{
    id: CommandTabId;
    label: string;
    Icon: typeof LayoutDashboard;
  }> = [
    { id: 'hoy', label: t.command.tabs.today, Icon: LayoutDashboard },
    { id: 'registrar', label: t.command.tabs.log, Icon: ClipboardPlus },
    { id: 'mision', label: t.command.tabs.mission, Icon: Compass },
    { id: 'tierra', label: t.command.tabs.earth, Icon: SatelliteDish },
  ];

  const handleTabKeyDown = (
    e: ReactKeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TAB_ORDER.length;
    else if (e.key === 'ArrowLeft')
      nextIdx = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TAB_ORDER.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const targetTab = TAB_ORDER[nextIdx];
      selectTabWithSync(targetTab);
      tabRefs.current[targetTab]?.focus();
    }
  };

  return (
    <div
      ref={commandRootRef}
      className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 font-mono px-3 py-2.5 sm:px-5 sm:py-3"
    >
      <SensorSimulator />

      <div className="max-w-[1440px] mx-auto space-y-2.5">
        {/* Global compact telemetry + comms + Demo drawer gear bar */}
        <GlobalStatusBar snapshot={snapshot} />

        {/* Persistent Code Red / Emergency Banner across all 4 tabs */}
        {isEmergencyActive && <EmergencyBanner />}

        {/* Primary 4-tab Command Navigation */}
        <nav aria-label={t.command.tabs.tablistAria}>
          <div
            role="tablist"
            aria-label={t.command.tabs.tablistAria}
            className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/75 p-1"
          >
            {tabsMeta.map(({ id, label, Icon }, idx) => {
              const selected = activeTab === id;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    tabRefs.current[id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTabWithSync(id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`min-h-[44px] inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    selected
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Workspace + Sticky Collapsible Copilot Column */}
        <div className="flex flex-col xl:flex-row gap-3 items-start">
          <div className="flex-1 min-w-0 w-full">
            {activeTab === 'hoy' && (
              <div
                role="tabpanel"
                id="panel-hoy"
                aria-labelledby="tab-hoy"
                className="space-y-2.5"
              >
                {isEmergencyActive && !showFullPanelInEmergency ? (
                  <EmergencyCard snapshot={snapshot} mision={mision} />
                ) : (
                  <>
                    <NextActionBanner recommendation={nextAction} />
                    <SystemMosaic tiles={tiles} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-stretch">
                      <ActiveAlertsStrip
                        traces={snapshot.ruleTraces}
                        onOpenSbar={() => setSbarOpen(true)}
                      />
                      <TodayRoutineCard mision={mision} />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'registrar' && (
              <div
                role="tabpanel"
                id="panel-registrar"
                aria-labelledby="tab-registrar"
                className="space-y-3"
              >
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
                        {t.command.logTab.title}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {t.command.logTab.subtitle}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {LOG_SECTIONS.map((sec) => {
                        const active = activeLogSection === sec;
                        return (
                          <button
                            key={sec}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setActiveLogSection(sec)}
                            className={`min-h-[44px] px-3.5 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider cursor-pointer transition ${
                              active
                                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                                : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {t.command.logTab.tabs[sec]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {schedule.length > 0 && (
                    <div
                      className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80"
                      aria-label={t.command.logTab.freshnessTitle}
                    >
                      <span className="text-[11px] font-bold uppercase text-slate-400 mr-1">
                        {t.command.logTab.freshnessTitle}:
                      </span>
                      {schedule.map((item) => (
                        <span
                          key={item.key}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                            item.isStale
                              ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                          }`}
                        >
                          <Clock className="h-3 w-3 shrink-0" aria-hidden />
                          <span>{item.label[lang]}:</span>
                          <span>
                            {item.neverMeasured || item.ageHours === null
                              ? t.quickMeasure.pendingToday
                              : item.isStale
                                ? `${t.quickMeasure.stalePrefix} (${formatDecimal(item.ageHours, 1, lang)} h)`
                                : formatRelativeAgeHours(item.ageHours, lang)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {activeLogSection === 'vitals' && (
                  <QuickMeasurementPanel sectionFilter="vitals" hideSchedule />
                )}
                {activeLogSection === 'poc' && (
                  <QuickMeasurementPanel sectionFilter="poc" hideSchedule />
                )}
                {activeLogSection === 'behavioral' && <BehavioralCheckIn />}
              </div>
            )}

            {activeTab === 'mision' && (
              <div
                role="tabpanel"
                id="panel-mision"
                aria-labelledby="tab-mision"
                className="space-y-4"
              >
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
                    {t.command.missionTab.title}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {t.command.missionTab.subtitle}
                  </p>
                </div>
                <TodayCountermeasures
                  mision={mision}
                  todayOverride={todayKey}
                  compactMode
                />
                <MissionCenter preferredProfile={preferredProfile} />
              </div>
            )}

            {activeTab === 'tierra' && (
              <div
                role="tabpanel"
                id="panel-tierra"
                aria-labelledby="tab-tierra"
                className="space-y-4"
              >
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
                    {t.command.earthTab.title}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {t.command.earthTab.subtitle}
                  </p>
                </div>
                <OutboxPanel mision={mision} />
              </div>
            )}
          </div>

          <CopilotDock mision={mision} />
        </div>

        {/* Compact footer: Prototype notice & Rules/Limitations Modal launcher */}
        <footer className="border-t border-slate-800/80 pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <p>{t.command.footer.prototypeDisclaimer}</p>
          <button
            type="button"
            onClick={() => setRulesModalOpen(true)}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-cyan-300 cursor-pointer transition"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            <span>{t.command.footer.rulesModalBtn}</span>
          </button>
        </footer>
      </div>

      {/* Drawers & Modals */}
      <SystemDetailDrawer tiles={tiles} />
      <DemoModeDrawer />
      <RulesModal traces={snapshot.ruleTraces} />
      <SbarReportModal
        open={sbarOpen}
        onClose={() => setSbarOpen(false)}
        mision={mision}
      />
    </div>
  );
}

export default CommandDashboard;
