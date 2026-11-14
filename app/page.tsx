"use client";
import React, { useState, useEffect } from "react";

type SystemId = "neuro" | "cardio" | "inmune" | "oseo" | "conducta";
type StatusColor = "green" | "amber" | "red";

interface SystemData {
  id: SystemId;
  name: string;
  short: string;
  metric: string;
  hazard: string;
  trend: number[];
  status: StatusColor;
  crewSummary: string;
  howToMeasure: string;
  crewAction: string;
  surgeonMetrics: string;
}

const SYSTEMS_DATA: Record<SystemId, SystemData> = {
  neuro: {
    id: "neuro", name: "Neurológico y Ocular (SANS)", short: "Neuro-ocular", metric: "ONSD 5.9 mm", hazard: "Gravedad alterada", trend: [38, 40, 44, 47, 52, 55, 58], status: "amber",
    crewSummary: "Presión de líquidos elevada hacia el cráneo por falta de gravedad.",
    howToMeasure: "Apoya el ecógrafo USB sobre el párpado cerrado o haz el test de cuadrícula.",
    crewAction: "Colócate el pantalón de presión negativa (LBNP) durante 45 min.",
    surgeonMetrics: "ONSD: 5.9 mm (Umbral > 5.8 mm) | HRV (RMSSD): 24 ms | Rejilla Amsler: Leve distorsión",
  },
  cardio: {
    id: "cardio", name: "Sistema Cardiovascular", short: "Cardiovascular", metric: "FC 68 lpm", hazard: "Gravedad alterada y entorno cerrado", trend: [20, 19, 21, 18, 20, 19, 18], status: "green",
    crewSummary: "Ritmo cardíaco y oxigenación estables para entorno de microgravedad.",
    howToMeasure: "Lectura pasiva continua mediante camiseta inteligente CSA Bio-Monitor.",
    crewAction: "Mantener protocolo estándar de hidratación (2.5L diarios).",
    surgeonMetrics: "FC: 68 lpm | MAP: 88 mmHg | SpO2: 98% | CO2 Cabina: 2100 ppm",
  },
  inmune: {
    id: "inmune", name: "Sistema Inmunológico", short: "Inmunológico", metric: "NLR 4.1", hazard: "Radiación", trend: [30, 34, 41, 55, 68, 79, 86], status: "red",
    crewSummary: "Defensas bajas por exposición a radiación solar reciente. Riesgo de infección.",
    howToMeasure: "Escanea el cartucho hematológico en el Bio-Analyzer con 1 gota de sangre.",
    crewAction: "1. Refúgiate en el módulo blindado por 8h. 2. Toma N-acetilcisteína (Botiquín A3 - Naranja).",
    surgeonMetrics: "Radiación: 0.92 mSv/día | Linfocitos: 890/µL | Índice NLR: 4.1 (Crítico > 3.5)",
  },
  oseo: {
    id: "oseo", name: "Sistema Óseo y Renal", short: "Óseo y renal", metric: "Ca2+ 1.24 mmol/L", hazard: "Gravedad alterada", trend: [24, 23, 25, 22, 21, 22, 20], status: "green",
    crewSummary: "Niveles de calcio controlados. Sin riesgo inmediato de cálculos renales.",
    howToMeasure: "Cartucho Renal (Azul) en Bio-Analyzer + registro de tiempo en máquina ARED.",
    crewAction: "Completar sesión diaria de 60 min de ejercicio resistivo en ARED.",
    surgeonMetrics: "Creatinina: 0.9 mg/dL | Cistatina C: 1.02 mg/L | Ca2+: 1.24 mmol/L | ARED: 65 min",
  },
  conducta: {
    id: "conducta", name: "Conducta y Sueño (Aislamiento)", short: "Conducta y sueño", metric: "Sueño 5.4 h",
    hazard: "Aislamiento y confinamiento", trend: [35, 38, 44, 49, 52, 58, 61], status: "amber",
    crewSummary: "El aislamiento y los turnos alteran el sueño y el ánimo. Detectarlo a tiempo evita errores en la misión.",
    howToMeasure: "Responde el cuestionario de 2 minutos y deja que el reloj registre tu sueño.",
    crewAction: "Protege 8 h de sueño con luz tenue y habla 15 min con un compañero o con Tierra.",
    surgeonMetrics: "Sueño: 5.4 h | Variabilidad de sueño: 82 min | PHQ-4: 5 (leve) | Contactos sociales: 1/día",
  },
};

// Posición del nodo y de su rótulo (side: 1 = derecha, -1 = izquierda)
const NODES = [
  { id: "neuro", cx: 222, cy: 50, lx: 276, side: 1 },
  { id: "conducta", cx: 178, cy: 50, lx: 124, side: -1 },
  { id: "cardio", cx: 214, cy: 128, lx: 276, side: 1 },
  { id: "inmune", cx: 178, cy: 172, lx: 124, side: -1 },
  { id: "oseo", cx: 181, cy: 284, lx: 124, side: -1 },
] as const;

const STATUS_LABEL: Record<StatusColor, string> = { green: "Óptimo", amber: "Precaución", red: "Crítico" };
// Color + forma + texto: nunca solo color
const STATUS_ICON: Record<StatusColor, string> = { green: "✓", amber: "▲", red: "■" };
const STATUS_FILL: Record<StatusColor, string> = { green: "#5fd39a", amber: "#ffa23a", red: "#ff5547" };
const ORDER = ["red", "amber", "green"];
const DAYS = ["D-6", "D-5", "D-4", "D-3", "D-2", "Ayer", "Hoy"];

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700&family=Barlow+Condensed:wght@600;700;800&family=IBM+Plex+Mono:wght@500&display=swap');
:root{--bg:#05070a;--line:#555b66;--ink:#f5f5f2;--dim:#b4b8bf;--y:#ffe600;--b:#1a73c8;--c:#00a8e8;--red:#ff5547}
.hud,.fam{font-family:'Barlow',system-ui,sans-serif}
.hud h1,.hud h2,.fam h1,.fam h2,.disp{font-family:'Barlow Condensed',sans-serif}
.hud{min-height:100vh;background:var(--bg);color:var(--ink);font-size:18px;padding:20px 28px 32px}
.hud :focus-visible,.fam :focus-visible{outline:2px solid var(--y);outline-offset:2px}
.stripe{height:9px;background:var(--b);margin:-20px -28px 20px}
.top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:20px}
.top h1{margin:0;font-size:clamp(34px,5vw,54px);font-weight:800;line-height:1}
.dek{margin:12px 0 0;padding-top:10px;border-top:1px dotted var(--line);max-width:58ch;color:#dcdcd6}
.dim{color:var(--dim)}
.kick{margin:0 0 8px;color:var(--y);font:800 19px 'Barlow Condensed',sans-serif;text-transform:uppercase}
.btn{min-height:48px;padding:0 18px;border:1px solid var(--line);background:none;color:var(--ink);font:600 17px 'Barlow',sans-serif;cursor:pointer}
.btn[aria-pressed=true]{background:var(--c);border-color:var(--c);color:#000}
.sos{min-height:52px;padding:0 26px;border:0;background:var(--red);color:#1a0705;font:800 22px 'Barlow Condensed',sans-serif;cursor:pointer}
.layout{display:grid;grid-template-columns:minmax(280px,1fr) minmax(300px,470px) 300px;gap:32px;margin-top:26px;align-items:start}
@media(max-width:1100px){.layout{grid-template-columns:1fr}}
.bar{display:flex;justify-content:space-between;gap:8px;background:var(--c);color:#000;font:800 21px 'Barlow Condensed',sans-serif;padding:2px 10px}
.srow{display:block;width:100%;padding:10px 0;background:none;border:0;border-bottom:1px dotted var(--line);color:inherit;font:inherit;text-align:left;cursor:pointer}
.srow[aria-pressed=true] .bar{background:var(--y)}
.srow small{display:block;margin-top:4px;font-size:16px;font-weight:600}
.sec{padding:12px 0;border-bottom:1px dotted var(--line)}
.sec h3{margin:0 0 4px;font:800 24px 'Barlow Condensed',sans-serif}
.sec p{margin:0;font-size:20px;line-height:1.45;max-width:56ch}
.sec p::before{content:"●";color:var(--y);margin-right:8px;font-size:.7em}
.mt{display:grid;grid-template-columns:1fr auto;gap:16px;padding:10px 0;border-bottom:1px dotted var(--line)}
.mono{font-family:'IBM Plex Mono',monospace;font-size:20px}
.ln{fill:rgba(245,245,242,.07);stroke:var(--ink);stroke-opacity:.85;stroke-width:1.3;stroke-linejoin:round}
.in{fill:none;stroke:var(--ink);stroke-opacity:.45;stroke-width:1.1}
.cn{font:800 17px 'Barlow Condensed',sans-serif;fill:var(--ink)}
.cs{font:700 12.5px 'Barlow',sans-serif}
.cm{font:500 11.5px 'IBM Plex Mono',monospace;fill:var(--dim)}
.node{cursor:pointer;outline:none}
.node:focus-visible .hit{stroke:var(--y);stroke-width:2.5}
.chart{display:grid;grid-template-columns:repeat(7,1fr);gap:10px;align-items:end;height:196px;border-bottom:2px solid var(--ink);background:repeating-linear-gradient(to top,transparent 0 39px,#2a2f38 39px 40px)}
.col{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px}
.cb{width:100%;max-width:64px}
.days{display:grid;grid-template-columns:repeat(7,1fr);gap:10px;text-align:center;margin-top:6px;color:var(--dim);font-size:15px}
.src{margin-top:20px;color:var(--dim);font-size:14px}
@keyframes scan{0%{transform:translateY(0)}100%{transform:translateY(330px)}}
@keyframes ring{0%{transform:scale(.8);opacity:.9}100%{transform:scale(1.9);opacity:0}}
@keyframes beat{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
@media (prefers-reduced-motion: no-preference){
  .scan{animation:scan 6s linear infinite}
  .ring{animation:ring 1.6s ease-out 3;transform-box:fill-box;transform-origin:center}
  .beat{animation:beat .545s ease-in-out infinite}
}`;

const STEPS = [
  { tag: "Seguridad 0G", title: "Detente. No flotes", kit: "Correas azules", chip: "bg-sky-500 text-[#0b0d11]",
    action: "Ancla al compañero a la camilla con las correas azules y engancha tus pies a los estribos.",
    checks: ["Correas azules ajustadas en pecho y piernas", "Tus pies anclados", "Objetos sueltos fuera del área"] },
  { tag: "Evaluar", title: "¿Responde? ¿Respira?", kit: "Banda Bio-Monitor", chip: "bg-cyan-400 text-[#0b0d11]",
    action: "Llámalo por su nombre y toca su hombro. Mira su pecho y escucha su respiración, máximo 10 segundos.",
    checks: ["Probé respuesta (voz y hombro)", "Revisé respiración 10 s", "Coloqué la banda Bio-Monitor"] },
  { tag: "Pedir ayuda", title: "Avisa ya", kit: "Alarma + intercomunicador", chip: "bg-amber-400 text-[#0b0d11]",
    action: "Activa la alarma, llama al Cirujano de Vuelo y a Control de Misión. Pide que traigan el maletín de emergencia.",
    checks: ["Alarma de cabina activada", "Cirujano de Vuelo avisado", "Control de Misión avisado"] },
  { tag: "Reanimación", title: "Compresiones al ritmo", kit: "Sin equipo: tus manos", chip: "bg-rose-500 text-white",
    action: "Si no respira: compresiones fuertes y rápidas en el centro del pecho, siguiendo el pulso de la pantalla.",
    checks: ["Manos en el centro del pecho", "Sigo el ritmo del círculo", "Relevo cada 2 minutos"] },
  { tag: "DEA y oxígeno", title: "Descarga y oxígeno", kit: "Tanque verde · 10 L/min", chip: "bg-emerald-400 text-[#0b0d11]",
    action: "Conecta la máscara al tanque verde. Pega los parches del DEA según el dibujo y sigue sus instrucciones de voz.",
    checks: ["Máscara de oxígeno conectada", "Parches DEA pegados", "Nadie toca al paciente durante la descarga"] },
];

function EmergencyProtocol({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const [confirmExit, setConfirmExit] = useState<boolean>(false);
  const [checked, setChecked] = useState<{ [k: string]: boolean }>({});

  useEffect(() => {
    const t = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const swap = 120 - (seconds % 120);
  const s = STEPS[step];
  const btn = "min-h-14 px-6 rounded-sm text-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

  return (
    <div className="fam min-h-screen bg-[#0b0d11] text-[#ebe6d8] p-4 md:p-6 flex flex-col gap-5 border-4 border-rose-500">
      <style>{GLOBAL_CSS}</style>

      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#ffe600]">■ EMERGENCIA: COLAPSO EN 0G</h1>
          <p className="text-sm text-[#b9bbb3]">Contenido ilustrativo. Validar con un cirujano de vuelo.</p>
        </div>
        <div className="text-center bg-[#14171c] border border-rose-500/60 rounded-sm px-5 py-2" role="timer" aria-label="Tiempo desde el colapso">
          <div className="text-sm text-[#b9bbb3]">Tiempo desde el colapso</div>
          <div className="font-mono text-4xl font-black text-white">{mm}:{ss}</div>
        </div>
        {!confirmExit ? (
          <button onClick={() => setConfirmExit(true)} className={`${btn} bg-[#1d2128] border border-slate-500`}>Salir</button>
        ) : (
          <div className="flex items-center gap-2" role="alertdialog" aria-label="Confirmar salida">
            <span className="font-semibold">¿Cerrar el protocolo?</span>
            <button onClick={onExit} className={`${btn} bg-rose-600`}>Sí, salir</button>
            <button onClick={() => setConfirmExit(false)} className={`${btn} bg-[#2b3039]`}>Continuar</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {STEPS.map((p, i) => (
          <button key={p.tag} onClick={() => setStep(i)} aria-current={i === step}
            className={`min-h-14 rounded-sm border text-sm font-semibold px-1 ${
              i === step ? "bg-rose-600 border-rose-300 text-white" : i < step ? "bg-emerald-900/50 border-emerald-500 text-emerald-200" : "bg-[#14171c] border-[#2b3039] text-[#b9bbb3]"
            }`}>
            {i < step ? "✓" : i + 1} <span className="hidden md:inline">{p.tag}</span>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-12 gap-5 flex-1">
        <section className="md:col-span-7 bg-[#14171c] border-2 border-rose-500 rounded-sm p-6 flex flex-col gap-4">
          <span className="text-base font-bold text-[#ffe600]">Paso {step + 1} de {STEPS.length} · {s.tag}</span>
          <h2 className="text-4xl font-black leading-tight">{s.title}</h2>
          <p className="text-xl leading-relaxed">{s.action}</p>
          <div className="flex flex-col gap-2 mt-auto">
            {s.checks.map((c, i) => {
              const k = `${step}-${i}`;
              return (
                <button key={k} role="checkbox" aria-checked={!!checked[k]}
                  onClick={() => setChecked((prev) => ({ ...prev, [k]: !prev[k] }))}
                  className={`min-h-14 text-left px-4 rounded-sm border text-lg ${checked[k] ? "bg-emerald-900/50 border-emerald-500" : "bg-[#0b0d11] border-[#3d4552]"}`}>
                  {checked[k] ? "✓" : "○"} {c}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="md:col-span-5 bg-[#14171c] border border-[#2b3039] rounded-sm p-6 flex flex-col items-center justify-center gap-4 text-center">
          {step === 3 ? (
            <>
              <div className="beat w-44 h-44 rounded-full bg-rose-600 flex items-center justify-center text-5xl font-black" aria-hidden="true">■</div>
              <div className="text-3xl font-black">100–120 / min</div>
              <p className="text-lg">Profundidad 5–6 cm. Deja que el pecho suba entre compresiones.</p>
              <p className="font-mono text-xl text-amber-300">Relevo en {Math.floor(swap / 60)}:{String(swap % 60).padStart(2, "0")}</p>
            </>
          ) : (
            <>
              <span className="text-sm text-[#b9bbb3]">Qué necesitas en este paso</span>
              <div className={`px-6 py-5 rounded-sm text-2xl font-black ${s.chip}`}>{s.kit}</div>
            </>
          )}
        </aside>
      </div>

      <div className="flex gap-3">
        <button onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={step === 0} className={`${btn} flex-1 bg-[#1d2128] border border-[#3d4552] disabled:opacity-40`}>← Atrás</button>
        <button onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))} disabled={step === STEPS.length - 1} className={`${btn} flex-[2] bg-rose-600 hover:bg-rose-500 disabled:opacity-40`}>Siguiente paso →</button>
      </div>
    </div>
  );
}

export default function BodyMapHUD() {
  const [selectedSystem, setSelectedSystem] = useState<SystemId>("inmune");
  const [isSurgeonMode, setIsSurgeonMode] = useState<boolean>(false);
  const [emergencyActive, setEmergencyActive] = useState<boolean>(false);

  const ids = Object.keys(SYSTEMS_DATA) as SystemId[];
  const current = SYSTEMS_DATA[selectedSystem];
  const sorted = [...ids].sort((a, b) => ORDER.indexOf(SYSTEMS_DATA[a].status) - ORDER.indexOf(SYSTEMS_DATA[b].status));
  const rows = current.surgeonMetrics.split(" | ").map((m) => {
    const i = m.indexOf(": ");
    return [m.slice(0, i), m.slice(i + 2)];
  });

  if (emergencyActive) return <EmergencyProtocol onExit={() => setEmergencyActive(false)} />;

  return (
    <div className="hud">
      <style>{GLOBAL_CSS}</style>
      <div className="stripe" />
      <header className="top">
        <div>
          <h1>La salud de la tripulación en el espacio</h1>
          <p className="dek">Cinco sistemas del cuerpo vigilados sin depender de la Tierra. Elige uno para ver por qué importa, cómo medirlo y qué hacer.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div role="group" aria-label="Modo de vista" style={{ display: "flex" }}>
            <button className="btn" aria-pressed={!isSurgeonMode} onClick={() => setIsSurgeonMode(false)}>Tripulación</button>
            <button className="btn" aria-pressed={isSurgeonMode} onClick={() => setIsSurgeonMode(true)}>Cirujano de vuelo</button>
          </div>
          <button className="sos" onClick={() => setEmergencyActive(true)}>■ Emergencia</button>
        </div>
      </header>

      <div className="layout">
        <main aria-live="polite">
          <p className="kick">Sistema seleccionado</p>
          <h2 className="disp" style={{ fontSize: 46, lineHeight: 1, margin: "0 0 12px", fontWeight: 800 }}>{current.name}</h2>
          <div className="bar" style={{ display: "inline-flex", fontSize: 19 }}>Riesgo NASA: {current.hazard}</div>
          <p style={{ color: STATUS_FILL[current.status], font: "700 22px 'Barlow', sans-serif", margin: "12px 0 14px" }}>
            {STATUS_ICON[current.status]} {STATUS_LABEL[current.status]} · <span className="dim">{current.metric}</span>
          </p>
          {!isSurgeonMode ? (
            <>
              <div className="sec"><h3>Por qué importa</h3><p>{current.crewSummary}</p></div>
              <div className="sec"><h3>Cómo medirlo</h3><p>{current.howToMeasure}</p></div>
              <div className="sec"><h3>Qué hacer ahora</h3><p>{current.crewAction}</p></div>
            </>
          ) : (
            <>
              <div className="sec">
                <h3>Telemetría y biomarcadores RIDGE</h3>
                {rows.map(([k, v]) => (
                  <div className="mt" key={k}><span className="dim">{k}</span><span className="mono">{v}</span></div>
                ))}
              </div>
              <div className="sec"><p className="dim" style={{ fontSize: 16 }}>Aquí Marcelo integrará los gráficos en Recharts y el motor <code>clinicalEngine.ts</code>.</p></div>
            </>
          )}
        </main>

        <svg viewBox="0 0 400 430" style={{ width: "100%", maxHeight: "80vh" }} role="group" aria-label="Mapa corporal">
          <defs>
            <g id="armL">
              <path className="ln" d="M150 102 Q124 108 120 146 L112 200 Q110 216 124 218 L134 216 L148 160 Z" />
              <circle className="in" cx="150" cy="106" r="7" />
              <line className="in" x1="113" y1="182" x2="136" y2="186" />
            </g>
            <g id="legL">
              <path className="ln" d="M164 232 L199 232 L195 332 L191 396 Q192 414 176 414 L158 414 Q158 400 164 392 L168 332 Z" />
              <line className="in" x1="167" y1="332" x2="195" y2="332" />
              <circle className="in" cx="181" cy="332" r="7" />
              <path className="in" d="M181 244 L181 326 M181 340 L179 390" strokeWidth="3" />
            </g>
          </defs>

          {/* Escala vertical */}
          <g stroke="#a8a69c" strokeOpacity=".5">
            <line x1="14" y1="20" x2="14" y2="414" />
            {Array.from({ length: 21 }, (_, i) => (
              <line key={i} x1="14" x2={i % 5 === 0 ? 24 : 19} y1={20 + i * 19.7} y2={20 + i * 19.7} />
            ))}
          </g>

          {/* Piernas, brazos y torso */}
          <use href="#legL" />
          <use href="#legL" transform="translate(400 0) scale(-1 1)" />
          <use href="#armL" />
          <use href="#armL" transform="translate(400 0) scale(-1 1)" />
          <path className="ln" d="M150 100 Q200 88 250 100 L258 150 Q254 190 244 214 L238 234 L162 234 L156 214 Q146 190 142 150 Z" />
          <rect className="ln" x="184" y="84" width="32" height="12" rx="3" />
          <path className="in" d="M162 216 L238 216" strokeDasharray="5 4" />

          {/* Interior: columna, costillas, riñones, corazón */}
          <path className="in" d="M200 96 L200 232" strokeDasharray="2 4" />
          <path className="in" d="M168 118 Q184 128 198 120 M168 136 Q184 146 198 138 M168 154 Q184 164 198 156 M232 118 Q216 128 202 120 M232 136 Q216 146 202 138 M232 154 Q216 164 202 156" />
          <ellipse className="in" cx="182" cy="198" rx="6" ry="10" />
          <ellipse className="in" cx="218" cy="198" rx="6" ry="10" />
          <path d="M214 120 q-7 -9 -12 -2 q-4 9 12 22 q16 -13 12 -22 q-5 -7 -12 2z" fill="#ff5547" fillOpacity=".35" stroke="#ff5547" strokeOpacity=".6" />

          {/* Casco */}
          <circle className="ln" cx="200" cy="52" r="33" />
          <ellipse className="in" cx="200" cy="55" rx="23" ry="18" />
          <circle className="in" cx="190" cy="55" r="3" /><circle className="in" cx="210" cy="55" r="3" />
          <path className="in" d="M186 36 Q200 28 214 36" />

          {/* Escáner */}
          <line className="scan" x1="108" x2="292" y1="22" y2="22" stroke="#ebe6d8" strokeOpacity=".35" />

          {/* Nodos con rótulo */}
          {NODES.map((n) => {
            const s = SYSTEMS_DATA[n.id];
            const selected = selectedSystem === n.id;
            const select = () => setSelectedSystem(n.id);
            const anchor = n.side > 0 ? "start" : "end";
            const tx = n.lx + n.side * 8;
            return (
              <g key={n.id} className="node" role="button" tabIndex={0}
                aria-label={`${s.name}: ${STATUS_LABEL[s.status]}. ${s.metric}`} aria-pressed={selected}
                onClick={select}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } }}>
                <line x1={n.cx + n.side * 14} y1={n.cy} x2={n.lx} y2={n.cy} stroke="#ebe6d8" strokeOpacity={selected ? 0.9 : 0.35} />
                <circle className="hit" cx={n.cx} cy={n.cy} r="22" fill="transparent" stroke={selected ? "#ebe6d8" : "transparent"} strokeWidth="2" />
                {s.status === "red" && <circle className="ring" cx={n.cx} cy={n.cy} r="14" fill="none" stroke="#ff5547" strokeWidth="2" />}
                <circle cx={n.cx} cy={n.cy} r="14" fill={STATUS_FILL[s.status]} stroke="#05070a" strokeWidth="2" />
                <text x={n.cx} y={n.cy + 6} textAnchor="middle" fontSize="17" fontWeight="700" fill="#05070a">{STATUS_ICON[s.status]}</text>
                <circle cx={n.cx - 14} cy={n.cy - 14} r="8" fill="#1a73c8" /><text x={n.cx - 14} y={n.cy - 10.5} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">{ids.indexOf(n.id) + 1}</text>
                <text className="cn" x={tx} y={n.cy - 6} textAnchor={anchor}>{s.short}</text>
                <text className="cs" x={tx} y={n.cy + 10} textAnchor={anchor} fill={STATUS_FILL[s.status]}>{STATUS_LABEL[s.status]}</text>
                <text className="cm" x={tx} y={n.cy + 25} textAnchor={anchor}>{s.metric}</text>
              </g>
            );
          })}
        </svg>

        <nav aria-label="Sistemas, del más grave al menos grave">
          <p className="kick">Sistemas monitoreados</p>
          {sorted.map((id) => {
            const s = SYSTEMS_DATA[id];
            return (
              <button key={id} className="srow" aria-pressed={selectedSystem === id} onClick={() => setSelectedSystem(id)}>
                <div className="bar"><span>{ids.indexOf(id) + 1} · {s.short}</span><span>{STATUS_ICON[s.status]}</span></div>
                <small style={{ color: STATUS_FILL[s.status] }}>{STATUS_LABEL[s.status]} <span className="dim mono" style={{ fontSize: 14 }}>{s.metric}</span></small>
              </button>
            );
          })}
        </nav>
      </div>

      <section style={{ marginTop: 28, borderTop: "1px dotted #555b66", paddingTop: 14 }}>
        <p className="kick">Tendencia de 7 días · {current.short}</p>
        <div className="chart" role="img" aria-label={`Índice de riesgo de los últimos 7 días: ${current.trend.join(", ")}`}>
          {current.trend.map((v, i) => {
            const st = v >= 70 ? "red" : v >= 40 ? "amber" : "green";
            return (
              <div className="col" key={i}>
                <span className="mono" style={{ fontSize: 15 }}>{STATUS_ICON[st]} {v}</span>
                <div className="cb" style={{ height: v * 1.5, background: STATUS_FILL[st] }} />
              </div>
            );
          })}
        </div>
        <div className="days">{DAYS.map((d) => <span key={d}>{d}</span>)}</div>
        <p className="dim" style={{ fontSize: 15, margin: "10px 0 0" }}>Índice de riesgo 0–100: ✓ menos de 40 óptimo · ▲ 40 a 69 precaución · ■ 70 o más crítico</p>
      </section>
      <p className="src">Fuentes: NASA-STD-3001 y los cinco riesgos del Programa de Investigación Humana de la NASA. Datos simulados para el prototipo; no es un dispositivo médico.</p>
    </div>
  );
}
