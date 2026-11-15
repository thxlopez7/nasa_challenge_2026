'use client';

import { AlertTriangle, Info, Siren } from 'lucide-react';
import { useScenarioStore } from '../../store/useScenarioStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import type { CrewProfile } from '../../types/profile';
import { getAlertSeverity } from '../../utils/clinicalEngine';
import { SCENARIO_EVENTS, type ScenarioEvent } from '../../utils/scenarios';
import AstroAvatar from '../profile/AstroAvatar';

const LEVEL: Record<ScenarioEvent['level'], { icon: typeof Info; cls: string; label: string }> = {
  info: { icon: Info, cls: 'border-cyan-500/40 text-cyan-200', label: 'Leve' },
  warning: { icon: AlertTriangle, cls: 'border-amber-500/60 text-amber-200', label: 'Precaución' },
  critical: { icon: Siren, cls: 'border-red-500/70 text-red-200', label: 'Crítico' },
};

const SCENARIO_TEXT = {
  critical: 'Escenario crítico: la situación clínica empeora hasta que el tripulante no puede comunicarse y ExoVitals alerta a Tierra.',
  stable: 'Escenario estable: el tripulante se mantiene sano, con molestias habituales de la adaptación al espacio.',
  live: 'Telemetría en vivo desde el dataset de sensores.',
};

/** Ficha del tripulante a bordo y bitácora de lo que le va pasando. */
export function CrewPanel({ profile }: { profile: CrewProfile }) {
  const elapsed = useScenarioStore((s) => s.elapsed);
  const t = useTelemetryStore();
  const severity = getAlertSeverity(t);
  const events =
    profile.scenario === 'live'
      ? []
      : SCENARIO_EVENTS[profile.scenario].filter((e) => e.at <= elapsed).slice().reverse();

  const status =
    severity === 'CRITICAL' || t.spO2 < 90
      ? { label: 'Crítico', cls: 'bg-red-500/15 text-red-200 border-red-500' }
      : severity === 'WARNING' || t.heartRate > 110
        ? { label: 'En observación', cls: 'bg-amber-500/15 text-amber-200 border-amber-500' }
        : { label: 'Estable', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-500' };

  return (
    <section aria-label="Tripulante a bordo" className="grid gap-6 rounded-xl border border-slate-800 bg-slate-900 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="flex gap-4">
        <AstroAvatar id={profile.avatar} className="h-24 w-24 shrink-0 rounded-xl" />
        <div className="min-w-0 space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-500">Tripulante a bordo</p>
          <h2 className="text-2xl font-black text-white leading-tight">{profile.name}</h2>
          <p className="text-sm text-slate-400">{profile.role} · {profile.agency}</p>
          <span className={`inline-block rounded border px-2 py-0.5 text-xs font-black uppercase tracking-wider ${status.cls}`}>
            {status.label}
          </span>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-slate-500">Edad</dt><dd>{profile.age}</dd></div>
            <div><dt className="text-xs text-slate-500">Grupo</dt><dd>{profile.bloodType}</dd></div>
            <div><dt className="text-xs text-slate-500">Altura</dt><dd>{profile.heightCm} cm</dd></div>
            <div><dt className="text-xs text-slate-500">Peso</dt><dd>{profile.weightKg} kg</dd></div>
          </dl>
          <p className="text-sm text-slate-400"><span className="text-slate-500">Alergias:</span> {profile.allergies}</p>
          <p className="text-sm italic text-slate-400">{profile.history}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">Bitácora del tripulante</h3>
          <p className="font-lead text-base text-slate-300">{SCENARIO_TEXT[profile.scenario]}</p>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">
            {profile.scenario === 'live' ? 'Sin guion: sigue las alertas del motor RIDGE.' : 'Todo en orden por ahora.'}
          </p>
        ) : (
          <ol className="max-h-72 space-y-2 overflow-y-auto pr-1" aria-live="polite">
            {events.map((e) => {
              const L = LEVEL[e.level];
              const Icon = L.icon;
              return (
                <li key={e.at} className={`rounded-lg border-l-4 bg-slate-950/60 p-3 ${L.cls}`}>
                  <p className="flex items-center gap-2 font-black">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden /> {e.title}
                    <span className="ml-auto text-[10px] uppercase tracking-wider opacity-70">{L.label} · T+{e.at}s</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-300">{e.detail}</p>
                  {e.action && <p className="mt-1 text-sm text-slate-400"><span className="text-slate-500">Qué hacer:</span> {e.action}</p>}
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
