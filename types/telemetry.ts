/**
 * Contrato único de datos clínicos y telemetría de ExoVitals.
 * Todos los stores, motores, simuladores y componentes deben importar de aquí.
 */

export type AlertSeverity = 'OPTIMAL' | 'WARNING' | 'CRITICAL';

export type SimulationScenario =
  | 'SOLAR_STORM'
  | 'CO2_LEAK'
  | 'RENAL_DAMAGE'
  | 'RESET';

/** Alias legado mantenido para retrocompatibilidad */
export type ScenarioType = SimulationScenario;

export type MeasurementSource = 'sensor' | 'manual';

export type GlucoseContext = 'fasting' | 'postprandial';

export type EscalationLevel =
  | 'self-manage'
  | 'notify-flight-surgeon'
  | 'emergency';

export type TrackedIndicatorKey =
  | 'bp'
  | 'glucose'
  | 'temp'
  | 'vitals'
  | 'bloodPanel'
  | 'radiation'
  | 'behavioral';

export interface IndicatorMeta {
  measuredAt: string;
  source: MeasurementSource;
}

export interface BehavioralCheckInData {
  /** 1 = muy bajo · 5 = excelente */
  mood: number;
  /** 1 = muy mala · 5 = reparadora */
  sleepQuality: number;
  /** 1 = descansado · 5 = agotado */
  fatigue: number;
  /** 1 = calma · 5 = estrés máximo */
  stress: number;
  /** 1 = ligera · 5 = sobrecarga */
  workload: number;
  /** 1 = aislado · 5 = conectado */
  socialContact: number;
  /** PHQ-2 ítem 1 (0–3): poco interés o placer */
  phq2Anhedonia: 0 | 1 | 2 | 3;
  /** PHQ-2 ítem 2 (0–3): decaimiento o desesperanza */
  phq2Dysphoria: 0 | 1 | 2 | 3;
  /** Bandera de seguridad (pensamientos de autolesión) — activa escalamiento inmediato */
  selfHarmFlag: boolean;
  /** Índice compuesto 0–100 calculado determinísticamente */
  behavioralRiskIndex: number;
  /** Opt-in explícito para compartir este check-in con el asistente de IA */
  sharePsychWithAi: boolean;
  /** Marca temporal ISO de la última actualización */
  updatedAt: string;
}

/** Variables biométricas del tripulante (núcleo + captura manual P2) */
export interface Biomarkers {
  /** Frecuencia cardíaca en latidos por minuto (BPM) */
  heartRate: number;
  /** Saturación arterial de oxígeno (%) */
  spO2: number;
  /** Cistatina C sérica (mg/L) — marcador de filtrado glomerular menos dependiente de masa muscular */
  cistatinaC: number;
  /** Creatinina sérica (mg/dL) — disminuye en atrofia muscular por microgravedad */
  creatinina: number;
  /** Calcio iónico sérico (mmol/L) — se eleva por resorción ósea en 0G */
  calcioIonico: number;
  /** Linfocitos totales (células/µL) */
  linfocitos: number;
  /** Neutrófilos totales (células/µL) */
  neutrofilos: number;
  /** Cortisol sérico/salival (ng/mL) — indicador de estrés */
  cortisol: number;

  // --- Indicadores adicionales P2 (opcionales para retrocompatibilidad con streams 11-key) ---
  /** Presión arterial sistólica (mmHg) */
  systolicMmHg?: number;
  /** Presión arterial diastólica (mmHg) */
  diastolicMmHg?: number;
  /** Glucosa capilar (mg/dL) */
  glucoseMgDl?: number;
  /** Contexto metabólico de la glucosa capilar */
  glucoseContext?: GlucoseContext;
  /** Temperatura corporal central/timpánica (°C) */
  bodyTempC?: number;
}

/** Variables ambientales del módulo presurizado / traje EVA */
export interface Environment {
  /** Nivel ambiental de CO2 en cabina (ppm) */
  co2Level: number;
  /** Tasa instantánea de radiación ionizante (µSv/h) */
  radiationRate: number;
  /** Dosis acumulada de radiación ionizante en misión (mSv) */
  radiationAccumulated: number;
}

/** Banderas booleanas de alerta clínica evaluadas en cada tick o ingesta manual */
export interface ClinicalAlerts {
  /** Paro o emergencia crítica activada manualmente o por crisis vital/conductual */
  isEmergency: boolean;
  /** Alerta de nefropatía oculta e hipercalcemia */
  isRenalWarning: boolean;
  /** Alerta de inmunosupresión por radiación espacial (NLR elevado + linfopenia) */
  isRadiationWarning: boolean;
  /** Alerta de entorno hostil por acumulación de CO2 con SpO2 conservada */
  isCo2Warning: boolean;
}

export interface ManualVitalsPatch {
  systolicMmHg?: number;
  diastolicMmHg?: number;
  glucoseMgDl?: number;
  glucoseContext?: GlucoseContext;
  bodyTempC?: number;
  heartRate?: number;
  spO2?: number;
  measuredAt?: string;
}

export interface BehavioralCheckInInput {
  mood: number;
  sleepQuality: number;
  fatigue: number;
  stress: number;
  workload: number;
  socialContact: number;
  phq2Anhedonia: 0 | 1 | 2 | 3;
  phq2Dysphoria: 0 | 1 | 2 | 3;
  selfHarmFlag: boolean;
  sharePsychWithAi: boolean;
  updatedAt?: string;
}

/** Contrato completo del Store Global de Telemetría (Estado + Acciones) */
export interface TelemetryState extends Biomarkers, Environment, ClinicalAlerts {
  /** Interruptor que pausa la inyección automática de SensorSimulator */
  isManualOverride: boolean;
  /** Marca temporal ISO del último dato recibido */
  measuredAt?: string;
  /** Origen principal del último lote vital */
  source?: MeasurementSource;
  /** Metadatos de frescura y origen por grupo de indicadores */
  indicatorMeta?: Partial<Record<TrackedIndicatorKey, IndicatorMeta>>;
  /** Registro conductual diario del astronauta */
  behavioralCheckIn?: BehavioralCheckInData;
  /** Opt-in explícito de privacidad psicológica hacia IA */
  sharePsychWithAi?: boolean;
  /** Nivel de escalamiento recomendado para el tripulante */
  escalationLevel?: EscalationLevel;

  /** Fusiona lecturas parciales de sensores y recalcula alertas clínicas */
  updateSensors: (data: Partial<Biomarkers & Environment>) => void;
  /** Registra signos vitales manuales validados con marca temporal y origen manual */
  logManualVitals: (patch: ManualVitalsPatch) => void;
  /** Registra check-in conductual y PHQ-2, recalculando índice de riesgo y escalamiento */
  submitBehavioralCheckIn: (input: BehavioralCheckInInput) => void;
  /** Cambia la autorización de compartir datos conductuales con IA */
  setSharePsychWithAi: (share: boolean) => void;
  /** Activa manualmente el protocolo de emergencia crítica */
  triggerCodeRed: () => void;
  /** Inyecta un escenario de simulación predefinido o restaura los valores nominales */
  simulateScenario: (scenario: SimulationScenario) => void;
}

/** Datos clínicos puros sin métodos ni banderas internas del simulador */
export type TelemetryData = Omit<
  TelemetryState,
  | 'updateSensors'
  | 'logManualVitals'
  | 'submitBehavioralCheckIn'
  | 'setSharePsychWithAi'
  | 'triggerCodeRed'
  | 'simulateScenario'
  | 'isManualOverride'
> & {
  isManualOverride?: boolean;
};

/**
 * Estado inicial nominal determinístico (sin marcas temporales dinámicas en SSR
 * para evitar hydration mismatch).
 */
export const mockInitialState: Omit<
  TelemetryState,
  | 'updateSensors'
  | 'logManualVitals'
  | 'submitBehavioralCheckIn'
  | 'setSharePsychWithAi'
  | 'triggerCodeRed'
  | 'simulateScenario'
> = {
  // Biomarkers
  heartRate: 72,
  spO2: 99,
  cistatinaC: 0.8,
  creatinina: 1.1,
  calcioIonico: 1.1,
  linfocitos: 1500,
  neutrofilos: 3000,
  cortisol: 10,
  systolicMmHg: 118,
  diastolicMmHg: 76,
  glucoseMgDl: 92,
  glucoseContext: 'fasting',
  bodyTempC: 36.7,

  // Environment
  co2Level: 600,
  radiationRate: 15.5,
  radiationAccumulated: 45,

  // ClinicalAlerts
  isEmergency: false,
  isRenalWarning: false,
  isRadiationWarning: false,
  isCo2Warning: false,

  // Metadatos y escalamiento (determinísticos para SSR)
  isManualOverride: false,
  source: 'sensor',
  sharePsychWithAi: false,
  escalationLevel: 'self-manage',
  indicatorMeta: {},
};

export const MOCK_INITIAL_STATE = mockInitialState;
