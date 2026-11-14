export type SeverityLevel = 'OPTIMAL' | 'WARNING' | 'CRITICAL';

export type ScenarioName = 'Tormenta Solar' | 'Falla Filtro CO2' | 'Sarcopenia Renal' | 'Nominal';

export interface TelemetryAlerts {
  isEmergency: boolean;
  isRenalWarning: boolean;
  isRadiationWarning: boolean;
  isCo2Warning: boolean;
}

export interface TelemetryState extends TelemetryAlerts {
  // Métricas biométricas
  heartRate: number;
  spO2: number;
  cistatinaC: number;
  creatinina: number;
  calcioIonico: number;
  linfocitos: number;
  neutrofilos: number;
  cortisol: number;

  // Métricas ambientales
  co2Level: number;
  radiationRate: number;
  radiationAccumulated: number;
}

export type TelemetryMetricsInput = Partial<Omit<TelemetryState, keyof TelemetryAlerts>> &
  Partial<TelemetryAlerts>;

export interface ClinicalEvaluationResult extends TelemetryAlerts {
  nlr: number;
  severity: SeverityLevel;
}

export interface TelemetryActions {
  updateSensors: (data: Partial<TelemetryState>) => void;
  triggerCodeRed: () => void;
  simulateScenario: (scenarioName: ScenarioName) => void;
  resetTelemetry: () => void;
}

export type TelemetryStore = TelemetryState & TelemetryActions;
