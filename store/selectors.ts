'use client';

import { useShallow } from 'zustand/react/shallow';
import { useTelemetryStore } from './useTelemetryStore';
import { useMissionStore } from './useMissionStore';
import { computeNlr, getAlertSeverity } from '../utils/clinicalEngine';
import { getMissionComms, type MissionCommsProfile, type SupportedLang } from '../config/missionComms';
import { MISSION_CHOICES, type MissionSlug } from '../utils/missionChoice';
import type { AlertSeverity, Biomarkers, ClinicalAlerts, Environment } from '../types/telemetry';
import type { MissionProfileId } from '../types/mission';

export type PhysiologicalSystemId = 'neuro' | 'cardio' | 'inmune' | 'oseo' | 'conducta';
export type SystemHealthStatus = 'green' | 'amber' | 'red';

export interface DerivedSystemSnapshot {
  id: PhysiologicalSystemId;
  status: SystemHealthStatus;
  /** Índice 0–100 de carga/anomalía derivado exclusivamente de telemetría real. */
  loadScore: number;
  primaryMetric: Record<SupportedLang, string>;
  crewSummary: Record<SupportedLang, string>;
  crewAction: Record<SupportedLang, string>;
  surgeonMetrics: Record<SupportedLang, string>;
}

export interface ClinicalSnapshot {
  biomarkers: Biomarkers;
  environment: Environment;
  alerts: ClinicalAlerts;
  globalSeverity: AlertSeverity;
  isManualOverride: boolean;
  nlr: number;
  cisCRatio: number;
  sleepHoursRecorded: number | null;
  sleepIsFromToday: boolean;
  missionProfileId: MissionProfileId;
  comms: MissionCommsProfile;
  systems: Record<PhysiologicalSystemId, DerivedSystemSnapshot>;
  worstSystemStatus: SystemHealthStatus;
}

export function deriveSystemSnapshots(input: {
  biomarkers: Biomarkers;
  environment: Environment;
  alerts: ClinicalAlerts;
  sleepHoursRecorded: number | null;
}): Record<PhysiologicalSystemId, DerivedSystemSnapshot> {
  const { biomarkers, environment, alerts, sleepHoursRecorded } = input;
  const { heartRate, spO2, cistatinaC, creatinina, calcioIonico, linfocitos, neutrofilos, cortisol } = biomarkers;
  const { co2Level, radiationRate, radiationAccumulated } = environment;

  const nlr = computeNlr(biomarkers);
  const cisCRatio = creatinina > 0 ? cistatinaC / creatinina : 0;

  // 1. Neurológico y Ocular (CO2 / neuroestrés) — sin mediciones ficticias (ej. ONSD sin ecografía)
  const neuroStatus: SystemHealthStatus =
    alerts.isEmergency || co2Level > 4000
      ? 'red'
      : alerts.isCo2Warning || co2Level > 3500 || cortisol > 20
        ? 'amber'
        : 'green';
  const neuroScore = Math.min(
    100,
    Math.round(
      (co2Level / 5000) * 55 + (cortisol > 18 ? (cortisol - 18) * 3 : 0) + (alerts.isCo2Warning ? 20 : 0)
    )
  );

  // 2. Cardiovascular y Perfusión
  const cardioStatus: SystemHealthStatus =
    alerts.isEmergency || spO2 < 92 || heartRate > 125 || heartRate < 42
      ? 'red'
      : heartRate > 105 || heartRate < 50 || spO2 < 95
        ? 'amber'
        : 'green';
  const cardioScore = Math.min(
    100,
    Math.round(
      Math.abs(heartRate - 70) * 0.7 + (spO2 < 98 ? (98 - spO2) * 8 : 0) + (alerts.isEmergency ? 30 : 0)
    )
  );

  // 3. Inmunológico y Radiación
  const inmuneStatus: SystemHealthStatus =
    alerts.isRadiationWarning
      ? 'red'
      : radiationRate > 35 || radiationAccumulated > 35 || nlr > 2.5 || linfocitos < 1300
        ? 'amber'
        : 'green';
  const inmuneScore = Math.min(
    100,
    Math.round(nlr * 12 + Math.min(40, (radiationRate / 80) * 35) + (alerts.isRadiationWarning ? 25 : 0))
  );

  // 4. Renal, Calcio y Remodelado Óseo
  const oseoStatus: SystemHealthStatus =
    alerts.isRenalWarning
      ? 'red'
      : cistatinaC > 1.05 || calcioIonico > 1.2 || cisCRatio > 1.15
        ? 'amber'
        : 'green';
  const oseoScore = Math.min(
    100,
    Math.round(
      Math.max(0, (cistatinaC - 0.7) * 55) +
        Math.max(0, (calcioIonico - 1.1) * 90) +
        (alerts.isRenalWarning ? 25 : 0)
    )
  );

  // 5. Conducta, Estrés y Sueño (solo usa horas reales si fueron registradas en MissionStore)
  const poorSleep = sleepHoursRecorded !== null && sleepHoursRecorded < 5.5;
  const borderlineSleep = sleepHoursRecorded !== null && sleepHoursRecorded < 6.5;
  const conductaStatus: SystemHealthStatus =
    cortisol > 23 || poorSleep ? 'red' : cortisol > 18 || borderlineSleep ? 'amber' : 'green';
  const conductaScore = Math.min(
    100,
    Math.round(cortisol * 2.5 + (sleepHoursRecorded !== null && sleepHoursRecorded < 7 ? (7 - sleepHoursRecorded) * 14 : 0))
  );

  const sleepTextEs =
    sleepHoursRecorded !== null ? `${sleepHoursRecorded.toFixed(1)} h` : 'Sin registro hoy';
  const sleepTextEn =
    sleepHoursRecorded !== null ? `${sleepHoursRecorded.toFixed(1)} h` : 'No record today';

  return {
    neuro: {
      id: 'neuro',
      status: neuroStatus,
      loadScore: neuroScore,
      primaryMetric: {
        es: `CO₂ ${Math.round(co2Level)} ppm`,
        en: `CO₂ ${Math.round(co2Level)} ppm`,
      },
      crewSummary: {
        es:
          neuroStatus === 'red'
            ? `CO₂ elevado (${Math.round(co2Level)} ppm): riesgo de cefalea, confusión y fatiga neurológica.`
            : neuroStatus === 'amber'
              ? `Alerta temprana de CO₂ (${Math.round(co2Level)} ppm) con SpO₂ aún compensada (${spO2}%).`
              : 'Ventilación de cabina y carga neurosensorial dentro de parámetros nominales.',
        en:
          neuroStatus === 'red'
            ? `High cabin CO₂ (${Math.round(co2Level)} ppm): risk of headache, confusion, and neurological strain.`
            : neuroStatus === 'amber'
              ? `Early CO₂ pocket warning (${Math.round(co2Level)} ppm) while SpO₂ remains compensated (${spO2}%).`
              : 'Cabin ventilation and neurosensory stress remain within nominal range.',
      },
      crewAction: {
        es:
          neuroStatus === 'green'
            ? 'Mantener ventilación nominal en cabina.'
            : 'Inspeccionar depuradores de CO₂, mejorar flujo de aire local y reportar cefalea o alteración visual.',
        en:
          neuroStatus === 'green'
            ? 'Maintain nominal cabin airflow circulation.'
            : 'Inspect CO₂ scrubbers, increase local airflow, and log headache or visual changes.',
      },
      surgeonMetrics: {
        es: `CO₂ Cabina: ${Math.round(co2Level)} ppm (Alerta prototipo > 3500) | SpO₂: ${spO2}% | Cortisol: ${cortisol.toFixed(1)} ng/mL | ONSD: sin ecografía a bordo`,
        en: `Cabin CO₂: ${Math.round(co2Level)} ppm (Prototype alert > 3500) | SpO₂: ${spO2}% | Cortisol: ${cortisol.toFixed(1)} ng/mL | ONSD: ultrasound unavailable onboard`,
      },
    },
    cardio: {
      id: 'cardio',
      status: cardioStatus,
      loadScore: cardioScore,
      primaryMetric: {
        es: `${Math.round(heartRate)} lpm · SpO₂ ${Math.round(spO2)}%`,
        en: `${Math.round(heartRate)} bpm · SpO₂ ${Math.round(spO2)}%`,
      },
      crewSummary: {
        es:
          cardioStatus === 'red'
            ? `Anomalía cardiorrespiratoria (${Math.round(heartRate)} lpm, SpO₂ ${spO2}%). Requiere reposo y verificación inmediata.`
            : cardioStatus === 'amber'
              ? `Carga cardíaca elevada o saturación limítrofe (${Math.round(heartRate)} lpm, SpO₂ ${spO2}%).`
              : 'Ritmo cardíaco y oxigenación arterial estables.',
        en:
          cardioStatus === 'red'
            ? `Cardiorespiratory anomaly (${Math.round(heartRate)} bpm, SpO₂ ${spO2}%). Rest and verify immediately.`
            : cardioStatus === 'amber'
              ? `Elevated cardiac strain or borderline saturation (${Math.round(heartRate)} bpm, SpO₂ ${spO2}%).`
              : 'Heart rate and arterial oxygenation are stable.',
      },
      crewAction: {
        es:
          cardioStatus === 'green'
            ? 'Continuar hidratación y protocolo aeróbico planificado.'
            : 'Detener esfuerzo físico, hidratarse y repetir medición en reposo.',
        en:
          cardioStatus === 'green'
            ? 'Continue hydration and scheduled aerobic countermeasure.'
            : 'Pause exertion, hydrate, and repeat resting measurement.',
      },
      surgeonMetrics: {
        es: `FC: ${Math.round(heartRate)} lpm | SpO₂: ${spO2}% | PA y RMSSD ortostático: sin captura actual`,
        en: `HR: ${Math.round(heartRate)} bpm | SpO₂: ${spO2}% | BP & orthostatic RMSSD: not yet captured`,
      },
    },
    inmune: {
      id: 'inmune',
      status: inmuneStatus,
      loadScore: inmuneScore,
      primaryMetric: {
        es: `NLR ${nlr.toFixed(2)} · Rad ${radiationRate.toFixed(0)} µSv/h`,
        en: `NLR ${nlr.toFixed(2)} · Rad ${radiationRate.toFixed(0)} µSv/h`,
      },
      crewSummary: {
        es:
          inmuneStatus === 'red'
            ? `Alerta de inmunosupresión por radiación: NLR ${nlr.toFixed(2)}, linfocitos ${Math.round(linfocitos)}/µL y tasa ${radiationRate.toFixed(0)} µSv/h.`
            : inmuneStatus === 'amber'
              ? `Vigilar tasa de radiación (${radiationRate.toFixed(0)} µSv/h) y razón NLR (${nlr.toFixed(2)}).`
              : 'Conteo inmune y exposición ambiental dentro de límites esperados.',
        en:
          inmuneStatus === 'red'
            ? `Radiation immunosuppression alert: NLR ${nlr.toFixed(2)}, lymphocytes ${Math.round(linfocitos)}/µL, rate ${radiationRate.toFixed(0)} µSv/h.`
            : inmuneStatus === 'amber'
              ? `Monitor radiation rate (${radiationRate.toFixed(0)} µSv/h) and NLR (${nlr.toFixed(2)}).`
              : 'Immune counts and ambient radiation exposure are within expected limits.',
      },
      crewAction: {
        es:
          inmuneStatus === 'green'
            ? 'Mantener monitoreo dosimétrico rutinario.'
            : 'Trasladarse al refugio antirradiación (mayor blindaje) y suspender EVA.',
        en:
          inmuneStatus === 'green'
            ? 'Maintain routine dosimetric monitoring.'
            : 'Move into shielded storm shelter and cancel planned EVA.',
      },
      surgeonMetrics: {
        es: `Linfocitos: ${Math.round(linfocitos)} cél/µL | Neutrófilos: ${Math.round(neutrofilos)} cél/µL | NLR: ${nlr.toFixed(2)} | Tasa: ${radiationRate.toFixed(1)} µSv/h | Acum: ${radiationAccumulated.toFixed(1)} mSv`,
        en: `Lymphocytes: ${Math.round(linfocitos)} cells/µL | Neutrophils: ${Math.round(neutrofilos)} cells/µL | NLR: ${nlr.toFixed(2)} | Rate: ${radiationRate.toFixed(1)} µSv/h | Acc: ${radiationAccumulated.toFixed(1)} mSv`,
      },
    },
    oseo: {
      id: 'oseo',
      status: oseoStatus,
      loadScore: oseoScore,
      primaryMetric: {
        es: `CisC ${cistatinaC.toFixed(2)} · Ca²⁺ ${calcioIonico.toFixed(2)}`,
        en: `CysC ${cistatinaC.toFixed(2)} · Ca²⁺ ${calcioIonico.toFixed(2)}`,
      },
      crewSummary: {
        es:
          oseoStatus === 'red'
            ? `Nefropatía oculta probable: Cistatina C ${cistatinaC.toFixed(2)} mg/L y Ca²⁺ ${calcioIonico.toFixed(2)} mmol/L (creatinina ${creatinina.toFixed(2)} mg/dL puede parecer normal por menor masa muscular).`
            : oseoStatus === 'amber'
              ? `Elevación leve de calcio iónico (${calcioIonico.toFixed(2)} mmol/L) o Cistatina C (${cistatinaC.toFixed(2)} mg/L).`
              : 'Filtración renal (Cistatina C) y calcio iónico estables.',
        en:
          oseoStatus === 'red'
            ? `Probable hidden nephropathy: Cystatin C ${cistatinaC.toFixed(2)} mg/L & Ca²⁺ ${calcioIonico.toFixed(2)} mmol/L (creatinine ${creatinina.toFixed(2)} mg/dL can look falsely normal due to muscle loss).`
            : oseoStatus === 'amber'
              ? `Borderline ionized calcium (${calcioIonico.toFixed(2)} mmol/L) or Cystatin C (${cistatinaC.toFixed(2)} mg/L).`
              : 'Renal filtration (Cystatin C) and ionized calcium remain stable.',
      },
      crewAction: {
        es:
          oseoStatus === 'green'
            ? 'Mantener hidratación ≥ 2,5 L/día y entrenamiento resistivo.'
            : 'Incrementar hidratación fraccionada inmediatamente y suspender suplementos de calcio sin indicación médica.',
        en:
          oseoStatus === 'green'
            ? 'Maintain ≥ 2.5 L/day hydration and resistive exercise.'
            : 'Increase scheduled fluid intake immediately and hold unprescribed calcium supplements.',
      },
      surgeonMetrics: {
        es: `Cistatina C: ${cistatinaC.toFixed(2)} mg/L | Creatinina: ${creatinina.toFixed(2)} mg/dL | Razón CisC/Cr: ${cisCRatio.toFixed(2)} | Ca²⁺: ${calcioIonico.toFixed(2)} mmol/L | DXA: no disponible a bordo`,
        en: `Cystatin C: ${cistatinaC.toFixed(2)} mg/L | Creatinine: ${creatinina.toFixed(2)} mg/dL | CysC/Cr ratio: ${cisCRatio.toFixed(2)} | Ca²⁺: ${calcioIonico.toFixed(2)} mmol/L | DXA: unavailable onboard`,
      },
    },
    conducta: {
      id: 'conducta',
      status: conductaStatus,
      loadScore: conductaScore,
      primaryMetric: {
        es: `Cortisol ${cortisol.toFixed(1)} · Sueño: ${sleepTextEs}`,
        en: `Cortisol ${cortisol.toFixed(1)} · Sleep: ${sleepTextEn}`,
      },
      crewSummary: {
        es:
          conductaStatus === 'red'
            ? `Carga alta de estrés o déficit marcado de sueño (Cortisol ${cortisol.toFixed(1)} ng/mL; sueño: ${sleepTextEs}).`
            : conductaStatus === 'amber'
              ? `Estrés moderado o descanso insuficiente (Cortisol ${cortisol.toFixed(1)} ng/mL; sueño: ${sleepTextEs}).`
              : `Cortisol estable (${cortisol.toFixed(1)} ng/mL) y registro de sueño/ánimo (${sleepTextEs}).`,
        en:
          conductaStatus === 'red'
            ? `High stress load or marked sleep deficit (Cortisol ${cortisol.toFixed(1)} ng/mL; sleep: ${sleepTextEn}).`
            : conductaStatus === 'amber'
              ? `Moderate stress or suboptimal rest (Cortisol ${cortisol.toFixed(1)} ng/mL; sleep: ${sleepTextEn}).`
              : `Cortisol stable (${cortisol.toFixed(1)} ng/mL) with behavioral/sleep status (${sleepTextEn}).`,
      },
      crewAction: {
        es:
          conductaStatus === 'green'
            ? 'Completar registro diario y proteger ciclo luz/oscuridad.'
            : 'Priorizar bloque de sueño recuperador, reducir carga no crítica y registrar check-in conductual.',
        en:
          conductaStatus === 'green'
            ? 'Complete daily log and protect light/dark cycle.'
            : 'Prioritize recovery sleep block, defer non-critical load, and complete behavioral check-in.',
      },
      surgeonMetrics: {
        es: `Cortisol sérico: ${cortisol.toFixed(1)} ng/mL (Alerta > 18) | Sueño registrado: ${sleepTextEs}`,
        en: `Serum cortisol: ${cortisol.toFixed(1)} ng/mL (Alert > 18) | Logged sleep: ${sleepTextEn}`,
      },
    },
  };
}

export function deriveWorstSystemStatus(
  systems: Record<PhysiologicalSystemId, DerivedSystemSnapshot>
): SystemHealthStatus {
  const vals = Object.values(systems);
  if (vals.some((s) => s.status === 'red')) return 'red';
  if (vals.some((s) => s.status === 'amber')) return 'amber';
  return 'green';
}

export function resolveActiveMissionProfile(
  slug?: MissionSlug,
  storeProfileId?: MissionProfileId | null
): MissionProfileId {
  if (slug) return MISSION_CHOICES[slug].profileId;
  return storeProfileId ?? 'MARS_CONJUNCTION';
}

/**
 * Selector único compartido por BodyMapHUD, CommandDashboard y MedicalCopilot.
 */
export function useClinicalSnapshot(misionSlug?: MissionSlug): ClinicalSnapshot {
  const telemetry = useTelemetryStore(
    useShallow((s) => ({
      heartRate: s.heartRate,
      spO2: s.spO2,
      cistatinaC: s.cistatinaC,
      creatinina: s.creatinina,
      calcioIonico: s.calcioIonico,
      linfocitos: s.linfocitos,
      neutrofilos: s.neutrofilos,
      cortisol: s.cortisol,
      co2Level: s.co2Level,
      radiationRate: s.radiationRate,
      radiationAccumulated: s.radiationAccumulated,
      isEmergency: s.isEmergency,
      isRenalWarning: s.isRenalWarning,
      isRadiationWarning: s.isRadiationWarning,
      isCo2Warning: s.isCo2Warning,
      isManualOverride: s.isManualOverride,
    }))
  );

  const { sessionSleepHours, records, storeProfileId } = useMissionStore(
    useShallow((s) => ({
      sessionSleepHours: s.session?.selfReport?.sleepHours ?? null,
      records: s.records,
      storeProfileId: s.mission?.profileId ?? null,
    }))
  );

  const biomarkers: Biomarkers = {
    heartRate: telemetry.heartRate,
    spO2: telemetry.spO2,
    cistatinaC: telemetry.cistatinaC,
    creatinina: telemetry.creatinina,
    calcioIonico: telemetry.calcioIonico,
    linfocitos: telemetry.linfocitos,
    neutrofilos: telemetry.neutrofilos,
    cortisol: telemetry.cortisol,
  };

  const environment: Environment = {
    co2Level: telemetry.co2Level,
    radiationRate: telemetry.radiationRate,
    radiationAccumulated: telemetry.radiationAccumulated,
  };

  const alerts: ClinicalAlerts = {
    isEmergency: telemetry.isEmergency,
    isRenalWarning: telemetry.isRenalWarning,
    isRadiationWarning: telemetry.isRadiationWarning,
    isCo2Warning: telemetry.isCo2Warning,
  };

  let sleepHoursRecorded: number | null = null;
  let sleepIsFromToday = false;

  if (sessionSleepHours !== null && Number.isFinite(sessionSleepHours)) {
    sleepHoursRecorded = Number(sessionSleepHours.toFixed(1));
    sleepIsFromToday = true;
  } else {
    let latestDay = -1;
    let latestSleep: number | null = null;
    for (const rec of Object.values(records)) {
      if (rec.missionDay > latestDay && rec.selfReport?.sleepHours != null) {
        latestDay = rec.missionDay;
        latestSleep = rec.selfReport.sleepHours;
      }
    }
    if (latestSleep !== null && Number.isFinite(latestSleep)) {
      sleepHoursRecorded = Number(latestSleep.toFixed(1));
    }
  }

  const missionProfileId = resolveActiveMissionProfile(misionSlug, storeProfileId);
  const comms = getMissionComms(missionProfileId);
  const systems = deriveSystemSnapshots({
    biomarkers,
    environment,
    alerts,
    sleepHoursRecorded,
  });

  return {
    biomarkers,
    environment,
    alerts,
    globalSeverity: getAlertSeverity(alerts),
    isManualOverride: telemetry.isManualOverride,
    nlr: computeNlr(biomarkers),
    cisCRatio: biomarkers.creatinina > 0 ? biomarkers.cistatinaC / biomarkers.creatinina : 0,
    sleepHoursRecorded,
    sleepIsFromToday,
    missionProfileId,
    comms,
    systems,
    worstSystemStatus: deriveWorstSystemStatus(systems),
  };
}
