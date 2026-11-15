'use client';

import { AlertTriangle, Info, Siren } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { useScenarioStore } from '../../store/useScenarioStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import type { CrewProfile } from '../../types/profile';
import { getAlertSeverity } from '../../utils/clinicalEngine';
import { SCENARIO_EVENTS, type ScenarioEvent } from '../../utils/scenarios';
import CrewAvatar from '../profile/CrewAvatar';
import { crewText } from '../profile/crewText';

const LEVEL: Record<ScenarioEvent['level'], { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: 'border-cyan-500/40 text-cyan-200' },
  warning: { icon: AlertTriangle, cls: 'border-amber-500/60 text-amber-200' },
  critical: { icon: Siren, cls: 'border-red-500/70 text-red-200' },
};

/** Ficha del tripulante a bordo y bitácora de lo que le va pasando. */
export function CrewPanel({ profile }: { profile: CrewProfile }) {
  const { t } = useT();
  const elapsed = useScenarioStore((s) => s.elapsed);
  const tel = useTelemetryStore();
  const severity = getAlertSeverity(tel);
  const info = crewText(profile, t);
  const events =
    profile.scenario === 'live'
      ? []
      : SCENARIO_EVENTS[profile.scenario].filter((e) => e.at <= elapsed).slice().reverse();

  const status =
    severity === 'CRITICAL' || tel.spO2 < 90
      ? { label: t.crew.status.critical, cls: 'bg-red-500/15 text-red-200 border-red-500' }
      : severity === 'WARNING' || tel.heartRate > 110
        ? { label: t.crew.status.observing, cls: 'bg-amber-500/15 text-amber-200 border-amber-500' }
        : { label: t.crew.status.stable, cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-500' };

  return (
    <section aria-label={t.crew.onBoard} className="ev-glass ev-corners grid gap-6 rounded-xl p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="flex gap-4">
        <CrewAvatar profile={profile} className="h-24 w-24 shrink-0 rounded-xl" />
        <div className="min-w-0 space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-500">{t.crew.onBoard}</p>
          <h2 className="text-2xl font-black text-white leading-tight">{profile.name}</h2>
          <p className="text-sm text-slate-400">{info.role} · {profile.agency}</p>
          <span className={`inline-block rounded border px-2 py-0.5 text-xs font-black uppercase tracking-wider ${status.cls}`}>
            {status.label}
          </span>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-slate-500">{t.crew.age}</dt><dd>{profile.age}</dd></div>
            <div><dt className="text-xs text-slate-500">{t.crew.blood}</dt><dd>{profile.bloodType}</dd></div>
            <div><dt className="text-xs text-slate-500">{t.crew.height}</dt><dd>{profile.heightCm} cm</dd></div>
            <div><dt className="text-xs text-slate-500">{t.crew.weight}</dt><dd>{profile.weightKg} kg</dd></div>
          </dl>
          <p className="text-sm text-slate-400"><span className="text-slate-500">{t.crew.allergies}</span> {info.allergies}</p>
          <p className="text-sm italic text-slate-400">{info.history}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">{t.crew.logTitle}</h3>
          <p className="font-lead text-base text-slate-300">{t.crew.scenarioText[profile.scenario]}</p>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">
            {profile.scenario === 'live' ? t.crew.liveNoScript : t.crew.allGood}
          </p>
        ) : (
          <ol className="max-h-72 space-y-2 overflow-y-auto pr-1" aria-live="polite">
            {events.map((e) => {
              const L = LEVEL[e.level];
              const Icon = L.icon;
              const text = t.scenarioText[e.id];
              const action = 'action' in text ? text.action : undefined;
              return (
                <li key={e.id} className={`rounded-lg border-l-4 bg-slate-950/60 p-3 ${L.cls}`}>
                  <p className="flex items-center gap-2 font-black">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden /> {text.title}
                    <span className="ml-auto text-[10px] uppercase tracking-wider opacity-70">
                      {t.crew.levels[e.level]} · T+{e.at}s
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-300">{text.detail}</p>
                  {action && (
                    <p className="mt-1 text-sm text-slate-400"><span className="text-slate-500">{t.crew.whatToDo}</span> {action}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

export default CrewPanel;
