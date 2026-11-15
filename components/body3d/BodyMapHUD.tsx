"use client";
import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useShallow } from "zustand/react/shallow";
import { useTelemetryStore } from "../../store/useTelemetryStore";
import type { Anomaly, BodyMarker, Layer, Stage } from "./BodyExperience";
import { ALL_CREDITS, SYSTEM_MODELS } from "./modelCatalog";

// WebGL sólo existe en el navegador: los visores 3D no se prerenderizan.
const BodyExperience = dynamic(() => import("./BodyExperience"), {
  ssr: false,
  loading: () => <div className="xp-canvas xp-placeholder">Iniciando escáner…</div>,
});
const OrganViewer = dynamic(() => import("./OrganViewer"), { ssr: false });

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

/** Cómo se ve cada sistema según el escenario del tripulante. */
type Scenario = "critical" | "stable" | "live";
const SCENARIO_SYSTEMS: Record<Scenario, Partial<Record<SystemId, Partial<SystemData>>>> = {
  live: {},
  stable: {
    neuro: {
      status: "amber", metric: "Cefalea 3/10", trend: [30, 32, 35, 34, 36, 35, 33],
      crewSummary: "Cefalea leve y mareo al girar la cabeza: adaptación normal al espacio.",
      crewAction: "Hidrátate, mueve la cabeza despacio y descansa la vista unos minutos.",
      surgeonMetrics: "Cefalea: 3/10 | Mareo: 2/10 (adaptación espacial) | ONSD: 5.4 mm (normal)",
    },
    cardio: { status: "green", metric: "FC 70 lpm", crewSummary: "Ritmo cardíaco y oxigenación estables.", surgeonMetrics: "FC: 70 lpm | SpO2: 98% | CO2 Cabina: 720 ppm" },
    inmune: {
      status: "green", metric: "NLR 2.0", trend: [20, 21, 20, 22, 21, 20, 21],
      crewSummary: "Defensas normales. Sin exposición relevante a radiación.",
      crewAction: "Mantén la higiene habitual del módulo.",
      surgeonMetrics: "Radiación: 0.4 µSv/h | Linfocitos: 1480/µL | Índice NLR: 2.0",
    },
    oseo: { status: "green" },
    conducta: { status: "green", metric: "Sueño 7.4 h", crewSummary: "Buen descanso y ánimo estable." },
  },
  critical: {
    inmune: {
      status: "red", metric: "NLR 8.6", trend: [30, 41, 58, 72, 84, 91, 96],
      crewSummary: "Defensas muy bajas tras el evento de partículas solares.",
      crewAction: "Refugio blindado y aviso inmediato al cirujano de vuelo.",
      surgeonMetrics: "Radiación: 140 µSv/h | Linfocitos: 650/µL | Índice NLR: 8.6 (Crítico > 3)",
    },
    cardio: {
      status: "red", metric: "FC 142 · SpO2 86 %", trend: [20, 24, 35, 52, 70, 88, 97],
      crewSummary: "Taquicardia e hipoxemia: el corazón compensa la falta de oxígeno y el exceso de CO2.",
      crewAction: "Oxígeno al 100 % y depurador de CO2 de respaldo.",
      surgeonMetrics: "FC: 142 lpm | SpO2: 86% | CO2 Cabina: 6100 ppm",
    },
    oseo: {
      status: "amber", metric: "Ca2+ 1.33 mmol/L", trend: [22, 25, 31, 40, 52, 60, 66],
      crewSummary: "Cistatina C y calcio elevados: el riñón empieza a sufrir.",
      surgeonMetrics: "Creatinina: 1.08 mg/dL | Cistatina C: 1.41 mg/L | Ca2+: 1.33 mmol/L",
    },
    conducta: { status: "amber", metric: "Cortisol 38", crewSummary: "Estrés agudo y desorientación: deja de responder a las comprobaciones." },
  },
};

/** Lecturas que se usan para calcular el estado de cada sistema en vivo. */
interface LiveReadings {
  heartRate: number; spO2: number; co2Level: number; radiationRate: number;
  linfocitos: number; neutrofilos: number; cistatinaC: number; calcioIonico: number;
  creatinina: number; cortisol: number; isRenalWarning: boolean;
}

const GENERIC: Record<StatusColor, string> = {
  green: "Dentro de los valores normales para la misión.",
  amber: "Valores fuera de rango: vigilar en las próximas lecturas.",
  red: "Valores críticos: requiere atención inmediata.",
};

/**
 * Estado de cada sistema calculado con la telemetría en vivo, para que los
 * cambios (y una crisis) se vean en el cuerpo en cuanto ocurren.
 */
function liveSystems(base: Record<SystemId, SystemData>, v: LiveReadings): Record<SystemId, SystemData> {
  const out = { ...base };
  const keepText = (id: SystemId, status: StatusColor) =>
    base[id].status === status || (status !== "green" && base[id].status !== "green")
      ? {}
      : { crewSummary: GENERIC[status] };

  const nlr = v.linfocitos > 0 ? v.neutrofilos / v.linfocitos : 0;
  const inmune: StatusColor =
    (v.radiationRate > 50 && v.linfocitos < 1000 && nlr > 3) || v.linfocitos < 800 ? "red"
      : v.linfocitos < 1200 || nlr > 3 || v.radiationRate > 50 ? "amber" : "green";
  out.inmune = {
    ...base.inmune, status: inmune, metric: `NLR ${nlr.toFixed(1)}`, ...keepText("inmune", inmune),
    surgeonMetrics: `Radiación: ${v.radiationRate} µSv/h | Linfocitos: ${v.linfocitos}/µL | Índice NLR: ${nlr.toFixed(1)} (Crítico > 3)`,
  };

  const cardio: StatusColor =
    v.spO2 < 90 || v.heartRate > 130 ? "red"
      : v.spO2 < 95 || v.heartRate > 100 || v.co2Level > 3500 ? "amber" : "green";
  out.cardio = {
    ...base.cardio, status: cardio, metric: `FC ${v.heartRate} · SpO2 ${v.spO2} %`, ...keepText("cardio", cardio),
    surgeonMetrics: `FC: ${v.heartRate} lpm | SpO2: ${v.spO2}% | CO2 Cabina: ${v.co2Level} ppm`,
  };

  const oseo: StatusColor =
    v.isRenalWarning && v.cistatinaC > 1.35 ? "red"
      : v.isRenalWarning || v.cistatinaC > 1.15 || v.calcioIonico > 1.25 ? "amber" : "green";
  out.oseo = {
    ...base.oseo, status: oseo, metric: `Ca2+ ${v.calcioIonico} mmol/L`, ...keepText("oseo", oseo),
    surgeonMetrics: `Creatinina: ${v.creatinina} mg/dL | Cistatina C: ${v.cistatinaC} mg/L | Ca2+: ${v.calcioIonico} mmol/L`,
  };

  if (v.cortisol > 25 && out.conducta.status === "green") {
    out.conducta = { ...out.conducta, status: "amber", metric: `Cortisol ${v.cortisol}`, crewSummary: "Estrés elevado: puede afectar al sueño y la concentración." };
  }
  return out;
}

function systemsFor(scenario: Scenario): Record<SystemId, SystemData> {
  const out = { ...SYSTEMS_DATA };
  for (const [id, patch] of Object.entries(SCENARIO_SYSTEMS[scenario]) as [SystemId, Partial<SystemData>][]) {
    out[id] = { ...out[id], ...patch };
  }
  return out;
}

const STATUS_LABEL: Record<StatusColor, string> = { green: "Óptimo", amber: "Precaución", red: "Crítico" };
// Color + forma + texto: nunca solo color
const STATUS_ICON: Record<StatusColor, string> = { green: "✓", amber: "▲", red: "■" };
const STATUS_FILL: Record<StatusColor, string> = { green: "#5fd39a", amber: "#ffa23a", red: "#ff5547" };
const ORDER = ["red", "amber", "green"];
const DAYS = ["D-6", "D-5", "D-4", "D-3", "D-2", "Ayer", "Hoy"];

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&display=swap');
:root{--bg:#05070a;--line:#555b66;--ink:#f5f5f2;--dim:#b4b8bf;--y:#ffe600;--b:#1a73c8;--c:#00a8e8;--red:#ff5547}
.hud,.fam{font-family:var(--font-roboto-condensed),system-ui,sans-serif}
.hud h1,.hud h2,.fam h1,.fam h2,.disp{font-family:var(--font-roboto-condensed),sans-serif}
.hud{min-height:100vh;background:var(--bg);color:var(--ink);font-size:18px;padding:20px 28px 32px}
.hud :focus-visible,.fam :focus-visible{outline:2px solid var(--y);outline-offset:2px}
.stripe{height:9px;background:var(--b);margin:-20px -28px 20px}
.top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:20px}
.top h1{margin:0;font-size:clamp(34px,5vw,54px);font-weight:800;line-height:1}
.dek{font-family:var(--font-roboto-semi),sans-serif;font-weight:100;font-size:21px;margin:12px 0 0;padding-top:10px;border-top:1px dotted var(--line);max-width:58ch;color:#dcdcd6}
.dim{color:var(--dim)}
.kick{margin:0 0 8px;color:var(--y);font:800 19px var(--font-roboto-condensed),sans-serif;text-transform:uppercase}
.btn{min-height:48px;padding:0 18px;border:1px solid var(--line);background:none;color:var(--ink);font:600 17px var(--font-roboto-condensed),sans-serif;cursor:pointer}
.btn[aria-pressed=true]{background:var(--c);border-color:var(--c);color:#000}
.sos{min-height:52px;padding:0 26px;border:0;background:var(--red);color:#1a0705;font:800 22px var(--font-roboto-condensed),sans-serif;cursor:pointer}
.layout{display:grid;grid-template-columns:minmax(280px,1fr) minmax(300px,470px) 300px;gap:32px;margin-top:26px;align-items:start}
@media(max-width:1100px){.layout{grid-template-columns:1fr}}
.bar{display:flex;justify-content:space-between;gap:8px;background:var(--c);color:#000;font:800 21px var(--font-roboto-condensed),sans-serif;padding:2px 10px}
.srow{display:block;width:100%;padding:10px 0;background:none;border:0;border-bottom:1px dotted var(--line);color:inherit;font:inherit;text-align:left;cursor:pointer}
.srow[aria-pressed=true] .bar{background:var(--y)}
.srow small{display:block;margin-top:4px;font-size:16px;font-weight:600}
.sec{padding:12px 0;border-bottom:1px dotted var(--line)}
.sec h3{margin:0 0 4px;font:800 24px var(--font-roboto-condensed),sans-serif}
.sec p{margin:0;font-size:20px;line-height:1.45;max-width:56ch}
.sec p::before{content:"●";color:var(--y);margin-right:8px;font-size:.7em}
.mt{display:grid;grid-template-columns:1fr auto;gap:16px;padding:10px 0;border-bottom:1px dotted var(--line)}
.mono{font-family:'IBM Plex Mono',monospace;font-size:20px}
.ln{fill:rgba(245,245,242,.07);stroke:var(--ink);stroke-opacity:.85;stroke-width:1.3;stroke-linejoin:round}
.in{fill:none;stroke:var(--ink);stroke-opacity:.45;stroke-width:1.1}
.cn{font:800 17px var(--font-roboto-condensed),sans-serif;fill:var(--ink)}
.cs{font:700 12.5px var(--font-roboto-condensed),sans-serif}
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
  .body3d-marker.is-critical .body3d-dot::after{animation:ring 1.6s ease-out infinite}
  .xp-panel{animation:xpIn .5s ease-out both}
  .xp-finding{animation:xpIn .45s ease-out both}
  .xp-cta{animation:xpGlow 1.8s ease-in-out infinite}
  .xp-sys.is-red .xp-sys-icon{animation:xpPulse 1.1s ease-in-out infinite}
  .is-explore .body3d-marker{animation:xpFade .6s ease-out 1.1s both}
}
@keyframes xpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes xpFade{from{opacity:0}to{opacity:1}}
@keyframes xpGlow{0%,100%{box-shadow:0 0 0 0 rgba(255,230,0,.0)}50%{box-shadow:0 0 22px 2px rgba(255,230,0,.45)}}
@keyframes xpPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,85,71,.7)}50%{box-shadow:0 0 0 6px rgba(255,85,71,0)}}
.body3d-overlay{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none}
.body3d-loading{margin:0;color:var(--dim);font:500 14px 'IBM Plex Mono',monospace;white-space:nowrap}
.body3d-marker[hidden]{display:none}
.body3d-marker{position:absolute;left:0;top:0;width:0;height:0;padding:0;border:0;background:none;color:var(--ink);cursor:pointer;font:inherit}
.body3d-dot{position:absolute;left:-13px;top:-13px;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--status);color:#05070a;font:700 14px var(--font-roboto-condensed),sans-serif;border:2px solid #05070a;box-shadow:0 0 0 1px var(--status)}
.body3d-dot::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:2px solid var(--status);opacity:0}
.body3d-num{position:absolute;left:-9px;top:-9px;width:16px;height:16px;border-radius:50%;background:var(--b);color:#fff;font:800 10px var(--font-roboto-condensed),sans-serif;display:flex;align-items:center;justify-content:center}
.body3d-lead{position:absolute;left:13px;top:var(--dy);width:56px;height:1px;background:var(--ink);opacity:.45;transform-origin:left center}
.body3d-label{position:absolute;left:69px;top:calc(var(--dy) - 18px);display:flex;flex-direction:column;align-items:flex-start;padding:2px 8px;background:rgba(5,7,10,.82);border-left:2px solid var(--status);line-height:1.1;white-space:nowrap}
.body3d-label strong{font:800 16px var(--font-roboto-condensed),sans-serif}
.body3d-label em{font:700 12px var(--font-roboto-condensed),sans-serif;font-style:normal;color:var(--status)}
.body3d-marker.is-left .body3d-lead{left:auto;right:13px}
.body3d-marker.is-left .body3d-label{left:auto;right:69px;align-items:flex-end;border-left:0;border-right:2px solid var(--status)}
.body3d-marker:not(.is-selected) .body3d-label{opacity:.78}
.body3d-marker.is-selected .body3d-dot{outline:2px solid var(--y);outline-offset:3px}
.body3d-marker.is-selected .body3d-lead{opacity:.95;background:var(--y)}
.body3d-marker.is-selected .body3d-label{opacity:1;border-color:var(--y)}
.body3d-marker:focus-visible .body3d-dot{outline:2px solid var(--y);outline-offset:4px}
.organ3d{margin-top:18px;padding-top:12px;border-top:1px dotted var(--line)}
.organ3d-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.organ3d-tabs{display:flex}
.organ3d-tabs .btn{min-height:38px;font-size:15px;padding:0 12px}
.organ3d-why{margin:8px 0 10px;color:#dcdcd6;font-size:17px;line-height:1.4;max-width:56ch}
.organ3d-canvas{position:relative;height:280px;background:radial-gradient(ellipse at 50% 50%,#0f1a24 0%,var(--bg) 72%);border:1px dotted var(--line)}
.organ3d-credit{margin:6px 0 0;font-size:13px}
.organ3d-credit a{color:var(--c)}
.organ3d-empty{margin:0;font-size:16px}
.xp-card .organ3d{margin-top:0;padding-top:0;border-top:0}
.xp-stage{position:relative;margin-top:22px;height:clamp(580px,84vh,900px);border:1px solid #1c2733;background:radial-gradient(ellipse at 50% 42%,#0e1f2d 0%,#070b10 55%,var(--bg) 80%);overflow:hidden}
.xp-stage::before,.xp-stage::after{content:"";position:absolute;width:42px;height:42px;border:2px solid var(--c);pointer-events:none;z-index:3;opacity:.7}
.xp-stage::before{top:8px;left:8px;border-right:0;border-bottom:0}
.xp-stage::after{bottom:8px;right:8px;border-left:0;border-top:0}
.xp-canvas{position:absolute;inset:0}
.xp-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:4;margin:0;max-width:calc(100% - 32px);padding:6px 14px;background:rgba(5,7,10,.72);border:1px solid rgba(0,168,232,.35);color:var(--dim);font:300 13px var(--font-roboto-condensed),sans-serif;letter-spacing:.02em;text-align:center;pointer-events:none}
.xp-hint b{color:var(--c);font-weight:900}
.xp-canvas canvas{touch-action:pan-y!important}
.xp-placeholder{display:flex;align-items:center;justify-content:center;color:var(--dim);font:500 15px 'IBM Plex Mono',monospace}
.xp-grid{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(0,168,232,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,168,232,.07) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse at center,#000 25%,transparent 72%);mask-image:radial-gradient(ellipse at center,#000 25%,transparent 72%)}
.xp-phase{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:4;display:flex;gap:10px;align-items:center;padding:6px 14px;background:rgba(5,7,10,.75);border:1px solid rgba(0,168,232,.45);color:var(--c);font:700 15px var(--font-roboto-condensed),sans-serif;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
.xp-phase-n{color:var(--y);font-family:'IBM Plex Mono',monospace;letter-spacing:0}
.xp-skip{position:absolute;top:12px;right:16px;z-index:4;min-height:40px;padding:0 14px;background:rgba(5,7,10,.75);border:1px solid var(--line);color:var(--ink);font:600 15px var(--font-roboto-condensed),sans-serif;cursor:pointer}
.xp-skip:hover{border-color:var(--ink)}
.xp-panel{position:absolute;top:64px;bottom:18px;z-index:4;width:min(350px,30%);overflow-y:auto;padding:16px 18px;background:linear-gradient(180deg,rgba(8,12,18,.9),rgba(8,12,18,.72));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(85,91,102,.55)}
.xp-left{left:16px}
.xp-right{right:16px;width:min(290px,25%)}
.xp-progress{height:6px;background:#1c232c;overflow:hidden}
.xp-progress>div{height:100%;background:linear-gradient(90deg,var(--c),#8de8ff);transition:width .2s linear}
.xp-pct{margin:6px 0 0;font-size:14px}
.xp-wait{font-size:15px;margin:14px 0 0}
.xp-findings{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
.xp-finding{display:flex;gap:10px;padding:10px 10px 10px 8px;border-left:3px solid var(--red);background:rgba(255,59,47,.08)}
.xp-finding.is-amber{border-left-color:#ffa23a;background:rgba(255,162,58,.07)}
.xp-finding-icon{flex-shrink:0;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--red);color:#05070a;font-weight:800;font-size:13px}
.xp-finding.is-amber .xp-finding-icon{background:#ffa23a}
.xp-finding strong{display:block;font:800 19px var(--font-roboto-condensed),sans-serif}
.xp-finding span{display:block;font:700 14px var(--font-roboto-condensed),sans-serif}
.xp-finding .mono{display:inline;font-size:13px}
.xp-finding small{display:block;margin-top:4px;color:var(--dim);font-size:14px;line-height:1.35}
.xp-summary{margin-top:16px;padding-top:12px;border-top:1px dotted var(--line)}
.xp-summary p{margin:0 0 10px;font-size:26px;font-weight:800;line-height:1.05}
.xp-cta{width:100%;min-height:54px;border:0;background:var(--y);color:#000;font:800 22px var(--font-roboto-condensed),sans-serif;cursor:pointer}
.xp-title{margin:0 0 10px;font-size:34px;line-height:1;font-weight:800}
.xp-status{margin:10px 0 4px;font:700 19px var(--font-roboto-condensed),sans-serif}
.xp-panel .sec h3{font-size:20px}
.xp-panel .sec p{font-size:17px}
.xp-panel .mono{font-size:16px}
.xp-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px}
.xp-nav .btn{min-height:42px;min-width:52px}
.xp-sys{display:flex;align-items:center;gap:10px;width:100%;margin-bottom:6px;padding:8px;background:rgba(255,255,255,.02);border:1px solid transparent;color:inherit;text-align:left;cursor:pointer;transition:border-color .15s,background .15s}
.xp-sys:hover{border-color:var(--line)}
.xp-sys[aria-pressed=true]{border-color:var(--y);background:rgba(255,230,0,.06)}
.xp-sys-icon{flex-shrink:0;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#05070a;font-weight:800;font-size:14px}
.xp-sys-text strong{display:block;font:800 17px var(--font-roboto-condensed),sans-serif}
.xp-sys-text small{font-size:13px;font-weight:600}
.xp-sys-text .mono{font-size:12px}
.xp-seg{display:flex}
.xp-seg .btn{flex:1;min-height:40px;font-size:15px;padding:0 8px}
.xp-actions{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.xp-actions .btn{min-height:40px;font-size:15px;text-align:left}
.xp-hint{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);z-index:4;margin:0;font-size:13px;white-space:nowrap}
.xp-detail{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px}
.xp-card{padding:16px;border:1px solid #1c2733;background:rgba(255,255,255,.015)}
@media(max-width:900px){
  .xp-hint{bottom:auto;top:calc(72vh - 46px);font-size:12px}
  .hud{padding:20px 16px 32px}.stripe{margin:-20px -16px 20px}
  .xp-stage{height:auto;overflow:visible;border:0;background:none}
  .xp-stage::before,.xp-stage::after{display:none}
  .xp-canvas{position:relative;height:72vh;border:1px solid #1c2733;background:radial-gradient(ellipse at 50% 42%,#0e1f2d 0%,var(--bg) 75%)}
  .xp-grid{height:72vh;bottom:auto}
  .xp-panel{position:relative;top:auto;bottom:auto;left:auto;right:auto;width:auto;margin-top:12px}
  .xp-hint{display:none}
  .xp-phase{left:12px;top:12px;transform:none;font-size:13px;padding:5px 10px}
  .xp-skip{top:52px;right:12px;min-height:36px;font-size:14px}
  .xp-detail{grid-template-columns:1fr}
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

const SEVERITY: Record<StatusColor, 0 | 1 | 2> = { green: 0, amber: 1, red: 2 };

/**
 * Escáner corporal 3D y explorador de anatomía (equipo UX/UI). Ocupa la
 * primera pantalla de la página única de ExoVitals.
 */
export function BodyMapHUD({ scanRun = 0, scenario = "live" }: { scanRun?: number; scenario?: Scenario } = {}) {
  const live = useTelemetryStore(
    useShallow((t) => ({
      heartRate: t.heartRate, spO2: t.spO2, co2Level: t.co2Level, radiationRate: t.radiationRate,
      linfocitos: t.linfocitos, neutrofilos: t.neutrofilos, cistatinaC: t.cistatinaC,
      calcioIonico: t.calcioIonico, creatinina: t.creatinina, cortisol: t.cortisol, isRenalWarning: t.isRenalWarning,
    }))
  );
  const SYS = liveSystems(systemsFor(scenario), live);
  const [selectedSystem, setSelectedSystem] = useState<SystemId>("inmune");
  const [isSurgeonMode, setIsSurgeonMode] = useState<boolean>(false);
  const [emergencyActive, setEmergencyActive] = useState<boolean>(false);

  // Experiencia 3D: fase 1 escaneo holográfico → fase 2 anatomía
  const [stage, setStage] = useState<Stage>("intro");
  const [layer, setLayer] = useState<Layer>("anatomy");
  const [progress, setProgress] = useState(0);
  const [detected, setDetected] = useState<SystemId[]>([]);
  const [scanDone, setScanDone] = useState(false);
  const [introKey, setIntroKey] = useState(0);
  const [homeKey, setHomeKey] = useState(0);

  // Cada vez que se cierra la intro, el escaneo vuelve a empezar (sin
  // desmontar la escena 3D). Patrón de React para ajustar estado a una prop.
  const [seenRun, setSeenRun] = useState(scanRun);
  if (seenRun !== scanRun) {
    setSeenRun(scanRun);
    setDetected([]);
    setScanDone(false);
    setProgress(0);
    setIntroKey((k) => k + 1);
    setStage("intro");
  }

  const ids = Object.keys(SYS) as SystemId[];
  const current = SYS[selectedSystem];
  const sorted = [...ids].sort((a, b) => ORDER.indexOf(SYS[a].status) - ORDER.indexOf(SYS[b].status));
  const rows = current.surgeonMetrics.split(" | ").map((m) => {
    const i = m.indexOf(": ");
    return [m.slice(0, i), m.slice(i + 2)];
  });

  // Sistemas con problemas: se marcan en rojo sobre el holograma.
  const anomalies: Anomaly[] = ids
    .filter((id) => SEVERITY[SYS[id].status] > 0)
    .map((id) => ({ id, severity: SEVERITY[SYS[id].status] as 1 | 2 }));

  const markers: BodyMarker[] = ids.map((id) => {
    const sys = SYS[id];
    return {
      id,
      number: ids.indexOf(id) + 1,
      title: sys.short,
      statusLabel: STATUS_LABEL[sys.status],
      icon: STATUS_ICON[sys.status],
      color: STATUS_FILL[sys.status],
      metric: sys.metric,
      critical: sys.status === "red",
    };
  });

  const onDetect = useCallback((id: SystemId) => setDetected((d) => (d.includes(id) ? d : [...d, id])), []);
  const onIntroDone = useCallback(() => setScanDone(true), []);

  const explore = (focus?: SystemId) => {
    setStage("explore");
    setLayer("anatomy");
    setDetected(anomalies.map((a) => a.id));
    setScanDone(true);
    if (focus) setSelectedSystem(focus);
  };
  const replayScan = () => {
    setDetected([]);
    setScanDone(false);
    setProgress(0);
    setIntroKey((k) => k + 1);
    setStage("intro");
  };
  const step = (dir: 1 | -1) => {
    const i = sorted.indexOf(selectedSystem);
    setSelectedSystem(sorted[(i + dir + sorted.length) % sorted.length]);
  };

  // Teclado: ← → recorren sistemas, 1–5 eligen, Enter/Espacio salta el escaneo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (emergencyActive) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (stage === "explore") {
        if (e.key === "ArrowRight") setSelectedSystem((s) => sorted[(sorted.indexOf(s) + 1) % sorted.length]);
        if (e.key === "ArrowLeft") setSelectedSystem((s) => sorted[(sorted.indexOf(s) - 1 + sorted.length) % sorted.length]);
        const n = Number(e.key);
        if (n >= 1 && n <= ids.length) setSelectedSystem(ids[n - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, emergencyActive, sorted, ids]);

  if (emergencyActive) return <EmergencyProtocol onExit={() => setEmergencyActive(false)} />;

  const critical = anomalies.filter((a) => a.severity === 2).length;

  return (
    <div className="hud">
      <style>{GLOBAL_CSS}</style>
      <div className="stripe" />
      <header className="top">
        <div>
          <h1>La salud de la tripulación en el espacio</h1>
          <p className="dek">Escaneamos el cuerpo sin depender de la Tierra, marcamos lo que duele o falla y te llevamos a la anatomía para entender por qué y qué hacer.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div role="group" aria-label="Modo de vista" style={{ display: "flex" }}>
            <button className="btn" aria-pressed={!isSurgeonMode} onClick={() => setIsSurgeonMode(false)}>Tripulación</button>
            <button className="btn" aria-pressed={isSurgeonMode} onClick={() => setIsSurgeonMode(true)}>Cirujano de vuelo</button>
          </div>
          <button className="sos" onClick={() => setEmergencyActive(true)}>■ Emergencia</button>
        </div>
      </header>

      {/* ---------------- Escenario 3D ---------------- */}
      <section className={`xp-stage is-${stage}`} aria-label="Escáner corporal 3D">
        <BodyExperience
          stage={stage}
          layer={layer}
          anomalies={anomalies}
          markers={markers}
          selected={selectedSystem}
          onSelect={(id) => setSelectedSystem(id as SystemId)}
          homeKey={homeKey}
          introKey={introKey}
          onDetect={(id) => onDetect(id as SystemId)}
          onProgress={setProgress}
          onIntroDone={onIntroDone}
          onBodyClick={() => explore(anomalies.find((a) => a.severity === 2)?.id ?? anomalies[0]?.id)}
        />
        <div className="xp-grid" aria-hidden />
        <p className="xp-hint" aria-hidden>
          {stage === "intro" ? (
            <>
              <b>Clic en el cuerpo</b> para explorar la anatomía · Arrastra para girar · Rueda o pellizco: zoom · Clic derecho o dos dedos: mover
            </>
          ) : (
            <>Arrastra para girar · Rueda o pellizco: zoom · Clic derecho o dos dedos: mover</>
          )}
        </p>

        <div className="xp-phase">
          <span className="xp-phase-n">{stage === "intro" ? "01" : "02"}</span>
          <span>{stage === "intro" ? "Escaneo biométrico" : layer === "anatomy" ? "Anatomía · músculos" : "Anatomía · holograma"}</span>
        </div>

        {stage === "intro" ? (
          <>
            <button className="xp-skip" onClick={() => explore()}>Saltar escaneo →</button>

            <aside className="xp-panel xp-left" aria-live="polite">
              <p className="kick">Escaneo 360°</p>
              <div className="xp-progress" role="progressbar" aria-label="Progreso del escaneo" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${progress}%` }} />
              </div>
              <p className="mono dim xp-pct">{scanDone ? "Escaneo completo" : `Analizando… ${progress}%`}</p>

              <ol className="xp-findings">
                {detected.map((id) => {
                  const sys = SYS[id];
                  return (
                    <li key={id} className={`xp-finding is-${sys.status}`}>
                      <span className="xp-finding-icon" aria-hidden>{STATUS_ICON[sys.status]}</span>
                      <div>
                        <strong>{sys.short}</strong>
                        <span style={{ color: STATUS_FILL[sys.status] }}>{STATUS_LABEL[sys.status]} · <span className="mono">{sys.metric}</span></span>
                        <small>{sys.crewSummary}</small>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {detected.length === 0 && !scanDone && <p className="dim xp-wait">Buscando dolores, molestias y fallos…</p>}

              {scanDone && (
                <div className="xp-summary">
                  <p className="disp">
                    {anomalies.length} {anomalies.length === 1 ? "zona afectada" : "zonas afectadas"}
                    {critical > 0 && <span style={{ color: STATUS_FILL.red }}> · {critical} crítica{critical > 1 ? "s" : ""}</span>}
                  </p>
                  <button className="xp-cta" onClick={() => explore(anomalies.find((a) => a.severity === 2)?.id ?? anomalies[0]?.id)}>
                    Explorar anatomía →
                  </button>
                </div>
              )}
            </aside>
          </>
        ) : (
          <>
            <aside className="xp-panel xp-left" aria-live="polite">
              <p className="kick">Sistema seleccionado</p>
              <h2 className="disp xp-title">{current.name}</h2>
              <div className="bar" style={{ display: "inline-flex", fontSize: 17 }}>Riesgo NASA: {current.hazard}</div>
              <p className="xp-status" style={{ color: STATUS_FILL[current.status] }}>
                {STATUS_ICON[current.status]} {STATUS_LABEL[current.status]} · <span className="dim mono">{current.metric}</span>
              </p>
              {!isSurgeonMode ? (
                <>
                  <div className="sec"><h3>Por qué importa</h3><p>{current.crewSummary}</p></div>
                  <div className="sec"><h3>Cómo medirlo</h3><p>{current.howToMeasure}</p></div>
                  <div className="sec"><h3>Qué hacer ahora</h3><p>{current.crewAction}</p></div>
                </>
              ) : (
                <div className="sec">
                  <h3>Telemetría y biomarcadores RIDGE</h3>
                  {rows.map(([k, v]) => (
                    <div className="mt" key={k}><span className="dim">{k}</span><span className="mono">{v}</span></div>
                  ))}
                </div>
              )}
              <div className="xp-nav">
                <button className="btn" onClick={() => step(-1)} aria-label="Sistema anterior">←</button>
                <span className="dim">{sorted.indexOf(selectedSystem) + 1} / {sorted.length}</span>
                <button className="btn" onClick={() => step(1)} aria-label="Sistema siguiente">→</button>
              </div>
            </aside>

            <aside className="xp-panel xp-right">
              <p className="kick">Sistemas · del más grave al menos</p>
              {sorted.map((id) => {
                const sys = SYS[id];
                return (
                  <button key={id} className={`xp-sys is-${sys.status}`} aria-pressed={selectedSystem === id} onClick={() => setSelectedSystem(id)}>
                    <span className="xp-sys-icon" style={{ background: STATUS_FILL[sys.status] }} aria-hidden>{STATUS_ICON[sys.status]}</span>
                    <span className="xp-sys-text">
                      <strong>{ids.indexOf(id) + 1} · {sys.short}</strong>
                      <small style={{ color: STATUS_FILL[sys.status] }}>{STATUS_LABEL[sys.status]} <span className="dim mono">{sys.metric}</span></small>
                    </span>
                  </button>
                );
              })}

              <p className="kick" style={{ marginTop: 18 }}>Capa</p>
              <div role="group" aria-label="Capa del cuerpo" className="xp-seg">
                <button className="btn" aria-pressed={layer === "anatomy"} onClick={() => setLayer("anatomy")}>Músculos</button>
                <button className="btn" aria-pressed={layer === "hologram"} onClick={() => setLayer("hologram")}>Holograma</button>
              </div>
              <div className="xp-actions">
                <button className="btn" onClick={() => setHomeKey((k) => k + 1)}>⤢ Vista completa</button>
                <button className="btn" onClick={replayScan}>↻ Repetir escaneo</button>
              </div>
            </aside>

            <p className="xp-hint dim">Arrastra para girar · rueda para acercar · ← → para cambiar de sistema</p>
          </>
        )}
      </section>

      {/* ---------------- Detalle ---------------- */}
      {stage === "explore" && (
        <section className="xp-detail">
          <div className="xp-card">
            <OrganViewer key={selectedSystem} system={selectedSystem} />
          </div>
          <div className="xp-card">
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
            {SYSTEM_MODELS[selectedSystem].models.length === 0 && (
              <p className="dim" style={{ fontSize: 15 }}>Este sistema no tiene un órgano único: se sigue con cuestionarios y el registro del reloj.</p>
            )}
          </div>
        </section>
      )}

      <p className="src">Fuentes: NASA-STD-3001 y los cinco riesgos del Programa de Investigación Humana de la NASA. Datos simulados para el prototipo; no es un dispositivo médico.</p>
      <p className="src">
        Modelos 3D (Sketchfab):{" "}
        {ALL_CREDITS.map((c, i) => (
          <span key={c.source}>
            {i > 0 && " · "}
            <a href={c.source} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{c.title}</a> — {c.author} ({c.license})
          </span>
        ))}
      </p>
    </div>
  );
}

export default BodyMapHUD;
