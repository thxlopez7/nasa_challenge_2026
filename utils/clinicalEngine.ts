import { Biomarkers, ClinicalAlerts, Environment } from '../types/telemetry';

/**
 * Motor Clínico Determinista Edge-First (Protocolos Médicos Espaciales NASA).
 * Función pura que evalúa biomarcadores y variables ambientales para detectar:
 * 1. Sarcopenia / Nefrolitiasis por Gravedad Alterada (Renal)
 * 2. Inmunosupresión inducida por Radiación Espacial (NLR + Linfopenia)
 * 3. Hipercapnia silenciosa en Entorno Hostil (CO2 elevado con SpO2 conservada)
 */
export function evaluateTelemetry(
  bio: Biomarkers,
  env: Environment
): Omit<ClinicalAlerts, 'isEmergency'> {
  const safeCreatinina = bio.creatinina > 0 ? bio.creatinina : 0.01;
  const safeLinfocitos = bio.linfocitos > 0 ? bio.linfocitos : 1;

  // 1. Gravedad Alterada (Renal)
  const isRenalWarning =
    (bio.cistatinaC > 1.15 && bio.cistatinaC / safeCreatinina > 1.2) ||
    bio.calcioIonico > 1.32;

  // 2. Radiación (Inmunosupresión)
  const nlr = bio.neutrofilos / safeLinfocitos;
  const isRadiationWarning =
    nlr > 3.5 && bio.linfocitos < 1200 && env.radiationAccumulated > 50;

  // 3. Entorno Hostil (CO2)
  const isCo2Warning = env.co2Level > 3500 && bio.spO2 >= 96;

  return {
    isRenalWarning,
    isRadiationWarning,
    isCo2Warning,
  };
}
