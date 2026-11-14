'use client';

import { AlertTriangle, CheckCircle2, Siren } from 'lucide-react';
import type { Diagnosis } from '../../types/mission';

const STYLES = {
  OPTIMAL: { box: 'border-cyan-500/40 bg-cyan-500/5', text: 'text-cyan-300', label: 'Sin hallazgos' },
  WARNING: { box: 'border-amber-500/60 bg-amber-500/5', text: 'text-amber-300', label: 'Atención' },
  CRITICAL: { box: 'border-red-500/70 bg-red-500/10', text: 'text-red-300', label: 'Crítico' },
} as const;

/** Lista de hallazgos del diagnóstico determinista, con icono + texto. */
export function DiagnosticPanel({
  diagnosis,
  title = 'Diagnóstico',
}: {
  diagnosis: Diagnosis;
  title?: string;
}) {
  const s = STYLES[diagnosis.severity];

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${s.box}`}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-slate-100">{title}</h4>
        <span className={`text-xs font-bold uppercase tracking-wider ${s.text}`}>
          {s.label}
        </span>
      </div>

      {diagnosis.findings.length === 0 ? (
        <p className="flex items-start gap-2 text-sm text-slate-300">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-cyan-400" aria-hidden />
          Biomarcadores dentro de rango y autoevaluación sin señales de alerta.
        </p>
      ) : (
        <ul className="space-y-3">
          {diagnosis.findings.map((f) => {
            const critical = f.severity === 'CRITICAL';
            const Icon = critical ? Siren : AlertTriangle;
            return (
              <li key={f.id} className="flex items-start gap-2">
                <Icon
                  className={`h-4 w-4 mt-0.5 shrink-0 ${critical ? 'text-red-400' : 'text-amber-400'}`}
                  aria-label={critical ? 'Crítico' : 'Atención'}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">{f.title}</p>
                  <p className="text-xs text-slate-400">{f.detail}</p>
                  <p className="text-xs text-slate-200 mt-1">→ {f.action}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-slate-500">
        Orientación automática basada en reglas fijas. No sustituye la valoración
        del cirujano de vuelo.
      </p>
    </div>
  );
}

export default DiagnosticPanel;
