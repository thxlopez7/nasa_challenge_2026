'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ShieldAlert, ShieldCheck } from 'lucide-react';
import { CLINICAL_RULES, RULES_VERSION } from '../config/rules';
import { useT } from '../i18n/I18nContext';

export function RulesAndLimitationsSection() {
  const { lang } = useT();
  const [expanded, setExpanded] = useState<boolean>(false);

  const copy =
    lang === 'es'
      ? {
          eyebrow: 'TRANSPARENCIA CLÍNICA Y EVIDENCIA',
          title: `Reglas, umbrales y limitaciones del motor (v${RULES_VERSION})`,
          disclaimer:
            'Aviso de prototipo: ExoVitals es una herramienta de apoyo a la decisión clínica (CDSS) para simulación e investigación en misiones análogas. No sustituye juicio médico ni ha sido validado como dispositivo médico de vuelo.',
          toggleOpen: 'Ocultar matriz completa',
          toggleClosed: `Explorar las ${CLINICAL_RULES.length} reglas, fuentes y diagnóstico diferencial`,
          headers: {
            rule: 'Regla',
            threshold: 'Criterio y umbral',
            limitations: 'Diagnóstico diferencial y limitaciones',
            source: 'Fuente y verificación',
          },
          verified: 'Referencia clínica verificada',
          unverified: 'Prototipo · pendiente validación operativa',
        }
      : {
          eyebrow: 'CLINICAL TRANSPARENCY & EVIDENCE',
          title: `Engine Rules, Thresholds & Limitations (v${RULES_VERSION})`,
          disclaimer:
            'Prototype disclaimer: ExoVitals is a clinical decision-support prototype for operational/educational simulation. It is not an approved flight medical device and does not replace physician judgment.',
          toggleOpen: 'Hide full rule table',
          toggleClosed: `Inspect all ${CLINICAL_RULES.length} rules, sources & differential limitations`,
          headers: {
            rule: 'Rule',
            threshold: 'Criterion & Threshold',
            limitations: 'Differential Diagnosis & Limitations',
            source: 'Source & Verification',
          },
          verified: 'Verified clinical reference',
          unverified: 'Prototype · operational validation pending',
        };

  return (
    <section
      id="rules-and-limitations"
      className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-bold tracking-widest uppercase text-cyan-400">
            {copy.eyebrow}
          </p>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400 shrink-0" aria-hidden="true" />
            <span>{copy.title}</span>
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          <span>{expanded ? copy.toggleOpen : copy.toggleClosed}</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3.5 text-xs text-amber-100 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">{copy.disclaimer}</p>
      </div>

      {expanded && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 uppercase text-[11px] tracking-wider">
                <th className="p-3 font-semibold">{copy.headers.rule}</th>
                <th className="p-3 font-semibold">{copy.headers.threshold}</th>
                <th className="p-3 font-semibold">{copy.headers.limitations}</th>
                <th className="p-3 font-semibold">{copy.headers.source}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
              {CLINICAL_RULES.map((rule) => (
                <tr key={rule.id} className="align-top hover:bg-slate-800/30">
                  <td className="p-3 min-w-[180px]">
                    <div className="font-mono font-bold text-cyan-300">
                      {rule.shortCode} · v{rule.version}
                    </div>
                    <div className="font-semibold text-slate-100 mt-0.5">
                      {rule.title[lang]}
                    </div>
                  </td>
                  <td className="p-3 min-w-[220px] text-slate-200 font-mono leading-relaxed">
                    {rule.summary[lang]}
                  </td>
                  <td className="p-3 min-w-[260px] text-slate-300 leading-relaxed">
                    {rule.limitations[lang]}
                  </td>
                  <td className="p-3 min-w-[200px] space-y-2">
                    <p className="text-slate-300 leading-relaxed">{rule.source}</p>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                        rule.verified
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {rule.verified ? (
                        <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                      )}
                      {rule.verified ? copy.verified : copy.unverified}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default RulesAndLimitationsSection;
