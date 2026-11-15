import type { SupportedLang } from '../config/missionComms';
import type { EvaluationStepId, MissionProfileId } from '../types/mission';
import type { Biomarkers, ClinicalAlerts, Environment } from '../types/telemetry';
import { EVALUATION_STEPS, stepIndexOf } from './missionPlan';

export type CountermeasureCategory =
  | 'bone'
  | 'cardio'
  | 'hydration'
  | 'mental';

export type CountermeasurePriority = 'routine' | 'high' | 'hold';

export interface CountermeasureItem {
  id: string;
  stepId: EvaluationStepId;
  category: CountermeasureCategory;
  priority: CountermeasurePriority;
  title: string;
  prescription: string;
  why: string;
  xpReward: number;
}

export interface CountermeasurePlan {
  missionProfileId: MissionProfileId;
  dxaLimitationNote: string;
  orthostaticStatus: 'normal' | 'borderline' | 'positive-intolerance' | 'unmeasured';
  boneSummary: string;
  cardioSummary: string;
  items: CountermeasureItem[];
}

function stepXp(id: EvaluationStepId): number {
  const idx = stepIndexOf(id);
  return idx >= 0 ? EVALUATION_STEPS[idx].xp : 20;
}

/**
 * Clasifica la prueba ortostática simplificada (incorporación controlada / LBNP).
 * Criterio prototipo: ΔFC >= 30 lpm o ΔPAS <= -20 mmHg sugiere intolerancia ortostática.
 */
export function evaluateOrthostaticScreen(
  deltaHr?: number,
  deltaSys?: number
): 'normal' | 'borderline' | 'positive-intolerance' | 'unmeasured' {
  if (
    typeof deltaHr !== 'number' ||
    !Number.isFinite(deltaHr) ||
    typeof deltaSys !== 'number' ||
    !Number.isFinite(deltaSys)
  ) {
    return 'unmeasured';
  }
  if (deltaHr >= 30 || deltaSys <= -20) {
    return 'positive-intolerance';
  }
  if (deltaHr >= 20 || deltaSys <= -10) {
    return 'borderline';
  }
  return 'normal';
}

/**
 * Genera de forma pura y determinista (< 1 ms) las contramedidas diarias
 * adaptadas a biomarcadores óseos, cardiovasculares y alertas activas.
 */
export function deriveDailyCountermeasures(input: {
  biomarkers: Biomarkers;
  environment: Environment;
  alerts: ClinicalAlerts;
  missionProfileId: MissionProfileId;
  lang: SupportedLang;
}): CountermeasurePlan {
  const { biomarkers, environment, alerts, missionProfileId, lang } = input;

  const ctx = biomarkers.ctxNtxIndex ?? 1.02;
  const p1np = biomarkers.p1npIndex ?? 0.98;
  const ared = biomarkers.aredLoadPct ?? 92;
  const hrv = biomarkers.hrvRmssdMs ?? 46;
  const orthoStatus = evaluateOrthostaticScreen(
    biomarkers.orthostaticDeltaHr,
    biomarkers.orthostaticDeltaSys
  );

  const highBoneResorption = ctx >= 1.35 || biomarkers.calcioIonico > 1.25 || ared < 70;
  const highCardioDeconditioning =
    orthoStatus === 'positive-intolerance' || hrv < 25 || biomarkers.heartRate > 100;
  const exerciseHold = alerts.isEmergency || environment.co2Level > 5000;

  const isLunar = missionProfileId === 'LUNAR_ARTEMIS';
  const gravityLabel = isLunar ? '0,16 g' : missionProfileId === 'ISS_6M' ? '0 g' : '0 g / 0,38 g';

  const dxaLimitationNote =
    lang === 'es'
      ? 'Limitación de hardware: no existe densitometría ósea DXA a bordo. Se monitoriza el balance remodelado mediante marcadores bioquímicos (CTX/NTX y P1NP), Ca²⁺ sérico y adherencia de carga en ARED.'
      : 'Hardware limitation: onboard DXA bone densitometry is unavailable during flight. Remodeling balance is tracked via biochemical surrogates (CTX/NTX, P1NP), serum Ca²⁺, and ARED loading adherence.';

  const boneSummary =
    lang === 'es'
      ? highBoneResorption
        ? `Resorción elevada (CTX/NTX ${ctx.toFixed(2)}, P1NP ${p1np.toFixed(2)}, ARED ${Math.round(ared)}%). Priorizar carga axial.`
        : `Equilibrio óseo estable (CTX/NTX ${ctx.toFixed(2)}, P1NP ${p1np.toFixed(2)}, ARED ${Math.round(ared)}%).`
      : highBoneResorption
        ? `Elevated resorption (CTX/NTX ${ctx.toFixed(2)}, P1NP ${p1np.toFixed(2)}, ARED ${Math.round(ared)}%). Prioritize axial loading.`
        : `Bone turnover balanced (CTX/NTX ${ctx.toFixed(2)}, P1NP ${p1np.toFixed(2)}, ARED ${Math.round(ared)}%).`;

  const cardioSummary =
    lang === 'es'
      ? highCardioDeconditioning
        ? `Desacondicionamiento activo (HRV ${Math.round(hrv)} ms, estado ortostático: ${orthoStatus}). Reforzar volumen e intervalo aeróbico.`
        : `Tono autonómico estable (HRV ${Math.round(hrv)} ms, ortostática ${orthoStatus}).`
      : highCardioDeconditioning
        ? `Active deconditioning signals (HRV ${Math.round(hrv)} ms, orthostatic: ${orthoStatus}). Reinforce fluid preload & aerobic pacing.`
        : `Autonomic balance stable (HRV ${Math.round(hrv)} ms, orthostatic ${orthoStatus}).`;

  const items: CountermeasureItem[] = [
    {
      id: 'cm-ared-resistive',
      stepId: 'RESISTIVE',
      category: 'bone',
      priority: exerciseHold ? 'hold' : highBoneResorption ? 'high' : 'routine',
      title:
        lang === 'es'
          ? exerciseHold
            ? 'ARED Resistivo EN PAUSA (estabilizar cabina/emergencia)'
            : 'Entrenamiento Resistivo ARED (Carga axial hueso-músculo)'
          : exerciseHold
            ? 'ARED Resistive ON HOLD (stabilize cabin/emergency first)'
            : 'ARED Resistive Loading (Bone & Muscle Protection)',
      prescription:
        lang === 'es'
          ? exerciseHold
            ? 'Diferir carga máxima hasta despejar Código Rojo o CO₂ > 5000 ppm.'
            : highBoneResorption
              ? `Sentadilla, peso muerto y elevación de talones: 4 series × 8 reps al 75–85% 1RM (objetivo compensar déficit ARED en ${gravityLabel}).`
              : `Protocolo de mantenimiento ARED: 3 series × 10 reps multiarticulares en ${gravityLabel}.`
          : exerciseHold
            ? 'Defer high-load resistance sets until Code Red or CO₂ > 5000 ppm clears.'
            : highBoneResorption
              ? `Squats, deadlifts, and heel raises: 4×8 reps at 75–85% 1RM to close ARED deficit in ${gravityLabel}.`
              : `Maintenance ARED session: 3×10 multi-joint lifts calibrated for ${gravityLabel}.`,
      why:
        lang === 'es'
          ? `Frena pérdida ósea trabecular/cortical y sarcopenia; evita liberación adicional de Ca²⁺ (${biomarkers.calcioIonico.toFixed(2)} mmol/L).`
          : `Curbs trabecular/cortical bone loss and sarcopenia while stabilizing ionized Ca²⁺ (${biomarkers.calcioIonico.toFixed(2)} mmol/L).`,
      xpReward: stepXp('RESISTIVE'),
    },
    {
      id: 'cm-aerobic',
      stepId: 'AEROBIC',
      category: 'cardio',
      priority: exerciseHold ? 'hold' : highCardioDeconditioning ? 'high' : 'routine',
      title:
        lang === 'es'
          ? 'Protocolo Aeróbico CEVIS / Cinta T2'
          : 'Aerobic Countermeasure (CEVIS Cycle / T2 Treadmill)',
      prescription:
        lang === 'es'
          ? exerciseHold
            ? 'Suspender esfuerzo aeróbico intenso hasta normalizar ventilación / emergencia.'
            : highCardioDeconditioning
              ? '30 min en Zona 2–3 con intervalos moderados + hidratación previa para compensar intolerancia ortostática.'
              : '30 min aeróbico mixto (70–80% FC máx) para preservar VO₂máx y volumen plasmático.'
          : exerciseHold
            ? 'Hold strenuous aerobic blocks until acute emergency or CO₂ fault resolves.'
            : highCardioDeconditioning
              ? '30 min Zone 2–3 cycling with fluid preload to counter orthostatic deconditioning.'
              : '30 min mixed aerobic session (70–80% HRmax) preserving VO₂max & plasma volume.',
      why:
        lang === 'es'
          ? `Preserva variabilidad cardíaca (HRV actual ${Math.round(hrv)} ms) y tolerancia ortostática ante reentrada o gravedad planetaria.`
          : `Maintains heart rate variability (current HRV ${Math.round(hrv)} ms) and orthostatic tolerance prior to gravity loading.`,
      xpReward: stepXp('AEROBIC'),
    },
    {
      id: 'cm-hydration',
      stepId: 'HYDRATION',
      category: 'hydration',
      priority:
        alerts.isRenalWarning || orthoStatus === 'positive-intolerance'
          ? 'high'
          : 'routine',
      title:
        lang === 'es'
          ? 'Hidratación Fraccionada, Electrolitos y Citrato'
          : 'Divided Fluid Preload, Electrolytes & Citrate',
      prescription:
        lang === 'es'
          ? alerts.isRenalWarning || highBoneResorption
            ? 'Objetivo ampliado ≥ 2,8–3,0 L/día en tomas de 250 mL + citrato potásico si prescrito.'
            : 'Objetivo basal 2,5 L/día repartidos en 4 bloques medidos.'
          : alerts.isRenalWarning || highBoneResorption
            ? 'Expanded target ≥ 2.8–3.0 L/day in 250 mL doses + potassium citrate if prescribed.'
            : 'Baseline target 2.5 L/day across 4 logged hydration blocks.',
      why:
        lang === 'es'
          ? 'Reduce sobresaturación urinaria de calcio (litiasis renal) y expande volumen plasmático.'
          : 'Reduces urinary calcium stone supersaturation and restores circulating plasma volume.',
      xpReward: stepXp('HYDRATION'),
    },
    {
      id: 'cm-coherence',
      stepId: 'MIND',
      category: 'mental',
      priority: hrv < 25 || biomarkers.cortisol > 18 ? 'high' : 'routine',
      title:
        lang === 'es'
          ? 'Respiración de Coherencia Cardíaca (Tono Vagal / HRV)'
          : 'Cardiac Coherence Paced Breathing (Vagal Tone / HRV)',
      prescription:
        lang === 'es'
          ? '5 minutos de respiración rítmica (5 s inhalar · 5 s exhalar, 6 ciclos/min) antes de dormir o tras carga ARED.'
          : '5 min paced breathing (5 s inhale · 5 s exhale, 6 breaths/min) pre-sleep or post-workout.',
      why:
        lang === 'es'
          ? `Estimula recuperación parasimpática (HRV ${Math.round(hrv)} ms) y atenúa picos de cortisol (${biomarkers.cortisol.toFixed(1)} ng/mL).`
          : `Boosts parasympathetic recovery (HRV ${Math.round(hrv)} ms) and blunts cortisol surges (${biomarkers.cortisol.toFixed(1)} ng/mL).`,
      xpReward: stepXp('MIND'),
    },
  ];

  return {
    missionProfileId,
    dxaLimitationNote,
    orthostaticStatus: orthoStatus,
    boneSummary,
    cardioSummary,
    items,
  };
}
