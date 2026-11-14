import {
  ClinicalEvaluationResult,
  SeverityLevel,
  TelemetryState,
} from '@/types/telemetry';

const CLINICAL_THRESHOLDS = {
  RENAL: {
    CISTATINA_C_MAX: 1.15,
    CALCIO_IONICO_MAX: 1.32,
  },
  RADIATION: {
    NLR_MAX: 3.5,
    ACCUMULATED_MAX: 50,
  },
  CO2: {
    LEVEL_MAX: 3500,
    SPO2_MIN_FOR_MASKED_HYPERCAPNIA: 96,
  },
} as const;

/**
 * Calcula el índice Neutrófilos / Linfocitos (NLR) de forma segura.
 */
export const calculateNLR = (neutrofilos: number, linfocitos: number): number => {
  if (linfocitos <= 0) {
    return 0;
  }
  return Number((neutrofilos / linfocitos).toFixed(2));
};

/**
 * Determina el nivel global de severidad clínica en base a las alertas activas.
 */
export const resolveSeverity = (
  alerts: Pick<
    TelemetryState,
    'isEmergency' | 'isRenalWarning' | 'isRadiationWarning' | 'isCo2Warning'
  >
): SeverityLevel => {
  const { isEmergency, isRenalWarning, isRadiationWarning, isCo2Warning } = alerts;

  const activeWarningsCount = [
    isRenalWarning,
    isRadiationWarning,
    isCo2Warning,
  ].filter(Boolean).length;

  if (isEmergency || activeWarningsCount >= 2) {
    return 'CRITICAL';
  }

  if (activeWarningsCount === 1) {
    return 'WARNING';
  }

  return 'OPTIMAL';
};

/**
 * Motor clínico determinista Edge-First.
 * Evalúa las métricas biométricas y ambientales de acuerdo con protocolos médicos espaciales.
 */
export const evaluateTelemetry = (
  data: Partial<TelemetryState>
): ClinicalEvaluationResult => {
  const {
    cistatinaC = 0,
    calcioIonico = 0,
    neutrofilos = 0,
    linfocitos = 1,
    radiationAccumulated = 0,
    co2Level = 0,
    spO2 = 0,
    isEmergency = false,
  } = data;

  // 1. Regla Renal (Sarcopenia / Nefrolitiasis por Microgravedad)
  const isRenalWarning =
    cistatinaC > CLINICAL_THRESHOLDS.RENAL.CISTATINA_C_MAX &&
    calcioIonico > CLINICAL_THRESHOLDS.RENAL.CALCIO_IONICO_MAX;

  // 2. Regla Radiación (Inmunosupresión inducida por radiación espacial)
  const nlr = calculateNLR(neutrofilos, linfocitos);
  const isRadiationWarning =
    nlr > CLINICAL_THRESHOLDS.RADIATION.NLR_MAX &&
    radiationAccumulated > CLINICAL_THRESHOLDS.RADIATION.ACCUMULATED_MAX;

  // 3. Regla CO2 (Entorno Hostil / Hipercapnia silenciosa con SpO2 normal)
  const isCo2Warning =
    co2Level > CLINICAL_THRESHOLDS.CO2.LEVEL_MAX &&
    spO2 >= CLINICAL_THRESHOLDS.CO2.SPO2_MIN_FOR_MASKED_HYPERCAPNIA;

  const severity = resolveSeverity({
    isEmergency,
    isRenalWarning,
    isRadiationWarning,
    isCo2Warning,
  });

  return {
    isEmergency,
    isRenalWarning,
    isRadiationWarning,
    isCo2Warning,
    nlr,
    severity,
  };
};
