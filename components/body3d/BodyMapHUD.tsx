"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Anomaly, BodyMarker, Layer, Stage } from "./BodyExperience";
import { ALL_CREDITS, SYSTEM_MODELS } from "./modelCatalog";
import { useTelemetryStore } from "../../store/useTelemetryStore";
import {
  useClinicalSnapshot,
  type PhysiologicalSystemId,
  type SystemHealthStatus,
} from "../../store/selectors";
import { useSystemTrendSeries } from "../../store/useTelemetryTrend";
import { useT } from "../../i18n/I18nContext";
import type { MissionSlug } from "../../utils/missionChoice";

// WebGL sólo existe en el navegador: los visores 3D no se prerenderizan.
const BodyExperience = dynamic(() => import("./BodyExperience"), {
  ssr: false,
  loading: () => <div className="xp-canvas xp-placeholder">Iniciando escáner…</div>,
});
const OrganViewer = dynamic(() => import("./OrganViewer"), { ssr: false });

type SystemId = PhysiologicalSystemId;
type StatusColor = SystemHealthStatus;

interface SystemViewModel {
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

const SYSTEM_META: Record<
  SystemId,
  { hazard: { es: string; en: string }; howToMeasure: { es: string; en: string } }
> = {
  neuro: {
    hazard: { es: "Gravedad alterada y ambiente cerrado", en: "Altered gravity & closed habitat" },
    howToMeasure: {
      es: "Lectura continua de CO₂ de cabina y SpO₂; reportar cefalea, visión borrosa o mareo.",
      en: "Continuous cabin CO₂ & SpO₂ monitoring; log headache, blurred vision, or dizziness.",
    },
  },
  cardio: {
    hazard: { es: "Gravedad alterada y entorno cerrado", en: "Altered gravity & closed habitat" },
    howToMeasure: {
      es: "Sensor biométrico continuo de FC y pulsioxímetro arterial (SpO₂).",
      en: "Continuous heart-rate strap/shirt and arterial pulse oximeter (SpO₂).",
    },
  },
  inmune: {
    hazard: { es: "Radiación espacial (GCR / SPE)", en: "Space radiation (GCR / SPE)" },
    howToMeasure: {
      es: "Dosímetro de cabina + cartucho hematológico de 1 gota (linfocitos y neutrófilos).",
      en: "Cabin dosimeter + single-drop hematology cartridge (lymphocytes & neutrophils).",
    },
  },
  oseo: {
    hazard: { es: "Gravedad alterada (0G / hipogravedad)", en: "Altered gravity (0G / hypogravity)" },
    howToMeasure: {
      es: "Panel bioquímico renal/mineral (Cistatina C, Creatinina y Calcio iónico sérico).",
      en: "Renal & mineral biochemical panel (Cystatin C, Creatinine, ionized Calcium).",
    },
  },
  conducta: {
    hazard: { es: "Aislamiento, confinamiento y ciclos luz-oscuridad", en: "Isolation, confinement & circadian shift" },
    howToMeasure: {
      es: "Cortisol salival/sérico + registro diario de sueño y check-in conductual.",
      en: "Salivary/serum cortisol + daily sleep log and behavioral check-in.",
    },
  },
};

// Color + forma + texto: nunca solo color
const STATUS_ICON: Record<StatusColor, string> = { green: "✓", amber: "▲", red: "■" };
const STATUS_FILL: Record<StatusColor, string> = { green: "#5fd39a", amber: "#ffa23a", red: "#ff5547" };
const ORDER: StatusColor[] = ["red", "amber", "green"];

const GLOBAL_CSS = `
:root{--bg:#05070a;--line:#555b66;--ink:#f5f5f2;--dim:#b4b8bf;--y:#ffe600;--b:#1a73c8;--c:#00a8e8;--red:#ff5547}
.hud,.fam{font-family:'Barlow',var(--font-geist-sans),system-ui,-apple-system,sans-serif}
.hud h1,.hud h2,.fam h1,.fam h2,.disp{font-family:'Barlow Condensed',var(--font-montserrat),system-ui,sans-serif}
.hud{min-height:100vh;background:var(--bg);color:var(--ink);font-size:18px;padding:20px 28px 32px}
.hud :focus-visible,.fam :focus-visible{outline:2px solid var(--y);outline-offset:2px}
.stripe{height:9px;background:var(--b);margin:-20px -28px 20px}
.top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:20px}
.top h1{margin:0;font-size:clamp(34px,5vw,54px);font-weight:800;line-height:1}
.dek{margin:12px 0 0;padding-top:10px;border-top:1px dotted var(--line);max-width:58ch;color:#dcdcd6}
.dim{color:var(--dim)}
.kick{margin:0 0 8px;color:var(--y);font:800 19px 'Barlow Condensed',var(--font-montserrat),system-ui,sans-serif;text-transform:uppercase}
.btn{min-height:48px;padding:0 18px;border:1px solid var(--line);background:none;color:var(--ink);font:600 17px 'Barlow',var(--font-geist-sans),system-ui,sans-serif;cursor:pointer}
.btn[aria-pressed=true]{background:var(--c);border-color:var(--c);color:#000}
.sos{min-height:52px;padding:0 26px;border:0;background:var(--red);color:#1a0705;font:800 22px 'Barlow Condensed',var(--font-montserrat),system-ui,sans-serif;cursor:pointer}
.layout{display:grid;grid-template-columns:minmax(280px,1fr) minmax(300px,470px) 300px;gap:32px;margin-top:26px;align-items:start}
@media(max-width:1100px){.layout{grid-template-columns:1fr}}
.bar{display:flex;justify-content:space-between;gap:8px;background:var(--c);color:#000;font:800 21px 'Barlow Condensed',var(--font-montserrat),system-ui,sans-serif;padding:2px 10px}
.srow{display:block;width:100%;padding:10px 0;background:none;border:0;border-bottom:1px dotted var(--line);color:inherit;font:inherit;text-align:left;cursor:pointer}
.srow[aria-pressed=true] .bar{background:var(--y)}
.srow small{display:block;margin-top:4px;font-size:16px;font-weight:600}
.sec{padding:12px 0;border-bottom:1px dotted var(--line)}
.sec h3{margin:0 0 4px;font:800 24px 'Barlow Condensed',var(--font-montserrat),system-ui,sans-serif}
.sec p{margin:0;font-size:20px;line-height:1.45;max-width:56ch}
.sec p::before{content:"●";color:var(--y);margin-right:8px;font-size:.7em}
.mt{display:grid;grid-template-columns:1fr auto;gap:16px;padding:10px 0;border-bottom:1px dotted var(--line)}
.mono{font-family:'IBM Plex Mono',var(--font-geist-mono),ui-monospace,monospace;font-size:20px}
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
.xp-markers{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden}
.body3d-marker[hidden]{display:none}
.body3d-marker{position:absolute;left:0;top:0;width:0;height:0;padding:0;border:0;background:none;color:var(--ink);cursor:pointer;font:inherit;pointer-events:auto}
.body3d-dot{position:absolute;left:-13px;top:-13px;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--status);color:#05070a;font:700 14px 'Barlow',sans-serif;border:2px solid #05070a;box-shadow:0 0 0 1px var(--status)}
.body3d-dot::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:2px solid var(--status);opacity:0}
.body3d-num{position:absolute;left:-9px;top:-9px;width:16px;height:16px;border-radius:50%;background:var(--b);color:#fff;font:800 10px 'Barlow',sans-serif;display:flex;align-items:center;justify-content:center}
.body3d-lead{position:absolute;left:13px;top:var(--dy);width:56px;height:1px;background:var(--ink);opacity:.45;transform-origin:left center}
.body3d-label{position:absolute;left:69px;top:calc(var(--dy) - 18px);display:flex;flex-direction:column;align-items:flex-start;padding:2px 8px;background:rgba(5,7,10,.82);border-left:2px solid var(--status);line-height:1.1;white-space:nowrap}
.body3d-label strong{font:800 16px 'Barlow Condensed',sans-serif}
.body3d-label em{font:700 12px 'Barlow',sans-serif;font-style:normal;color:var(--status)}
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
.organ3d-canvas{position:relative;height:clamp(340px,44vh,420px);background:radial-gradient(ellipse at 50% 50%,#0f1a24 0%,var(--bg) 72%);border:1px dotted var(--line)}
.organ3d-credit{margin:6px 0 0;font-size:13px}
.organ3d-credit a{color:var(--c)}
.organ3d-empty{margin:0;font-size:16px}
.xp-card .organ3d{margin-top:0;padding-top:0;border-top:0}
.xp-stage{position:relative;margin-top:22px;height:clamp(580px,84vh,900px);border:1px solid #1c2733;background:radial-gradient(ellipse at 50% 42%,#0e1f2d 0%,#070b10 55%,var(--bg) 80%);overflow:hidden}
.xp-stage::before,.xp-stage::after{content:"";position:absolute;width:42px;height:42px;border:2px solid var(--c);pointer-events:none;z-index:3;opacity:.7}
.xp-stage::before{top:8px;left:8px;border-right:0;border-bottom:0}
.xp-stage::after{bottom:8px;right:8px;border-left:0;border-top:0}
.xp-canvas{position:absolute;inset:0}
.xp-canvas canvas{touch-action:pan-y!important}
.xp-placeholder{display:flex;align-items:center;justify-content:center;color:var(--dim);font:500 15px 'IBM Plex Mono',monospace}
.xp-grid{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(0,168,232,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,168,232,.07) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse at center,#000 25%,transparent 72%);mask-image:radial-gradient(ellipse at center,#000 25%,transparent 72%)}
.xp-phase{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:4;display:flex;gap:10px;align-items:center;padding:6px 14px;background:rgba(5,7,10,.75);border:1px solid rgba(0,168,232,.45);color:var(--c);font:700 15px 'Barlow Condensed',sans-serif;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
.xp-phase-n{color:var(--y);font-family:'IBM Plex Mono',monospace;letter-spacing:0}
.xp-skip{position:absolute;top:12px;right:16px;z-index:4;min-height:40px;padding:0 14px;background:rgba(5,7,10,.75);border:1px solid var(--line);color:var(--ink);font:600 15px 'Barlow',sans-serif;cursor:pointer}
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
.xp-finding strong{display:block;font:800 19px 'Barlow Condensed',sans-serif}
.xp-finding span{display:block;font:700 14px 'Barlow',sans-serif}
.xp-finding .mono{display:inline;font-size:13px}
.xp-finding small{display:block;margin-top:4px;color:var(--dim);font-size:14px;line-height:1.35}
.xp-summary{margin-top:16px;padding-top:12px;border-top:1px dotted var(--line)}
.xp-summary p{margin:0 0 10px;font-size:26px;font-weight:800;line-height:1.05}
.xp-cta{width:100%;min-height:54px;border:0;background:var(--y);color:#000;font:800 22px 'Barlow Condensed',sans-serif;cursor:pointer}
.xp-title{margin:0 0 10px;font-size:34px;line-height:1;font-weight:800}
.xp-status{margin:10px 0 4px;font:700 19px 'Barlow',sans-serif}
.xp-panel .sec h3{font-size:20px}
.xp-panel .sec p{font-size:17px}
.xp-panel .mono{font-size:16px}
.xp-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px}
.xp-nav .btn{min-height:42px;min-width:52px}
.xp-sys{display:flex;align-items:center;gap:10px;width:100%;margin-bottom:6px;padding:8px;background:rgba(255,255,255,.02);border:1px solid transparent;color:inherit;text-align:left;cursor:pointer;transition:border-color .15s,background .15s}
.xp-sys:hover{border-color:var(--line)}
.xp-sys[aria-pressed=true]{border-color:var(--y);background:rgba(255,230,0,.06)}
.xp-sys-icon{flex-shrink:0;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#05070a;font-weight:800;font-size:14px}
.xp-sys-text strong{display:block;font:800 17px 'Barlow Condensed',sans-serif}
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
const SYSTEM_IDS: SystemId[] = ["neuro", "cardio", "inmune", "oseo", "conducta"];

/**
 * Escáner corporal 3D y explorador de anatomía (equipo UX/UI). Ocupa la
 * primera pantalla de la página única de ExoVitals.
 */
export function BodyMapHUD({ mision }: { mision?: MissionSlug } = {}) {
  const { t, lang } = useT();
  const snapshot = useClinicalSnapshot(mision);
  const trendSeries = useSystemTrendSeries();

  const [selectedSystem, setSelectedSystem] = useState<SystemId>("inmune");
  const [isSurgeonMode, setIsSurgeonMode] = useState<boolean>(false);
  const [emergencyActive, setEmergencyActive] = useState<boolean>(false);

  const isEmergency = snapshot.alerts.isEmergency;
  const triggerCodeRed = useTelemetryStore((s) => s.triggerCodeRed);
  const simulateScenario = useTelemetryStore((s) => s.simulateScenario);

  const showEmergency = emergencyActive || isEmergency;

  // Experiencia 3D: fase 1 escaneo holográfico → fase 2 anatomía
  const [stage, setStage] = useState<Stage>("intro");
  const [layer, setLayer] = useState<Layer>("anatomy");
  const [progress, setProgress] = useState(0);
  const [detected, setDetected] = useState<SystemId[]>([]);
  const [scanDone, setScanDone] = useState(false);
  const [introKey, setIntroKey] = useState(0);
  const [homeKey, setHomeKey] = useState(0);

  const statusLabels: Record<StatusColor, string> = useMemo(
    () => ({
      green: t.common.green,
      amber: t.common.amber,
      red: t.common.red,
    }),
    [t]
  );

  const globalStatusText =
    snapshot.globalSeverity === "CRITICAL"
      ? t.common.critical
      : snapshot.globalSeverity === "WARNING"
        ? t.common.warning
        : t.common.optimal;

  const globalStatusColor =
    snapshot.globalSeverity === "CRITICAL"
      ? STATUS_FILL.red
      : snapshot.globalSeverity === "WARNING"
        ? STATUS_FILL.amber
        : STATUS_FILL.green;

  const systemsData = useMemo<Record<SystemId, SystemViewModel>>(() => {
    const out = {} as Record<SystemId, SystemViewModel>;
    for (const id of SYSTEM_IDS) {
      const snap = snapshot.systems[id];
      const sysText = t.bodyHud.systems[id];
      const rawTrend = trendSeries[id];
      const paddedTrend =
        rawTrend.length >= 7
          ? rawTrend.slice(-7)
          : [...Array(7 - rawTrend.length).fill(rawTrend[0] ?? snap.loadScore), ...rawTrend];

      out[id] = {
        id,
        name: sysText.name,
        short: sysText.short,
        metric: snap.primaryMetric[lang],
        hazard: SYSTEM_META[id].hazard[lang],
        trend: paddedTrend,
        status: snap.status,
        crewSummary: snap.crewSummary[lang],
        howToMeasure: SYSTEM_META[id].howToMeasure[lang],
        crewAction: snap.crewAction[lang],
        surgeonMetrics: snap.surgeonMetrics[lang],
      };
    }
    return out;
  }, [snapshot.systems, trendSeries, t, lang]);

  const ids = SYSTEM_IDS;
  const current = systemsData[selectedSystem];
  const sorted = useMemo(
    () =>
      [...SYSTEM_IDS].sort(
        (a, b) =>
          ORDER.indexOf(systemsData[a].status) - ORDER.indexOf(systemsData[b].status)
      ),
    [systemsData]
  );
  const rows = current.surgeonMetrics.split(" | ").map((m) => {
    const i = m.indexOf(": ");
    return i >= 0 ? [m.slice(0, i), m.slice(i + 2)] : [m, ""];
  });

  // Sistemas con problemas: se marcan sobre el holograma.
  const anomalies: Anomaly[] = ids
    .filter((id) => SEVERITY[systemsData[id].status] > 0)
    .map((id) => ({ id, severity: SEVERITY[systemsData[id].status] as 1 | 2 }));

  const markers: BodyMarker[] = ids.map((id) => {
    const sys = systemsData[id];
    return {
      id,
      number: ids.indexOf(id) + 1,
      title: sys.short,
      statusLabel: statusLabels[sys.status],
      icon: STATUS_ICON[sys.status],
      color: STATUS_FILL[sys.status],
      metric: sys.metric,
      critical: sys.status === "red",
    };
  });

  const onDetect = useCallback(
    (id: SystemId) => setDetected((d) => (d.includes(id) ? d : [...d, id])),
    []
  );
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

  // Teclado: ← → recorren sistemas, 1–5 eligen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showEmergency) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (stage === "explore") {
        if (e.key === "ArrowRight")
          setSelectedSystem((s) => sorted[(sorted.indexOf(s) + 1) % sorted.length]);
        if (e.key === "ArrowLeft")
          setSelectedSystem((s) => sorted[(sorted.indexOf(s) - 1 + sorted.length) % sorted.length]);
        const n = Number(e.key);
        if (n >= 1 && n <= ids.length) setSelectedSystem(ids[n - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, showEmergency, sorted, ids]);

  if (showEmergency) {
    return (
      <EmergencyProtocol
        onExit={() => {
          setEmergencyActive(false);
          if (isEmergency) simulateScenario("RESET");
        }}
      />
    );
  }

  const critical = anomalies.filter((a) => a.severity === 2).length;
  const tickLabels = current.trend.map((_, i) =>
    i === current.trend.length - 1
      ? lang === "es"
        ? "Ahora"
        : "Now"
      : `T-${current.trend.length - 1 - i}`
  );

  return (
    <div className="hud">
      <style>{GLOBAL_CSS}</style>
      <div className="stripe" />
      <header className="top">
        <div>
          <p className="mono dim" style={{ fontSize: 12, margin: "0 0 6px" }}>
            {t.common.prototypeBadge} · {snapshot.comms.commsMode[lang]}
          </p>
          <h1>{t.bodyHud.overviewHeading}</h1>
          <p className="dek">{t.bodyHud.disclaimerBanner}</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div
            className="btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderColor: globalStatusColor,
              color: globalStatusColor,
              cursor: "default",
            }}
          >
            <span>{t.bodyHud.globalStatusLabel}:</span>
            <strong>{globalStatusText}</strong>
          </div>
          <div role="group" aria-label="View mode" style={{ display: "flex" }}>
            <button
              className="btn"
              aria-pressed={!isSurgeonMode}
              onClick={() => setIsSurgeonMode(false)}
            >
              {t.bodyHud.roleCrew}
            </button>
            <button
              className="btn"
              aria-pressed={isSurgeonMode}
              onClick={() => setIsSurgeonMode(true)}
            >
              {t.bodyHud.roleSurgeon}
            </button>
          </div>
          <button
            className="sos"
            onClick={() => {
              setEmergencyActive(true);
              triggerCodeRed();
            }}
          >
            ■ {t.bodyHud.emergencyButton}
          </button>
        </div>
      </header>

      {/* ---------------- Escenario 3D ---------------- */}
      <section className={`xp-stage is-${stage}`} aria-label={t.bodyHud.overviewHeading}>
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
        />
        <div className="xp-grid" aria-hidden />

        <div className="xp-phase">
          <span className="xp-phase-n">{stage === "intro" ? "01" : "02"}</span>
          <span>
            {stage === "intro"
              ? lang === "es"
                ? "Escaneo biométrico"
                : "Biometric scan"
              : layer === "anatomy"
                ? `${t.bodyHud.modeAnatomy}`
                : `${t.bodyHud.modeHologram}`}
          </span>
        </div>

        {stage === "intro" ? (
          <>
            <button className="xp-skip" onClick={() => explore()}>
              {lang === "es" ? "Saltar escaneo →" : "Skip scan →"}
            </button>

            <aside className="xp-panel xp-left" aria-live="polite">
              <p className="kick">{lang === "es" ? "Escaneo 360°" : "360° Scan"}</p>
              <div
                className="xp-progress"
                role="progressbar"
                aria-label="Scan progress"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div style={{ width: `${progress}%` }} />
              </div>
              <p className="mono dim xp-pct">
                {scanDone
                  ? lang === "es"
                    ? "Escaneo completo"
                    : "Scan complete"
                  : `${lang === "es" ? "Analizando…" : "Analyzing…"} ${progress}%`}
              </p>

              <ol className="xp-findings">
                {detected.map((id) => {
                  const sys = systemsData[id];
                  return (
                    <li key={id} className={`xp-finding is-${sys.status}`}>
                      <span className="xp-finding-icon" aria-hidden>
                        {STATUS_ICON[sys.status]}
                      </span>
                      <div>
                        <strong>{sys.short}</strong>
                        <span style={{ color: STATUS_FILL[sys.status] }}>
                          {statusLabels[sys.status]} · <span className="mono">{sys.metric}</span>
                        </span>
                        <small>{sys.crewSummary}</small>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {detected.length === 0 && !scanDone && (
                <p className="dim xp-wait">
                  {lang === "es"
                    ? "Evaluando telemetría fisiológica y ambiental…"
                    : "Evaluating physiological and cabin telemetry…"}
                </p>
              )}

              {scanDone && (
                <div className="xp-summary">
                  <p className="disp">
                    {anomalies.length}{" "}
                    {lang === "es"
                      ? anomalies.length === 1
                        ? "sistema fuera de rango"
                        : "sistemas fuera de rango"
                      : anomalies.length === 1
                        ? "system flagged"
                        : "systems flagged"}
                    {critical > 0 && (
                      <span style={{ color: STATUS_FILL.red }}>
                        {" "}
                        · {critical}{" "}
                        {lang === "es" ? `crítica${critical > 1 ? "s" : ""}` : "critical"}
                      </span>
                    )}
                  </p>
                  <button
                    className="xp-cta"
                    onClick={() =>
                      explore(anomalies.find((a) => a.severity === 2)?.id ?? anomalies[0]?.id)
                    }
                  >
                    {lang === "es" ? "Explorar anatomía →" : "Inspect anatomy →"}
                  </button>
                </div>
              )}
            </aside>
          </>
        ) : (
          <>
            <aside className="xp-panel xp-left" aria-live="polite">
              <p className="kick">{lang === "es" ? "Sistema seleccionado" : "Selected system"}</p>
              <h2 className="disp xp-title">{current.name}</h2>
              <div className="bar" style={{ display: "inline-flex", fontSize: 17 }}>
                {lang === "es" ? "Riesgo NASA:" : "NASA Risk:"} {current.hazard}
              </div>
              <p className="xp-status" style={{ color: STATUS_FILL[current.status] }}>
                {STATUS_ICON[current.status]} {statusLabels[current.status]} ·{" "}
                <span className="dim mono">{current.metric}</span>
              </p>
              {!isSurgeonMode ? (
                <>
                  <div className="sec">
                    <h3>{t.bodyHud.whatToWatch}</h3>
                    <p>{current.crewSummary}</p>
                  </div>
                  <div className="sec">
                    <h3>{lang === "es" ? "Cómo medirlo" : "How to measure"}</h3>
                    <p>{current.howToMeasure}</p>
                  </div>
                  <div className="sec">
                    <h3>{t.bodyHud.recommendedAction}</h3>
                    <p>{current.crewAction}</p>
                  </div>
                </>
              ) : (
                <div className="sec">
                  <h3>{t.bodyHud.clinicalNotes}</h3>
                  {rows.map(([k, v]) => (
                    <div className="mt" key={k}>
                      <span className="dim">{k}</span>
                      <span className="mono">{v}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="xp-nav">
                <button
                  className="btn"
                  onClick={() => step(-1)}
                  aria-label={lang === "es" ? "Sistema anterior" : "Previous system"}
                >
                  ←
                </button>
                <span className="dim">
                  {sorted.indexOf(selectedSystem) + 1} / {sorted.length}
                </span>
                <button
                  className="btn"
                  onClick={() => step(1)}
                  aria-label={lang === "es" ? "Sistema siguiente" : "Next system"}
                >
                  →
                </button>
              </div>
            </aside>

            <aside className="xp-panel xp-right">
              <p className="kick">
                {lang === "es" ? "Sistemas · prioridad clínica" : "Systems · clinical priority"}
              </p>
              {sorted.map((id) => {
                const sys = systemsData[id];
                return (
                  <button
                    key={id}
                    className={`xp-sys is-${sys.status}`}
                    aria-pressed={selectedSystem === id}
                    onClick={() => setSelectedSystem(id)}
                  >
                    <span
                      className="xp-sys-icon"
                      style={{ background: STATUS_FILL[sys.status] }}
                      aria-hidden
                    >
                      {STATUS_ICON[sys.status]}
                    </span>
                    <span className="xp-sys-text">
                      <strong>
                        {ids.indexOf(id) + 1} · {sys.short}
                      </strong>
                      <small style={{ color: STATUS_FILL[sys.status] }}>
                        {statusLabels[sys.status]}{" "}
                        <span className="dim mono">{sys.metric}</span>
                      </small>
                    </span>
                  </button>
                );
              })}

              <p className="kick" style={{ marginTop: 18 }}>
                {lang === "es" ? "Capa visual" : "Layer"}
              </p>
              <div role="group" aria-label="Body layer" className="xp-seg">
                <button
                  className="btn"
                  aria-pressed={layer === "anatomy"}
                  onClick={() => setLayer("anatomy")}
                >
                  {t.bodyHud.modeAnatomy}
                </button>
                <button
                  className="btn"
                  aria-pressed={layer === "hologram"}
                  onClick={() => setLayer("hologram")}
                >
                  {t.bodyHud.modeHologram}
                </button>
              </div>
              <div className="xp-actions">
                <button className="btn" onClick={() => setHomeKey((k) => k + 1)}>
                  ⤢ {t.bodyHud.homeCamera}
                </button>
                <button className="btn" onClick={replayScan}>
                  ↻ {t.bodyHud.rescanButton}
                </button>
              </div>
            </aside>

            <p className="xp-hint dim">
              {lang === "es"
                ? "Arrastra para girar · rueda para acercar · ← → para cambiar de sistema"
                : "Drag to orbit · scroll to zoom · ← → to switch system"}
            </p>
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
            <p className="kick">
              {lang === "es"
                ? `Tendencia de carga en sesión · ${current.short}`
                : `Live session load trend · ${current.short}`}
            </p>
            <div
              className="chart"
              role="img"
              aria-label={`${current.short}: ${current.trend.join(", ")}`}
            >
              {current.trend.map((v, i) => {
                const st: StatusColor = v >= 70 ? "red" : v >= 40 ? "amber" : "green";
                return (
                  <div className="col" key={i}>
                    <span className="mono" style={{ fontSize: 15 }}>
                      {STATUS_ICON[st]} {v}
                    </span>
                    <div
                      className="cb"
                      style={{ height: Math.max(8, v * 1.5), background: STATUS_FILL[st] }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="days">
              {tickLabels.map((lbl, idx) => (
                <span key={`${lbl}-${idx}`}>{lbl}</span>
              ))}
            </div>
            <p className="dim" style={{ fontSize: 15, margin: "10px 0 0" }}>
              {lang === "es"
                ? "Índice derivado en vivo 0–100: ✓ < 40 óptimo · ▲ 40–69 precaución · ■ ≥ 70 crítico"
                : "Live telemetry index 0–100: ✓ < 40 nominal · ▲ 40–69 caution · ■ ≥ 70 critical"}
            </p>
            {SYSTEM_MODELS[selectedSystem].models.length === 0 && (
              <p className="dim" style={{ fontSize: 15 }}>
                {t.bodyHud.noModelAvailable}
              </p>
            )}
          </div>
        </section>
      )}

      <p className="src">{t.common.prototypeBadge}</p>
      <p className="src">
        {lang === "es" ? "Modelos 3D (Sketchfab):" : "3D Models (Sketchfab):"}{" "}
        {ALL_CREDITS.map((c, i) => (
          <span key={c.source}>
            {i > 0 && " · "}
            <a href={c.source} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
              {c.title}
            </a>{" "}
            — {c.author} ({c.license})
          </span>
        ))}
      </p>
    </div>
  );
}

export default BodyMapHUD;
