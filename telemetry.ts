/** Nivel de severidad global del estado clínico del astronauta */
export type AlertSeverity = 'OPTIMAL' | 'WARNING' | 'CRITICAL';

/** Escenarios de simulación de anomalías críticas para pruebas (God Mode) */
export type SimulationScenario =
  | 'SOLAR_STORM'
  | 'CO2_LEAK'
  | 'RENAL_DAMAGE'
  | 'RESET';

/** Alias de compatibilidad para módulos existentes */
export type SeverityLevel = AlertSeverity;
export type ScenarioType = SimulationScenario;

/** Biomarcadores fisiológicos y hematológicos del astronauta */
export interface Biomarkers {
  /** Frecuencia cardíaca en latidos por minuto (BPM) */
  heartRate: number;
  /** Saturación periférica de oxígeno en porcentaje (%) */
  spO2: number;
  /** Cistatina C sérica en miligramos por litro (mg/L) — crucial para función renal en 0G */
  cistatinaC: number;
  /** Creatinina sérica en miligramos por decilitro (mg/dL) */
  creatinina: number;
  /** Calcio iónico libre en sangre en milimoles por litro (mmol/L) */
  calcioIonico: number;
  /** Recuento absoluto de linfocitos en células por microlitro (cél/µL) */
  linfocitos: number;
  /** Recuento absoluto de neutrófilos en células por microlitro (cél/µL) */
  neutrofilos: number;
  /** Nivel de cortisol sérico en nanogramos por mililitro (ng/mL) — biomarcador de estrés */
  cortisol: number;
}

/** Telemetría ambiental del hábitat / traje espacial (ECLSS) */
export interface Environment {
  /** Concentración ambiental de dióxido de carbono en partes por millón (ppm) */
  co2Level: number;
  /** Tasa de dosis de radiación ionizante actual en microsieverts por hora (µSv/h) */
  radiationRate: number;
  /** Dosis equivalente de radiación acumulada en la misión en milisieverts (mSv) */
  radiationAccumulated: number;
}

/** Banderas deterministas de alerta clínica generadas por el motor médico */
export interface ClinicalAlerts {
  /** Botón rojo de colapso o emergencia médica crítica en curso */
  isEmergency: boolean;
  /** Alerta de disfunción renal / sarcopenia / riesgo de nefrolitiasis en microgravedad */
  isRenalWarning: boolean;
  /** Alerta de inmunosupresión aguda inducida por radiación espacial (NLR elevado + linfopenia) */
  isRadiationWarning: boolean;
  /** Alerta de entorno hostil por hipercapnia local (CO2 elevado con SpO2 conservada) */
  isCo2Warning: boolean;
}

/** Contrato completo del Store Global de Telemetría (Estado + Acciones) */
export interface TelemetryState extends Biomarkers, Environment, ClinicalAlerts {
  /** Interruptor que pausa la inyección automática de SensorSimulator cuando hay un escenario manual activo */
  isManualOverride: boolean;
  /** Fusiona lecturas parciales de sensores y recalcula automáticamente las alertas clínicas */
  updateSensors: (data: Partial<Biomarkers & Environment>) => void;
  /** Activa manualmente el protocolo de emergencia crítica (isEmergency = true) */
  triggerCodeRed: () => void;
  /** Inyecta un escenario de simulación predefinido o restaura los valores nominales */
  simulateScenario: (scenario: SimulationScenario) => void;
}

/** Tipo utilitario que representa únicamente los datos clínicos puros sin métodos ni banderas internas del simulador */
export type TelemetryData = Omit<
  TelemetryState,
  'updateSensors' | 'triggerCodeRed' | 'simulateScenario' | 'isManualOverride'
> & {
  isManualOverride?: boolean;
};

/**
 * Estado inicial nominal de un astronauta sano en condiciones óptimas de misión.
 * Permite al equipo de UI maquetar componentes y gráficas sin depender de Zustand.
 */
export const mockInitialState: Omit<
  TelemetryState,
  'updateSensors' | 'triggerCodeRed' | 'simulateScenario'
> = {
  // Biomarkers
  heartRate: 72, // BPM
  spO2: 99, // %
  cistatinaC: 0.8, // mg/L
  creatinina: 1.1, // mg/dL
  calcioIonico: 1.1, // mmol/L
  linfocitos: 1500, // cél/µL
  neutrofilos: 3000, // cél/µL
  cortisol: 10, // ng/mL

  // Environment
  co2Level: 600, // ppm
  radiationRate: 15.5, // µSv/h
  radiationAccumulated: 45, // mSv

  // ClinicalAlerts
  isEmergency: false,
  isRenalWarning: false,
  isRadiationWarning: false,
  isCo2Warning: false,

  // Control de Simulación
  isManualOverride: false,
};

/** Alias en UPPER_SNAKE_CASE para importación estándar de constantes */
export const MOCK_INITIAL_STATE = mockInitialState;
