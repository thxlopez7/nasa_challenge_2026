export type ScenarioType = 'SOLAR_STORM' | 'CO2_LEAK' | 'RENAL_DAMAGE' | 'RESET';

export type SeverityLevel = 'OPTIMAL' | 'WARNING' | 'CRITICAL';

export interface Biomarkers {
  heartRate: number;
  spO2: number;
  cistatinaC: number;
  creatinina: number;
  calcioIonico: number;
  linfocitos: number;
  neutrofilos: number;
  cortisol: number;
}

export interface Environment {
  co2Level: number;
  radiationRate: number;
  radiationAccumulated: number;
}

export interface ClinicalAlerts {
  isEmergency: boolean;
  isRenalWarning: boolean;
  isRadiationWarning: boolean;
  isCo2Warning: boolean;
}

export interface TelemetryState extends Biomarkers, Environment, ClinicalAlerts {
  updateSensors: (data: Partial<Biomarkers & Environment>) => void;
  triggerCodeRed: () => void;
  simulateScenario: (scenario: ScenarioType) => void;
}
