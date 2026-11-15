import type {
  BehavioralCheckInData,
  Biomarkers,
  ClinicalAlerts,
  EscalationLevel,
} from '../types/telemetry';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Calcula un índice de riesgo conductual determinístico 0–100 a partir de 6 escalas (1–5),
 * PHQ-2 (0–6) y bandera de seguridad.
 */
export function computeBehavioralRiskIndex(input: {
  mood: number;
  sleepQuality: number;
  fatigue: number;
  stress: number;
  workload: number;
  socialContact: number;
  phq2Anhedonia: 0 | 1 | 2 | 3;
  phq2Dysphoria: 0 | 1 | 2 | 3;
  selfHarmFlag: boolean;
}): number {
  if (input.selfHarmFlag) return 100;

  // Escalas invertidas donde 5 es positivo (ánimo, sueño, contacto)
  const moodBurden = (5 - clamp(input.mood, 1, 5)) / 4;
  const sleepBurden = (5 - clamp(input.sleepQuality, 1, 5)) / 4;
  const socialBurden = (5 - clamp(input.socialContact, 1, 5)) / 4;

  // Escalas directas donde 5 es mayor carga (fatiga, estrés, carga de trabajo)
  const fatigueBurden = (clamp(input.fatigue, 1, 5) - 1) / 4;
  const stressBurden = (clamp(input.stress, 1, 5) - 1) / 4;
  const workloadBurden = (clamp(input.workload, 1, 5) - 1) / 4;

  const phq2Sum = clamp(input.phq2Anhedonia, 0, 3) + clamp(input.phq2Dysphoria, 0, 3);
  const phq2Weight = phq2Sum / 6;

  const weighted =
    moodBurden * 0.14 +
    sleepBurden * 0.16 +
    fatigueBurden * 0.14 +
    stressBurden * 0.16 +
    workloadBurden * 0.1 +
    socialBurden * 0.1 +
    phq2Weight * 0.2;

  return Math.round(clamp(weighted * 100, 0, 100));
}

/**
 * Deriva el nivel de escalamiento operativo:
 *   self-manage | notify-flight-surgeon | emergency
 */
export function deriveEscalationLevel(input: {
  alerts: ClinicalAlerts;
  biomarkers: Biomarkers;
  behavioralCheckIn?: BehavioralCheckInData;
}): EscalationLevel {
  const { alerts, biomarkers, behavioralCheckIn } = input;

  if (alerts.isEmergency || behavioralCheckIn?.selfHarmFlag) {
    return 'emergency';
  }

  const spO2 = biomarkers.spO2;
  const sys = biomarkers.systolicMmHg;
  const dia = biomarkers.diastolicMmHg;
  const temp = biomarkers.bodyTempC;
  const glu = biomarkers.glucoseMgDl;

  const criticalVital =
    (Number.isFinite(spO2) && spO2 < 90) ||
    (sys !== undefined && Number.isFinite(sys) && (sys >= 180 || sys < 80)) ||
    (dia !== undefined && Number.isFinite(dia) && dia >= 115) ||
    (temp !== undefined && Number.isFinite(temp) && (temp >= 39.5 || temp <= 34.5)) ||
    (glu !== undefined && Number.isFinite(glu) && (glu < 54 || glu >= 300));

  if (criticalVital) {
    return 'emergency';
  }

  const phq2Total = behavioralCheckIn
    ? behavioralCheckIn.phq2Anhedonia + behavioralCheckIn.phq2Dysphoria
    : 0;

  const moderateVital =
    (sys !== undefined && Number.isFinite(sys) && (sys >= 140 || sys < 90)) ||
    (dia !== undefined && Number.isFinite(dia) && dia >= 90) ||
    (temp !== undefined && Number.isFinite(temp) && (temp >= 38.0 || temp < 35.5)) ||
    (glu !== undefined &&
      Number.isFinite(glu) &&
      (glu < 70 ||
        (biomarkers.glucoseContext === 'postprandial' ? glu >= 200 : glu >= 126)));

  if (
    alerts.isRenalWarning ||
    alerts.isRadiationWarning ||
    alerts.isCo2Warning ||
    moderateVital ||
    phq2Total >= 3 ||
    (behavioralCheckIn !== undefined && behavioralCheckIn.behavioralRiskIndex >= 65)
  ) {
    return 'notify-flight-surgeon';
  }

  return 'self-manage';
}
