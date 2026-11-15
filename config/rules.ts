import type {
  Biomarkers,
  BehavioralCheckInData,
  ClinicalAlerts,
  Environment,
  EscalationLevel,
} from '../types/telemetry';

export const RULES_VERSION = '1.3.0-proto' as const;

export type RuleId =
  | 'R1_HIDDEN_NEPHROPATHY'
  | 'R2_RADIATION_IMMUNOSUPPRESSION'
  | 'R3_CO2_SUBCLINICAL'
  | 'R4_CODE_RED_EMERGENCY'
  | 'R5_BLOOD_PRESSURE'
  | 'R6_DYSGLYCEMIA'
  | 'R7_THERMAL_ANOMALY'
  | 'R8_BEHAVIORAL_RISK';

export type RuleSystem =
  | 'renal'
  | 'radiation'
  | 'environment'
  | 'emergency'
  | 'cardiovascular'
  | 'metabolic'
  | 'behavioral';

export type RuleSeverity = 'OPTIMAL' | 'WARNING' | 'CRITICAL';

export type ComparisonOperator = '>' | '>=' | '<' | '<=' | '==';

export interface LocalizedText {
  es: string;
  en: string;
}

export interface RuleEvaluationInput extends Biomarkers, Environment {
  isEmergency?: boolean;
  behavioralCheckIn?: BehavioralCheckInData;
}

export interface RuleCriterionDefinition {
  id: string;
  label: LocalizedText;
  /** 'all' obliga a que el criterio pase; criterios con mismo 'or:<nombre>' forman una disyunción (al menos uno). */
  group: 'all' | `or:${string}`;
  operator: ComparisonOperator;
  unit: string;
  decimals?: number;
  allowInfinity?: boolean;
  /** Extrae el valor numérico observable; `undefined` o inválido se marca como dato faltante (`missing: true`). */
  extract: (input: RuleEvaluationInput) => number | undefined;
  /** Umbral numérico o dependiente de contexto (ej. glucosa en ayunas vs postprandial). */
  threshold: number | ((input: RuleEvaluationInput) => number);
  thresholdNote?: (input: RuleEvaluationInput) => LocalizedText | undefined;
}

export interface ClinicalRuleDefinition {
  id: RuleId;
  shortCode: string;
  version: string;
  system: RuleSystem;
  severity: Exclude<RuleSeverity, 'OPTIMAL'>;
  escalation: EscalationLevel;
  title: LocalizedText;
  summary: LocalizedText;
  rationale: LocalizedText;
  limitations: LocalizedText;
  actionSummary: LocalizedText;
  source: string;
  verified: boolean;
  verificationTodo?: string;
  criteria: RuleCriterionDefinition[];
}

export interface CriterionTrace {
  id: string;
  label: LocalizedText;
  group: 'all' | `or:${string}`;
  operator: ComparisonOperator;
  threshold: number;
  thresholdNote?: LocalizedText;
  actualValue: number | null;
  unit: string;
  decimals: number;
  passed: boolean;
  missing: boolean;
}

export interface RuleEvaluationTrace {
  ruleId: RuleId;
  shortCode: string;
  version: string;
  system: RuleSystem;
  severity: RuleSeverity;
  configuredSeverity: Exclude<RuleSeverity, 'OPTIMAL'>;
  escalation: EscalationLevel;
  triggered: boolean;
  hasMissingInputs: boolean;
  title: LocalizedText;
  summary: LocalizedText;
  rationale: LocalizedText;
  limitations: LocalizedText;
  actionSummary: LocalizedText;
  source: string;
  verified: boolean;
  verificationTodo?: string;
  criteria: CriterionTrace[];
}

/**
 * Fuente única de verdad de umbrales clínicos del prototipo ExoVitals.
 */
export const CLINICAL_RULE_THRESHOLDS = {
  renal: {
    maxCreatinina: 1.1,
    minCistatinaC: 1.15,
    minCalcioIonico: 1.25,
    minCisCrRatio: 1.2,
  },
  radiation: {
    minRadiationRate: 50.0,
    minRadiationAccumulated: 50.0,
    maxLinfocitos: 1000,
    minNlr: 3.0,
  },
  co2: {
    minCo2Level: 3500,
    minSpO2: 96,
  },
  emergency: {
    minCriticalSpO2: 90,
  },
  bp: {
    hypertensionSys: 140,
    hypertensionDia: 90,
    hypotensionSys: 90,
  },
  glucose: {
    hypo: 70,
    fastingHigh: 126,
    postprandialHigh: 200,
  },
  temp: {
    fever: 38.0,
    hypothermia: 35.5,
  },
  behavioral: {
    phq2ScreenPositive: 3,
    highRiskIndex: 55,
  },
} as const;

const isValidNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isValidPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

function extractCisCrRatio(input: RuleEvaluationInput): number | undefined {
  if (!isValidNonNegative(input.cistatinaC) || !isValidPositive(input.creatinina)) {
    return undefined;
  }
  return input.cistatinaC / input.creatinina;
}

function extractNlr(input: RuleEvaluationInput): number | undefined {
  if (!isValidNonNegative(input.neutrofilos) || !isValidNonNegative(input.linfocitos)) {
    return undefined;
  }
  const nlr = input.neutrofilos / input.linfocitos;
  return Number.isNaN(nlr) ? undefined : nlr;
}

export const CLINICAL_RULES: readonly ClinicalRuleDefinition[] = [
  {
    id: 'R1_HIDDEN_NEPHROPATHY',
    shortCode: 'R1',
    version: RULES_VERSION,
    system: 'renal',
    severity: 'WARNING',
    escalation: 'notify-flight-surgeon',
    title: {
      es: 'Riesgo renal oculto y resorción mineral (G · Gravedad)',
      en: 'Occult Renal Stress & Bone Resorption (G · Gravity)',
    },
    summary: {
      es: 'Cistatina C > 1,15 mg/L + Ca²⁺ > 1,25 mmol/L con creatinina ≤ 1,10 mg/dL o razón cistatina C / creatinina > 1,20.',
      en: 'Cystatin C > 1.15 mg/L + Ca²⁺ > 1.25 mmol/L with creatinine ≤ 1.10 mg/dL or cystatin C / creatinine ratio > 1.20.',
    },
    rationale: {
      es: 'En microgravedad prolongada la pérdida de masa muscular reduce la generación basal de creatinina y puede enmascarar caídas tempranas del filtrado glomerular. La Cistatina C es mucho menos dependiente de la masa muscular; evaluarla junto con el calcio iónico (movilizado por resorción ósea) y la razón cistatina C / creatinina (indicador de disociación) permite detectar tensión renal y riesgo litogénico de forma más temprana.',
      en: 'In prolonged microgravity, muscle atrophy lowers baseline creatinine production and can mask early GFR decline. Cystatin C is far less dependent on muscle mass; pairing it with ionized calcium (mobilized by bone resorption) and the cystatin C / creatinine ratio (dissociation indicator) helps flag occult renal strain and stone risk earlier.',
    },
    limitations: {
      es: 'Limitaciones y diagnóstico diferencial: no es diagnóstico definitivo de lesión renal aguda. La Cistatina C puede elevarse por uso de corticosteroides sistémicos, disfunción tiroidea, inflamación aguda o deshidratación/hemoconcentración; la razón Cistatina C / Creatinina divide mg/L entre mg/dL como indicador empírico del prototipo. Requiere correlación clínica, balance hídrico y tendencia longitudinal.',
      en: 'Limitations & differential diagnosis: not a standalone AKI diagnosis. Cystatin C can shift with systemic corticosteroids, thyroid dysfunction, acute inflammation, or dehydration/hemoconcentration; the Cystatin C / Creatinine ratio compares mg/L against mg/dL as a prototype empirical dissociation flag. Requires clinical review, hydration assessment, and serial trends.',
    },
    actionSummary: {
      es: 'Asegurar hidratación ≥ 2,5 L/día, revisar balance de electrolitos/calcio, evitar suplementos no indicados y programar consulta con el Cirujano de Vuelo.',
      en: 'Maintain hydration ≥ 2.5 L/day, review calcium/electrolyte intake, avoid unprescribed supplements, and notify the Flight Surgeon.',
    },
    source:
      'NASA HRP Renal Stone Risk & Muscle Atrophy Evidence Reports; KDIGO CKD/Cystatin C guidelines (umbral compuesto de prototipo)',
    verified: false,
    verificationTodo: 'TODO: verify spaceflight Cystatin C + Ca²⁺ compound cutoffs against NASA HRP standards',
    criteria: [
      {
        id: 'r1-cystatin-c',
        label: { es: 'Cistatina C sérica', en: 'Serum Cystatin C' },
        group: 'all',
        operator: '>',
        threshold: CLINICAL_RULE_THRESHOLDS.renal.minCistatinaC,
        unit: 'mg/L',
        decimals: 2,
        extract: (input) =>
          isValidNonNegative(input.cistatinaC) && isValidPositive(input.creatinina)
            ? input.cistatinaC
            : undefined,
      },
      {
        id: 'r1-ionized-ca',
        label: { es: 'Calcio iónico sérico (Ca²⁺)', en: 'Serum Ionized Calcium (Ca²⁺)' },
        group: 'all',
        operator: '>',
        threshold: CLINICAL_RULE_THRESHOLDS.renal.minCalcioIonico,
        unit: 'mmol/L',
        decimals: 2,
        extract: (input) =>
          isValidNonNegative(input.calcioIonico) && isValidPositive(input.creatinina)
            ? input.calcioIonico
            : undefined,
      },
      {
        id: 'r1-creatinine-masked',
        label: {
          es: 'Creatinina normal/baja (posible enmascaramiento)',
          en: 'Normal/low Creatinine (potential masking)',
        },
        group: 'or:renal-dissociation',
        operator: '<=',
        threshold: CLINICAL_RULE_THRESHOLDS.renal.maxCreatinina,
        unit: 'mg/dL',
        decimals: 2,
        extract: (input) => (isValidPositive(input.creatinina) ? input.creatinina : undefined),
      },
      {
        id: 'r1-cis-cr-ratio',
        label: {
          es: 'Razón cistatina C / creatinina (indicador de disociación)',
          en: 'Cystatin C / creatinine ratio (dissociation indicator)',
        },
        group: 'or:renal-dissociation',
        operator: '>',
        threshold: CLINICAL_RULE_THRESHOLDS.renal.minCisCrRatio,
        unit: 'ratio',
        decimals: 2,
        extract: extractCisCrRatio,
      },
    ],
  },
  {
    id: 'R2_RADIATION_IMMUNOSUPPRESSION',
    shortCode: 'R2',
    version: RULES_VERSION,
    system: 'radiation',
    severity: 'WARNING',
    escalation: 'notify-flight-surgeon',
    title: {
      es: 'Inmunosupresión por radiación espacial (R · Radiación)',
      en: 'Space Radiation Immunosuppression (R · Radiation)',
    },
    summary: {
      es: '(Tasa > 50 µSv/h o Dosis acumulada > 50 mSv) + Linfocitos < 1000 cél/µL + NLR > 3,0.',
      en: '(Rate > 50 µSv/h or Cumulative > 50 mSv) + Lymphocytes < 1000 cells/µL + NLR > 3.0.',
    },
    rationale: {
      es: 'Los linfocitos son altamente radiosensibles frente a eventos de partículas solares (SPE) y radiación cósmica galáctica (GCR). La combinación de dosimetría elevada, linfopenia (< 1000/µL) y aumento de la razón neutrófilos/linfocitos (NLR) sugiere respuesta de estrés actínico y potencial vulnerabilidad inmune.',
      en: 'Lymphocytes are highly radiosensitive to solar particle events (SPE) and galactic cosmic rays (GCR). Elevated dosimetry paired with lymphopenia (< 1000/µL) and rising neutrophil-to-lymphocyte ratio (NLR) signals potential immune strain.',
    },
    limitations: {
      es: 'Limitaciones y diagnóstico diferencial: el NLR y la linfocitopenia relativa son inespecíficos y también cambian por estrés agudo/hipercortisolemia, privación del sueño, ejercicio intenso, variación circadiana o infecciones virales/bacterianas intercurrentes. Debe interpretarse junto con el dosímetro activo y clínica infecciosa.',
      en: 'Limitations & differential diagnosis: NLR and relative lymphopenia are non-specific and also shift with acute stress/cortisol surges, sleep loss, strenuous exercise, circadian rhythm, or intercurrent viral/bacterial infections. Always interpret alongside active dosimetry and symptoms.',
    },
    actionSummary: {
      es: 'Resguardarse en zona de mayor blindaje durante tormenta solar, suspender EVA y repetir hemograma de confirmación notificando al Cirujano de Vuelo.',
      en: 'Relocate to shielded storm shelter during SPE, hold EVA operations, repeat blood count confirmation, and notify Flight Surgeon.',
    },
    source: 'NASA-STD-3001 Vol. 1 Radiation Limits + Hematology Biodosimetry heuristics (prototipo)',
    verified: false,
    verificationTodo: 'TODO: verify acute SPE lymphocyte + NLR operational alert cutoffs against NASA-STD-3001',
    criteria: [
      {
        id: 'r2-rad-rate',
        label: { es: 'Tasa de radiación instantánea', en: 'Instantaneous Radiation Rate' },
        group: 'or:radiation-exposure',
        operator: '>',
        threshold: CLINICAL_RULE_THRESHOLDS.radiation.minRadiationRate,
        unit: 'µSv/h',
        decimals: 1,
        extract: (input) =>
          isValidNonNegative(input.radiationRate) &&
          isValidNonNegative(input.radiationAccumulated) &&
          isValidNonNegative(input.linfocitos) &&
          isValidNonNegative(input.neutrofilos)
            ? input.radiationRate
            : undefined,
      },
      {
        id: 'r2-rad-acc',
        label: { es: 'Dosis acumulada en misión', en: 'Mission Cumulative Dose' },
        group: 'or:radiation-exposure',
        operator: '>',
        threshold: CLINICAL_RULE_THRESHOLDS.radiation.minRadiationAccumulated,
        unit: 'mSv',
        decimals: 1,
        extract: (input) =>
          isValidNonNegative(input.radiationRate) &&
          isValidNonNegative(input.radiationAccumulated) &&
          isValidNonNegative(input.linfocitos) &&
          isValidNonNegative(input.neutrofilos)
            ? input.radiationAccumulated
            : undefined,
      },
      {
        id: 'r2-lymphocytes',
        label: { es: 'Recuento de linfocitos', en: 'Lymphocyte Count' },
        group: 'all',
        operator: '<',
        threshold: CLINICAL_RULE_THRESHOLDS.radiation.maxLinfocitos,
        unit: 'cél/µL',
        decimals: 0,
        extract: (input) =>
          isValidNonNegative(input.radiationRate) &&
          isValidNonNegative(input.radiationAccumulated) &&
          isValidNonNegative(input.linfocitos) &&
          isValidNonNegative(input.neutrofilos)
            ? input.linfocitos
            : undefined,
      },
      {
        id: 'r2-nlr',
        label: { es: 'Razón neutrófilos / linfocitos (NLR)', en: 'Neutrophil / Lymphocyte Ratio (NLR)' },
        group: 'all',
        operator: '>',
        threshold: CLINICAL_RULE_THRESHOLDS.radiation.minNlr,
        unit: 'NLR',
        decimals: 2,
        allowInfinity: true,
        extract: (input) =>
          isValidNonNegative(input.radiationRate) &&
          isValidNonNegative(input.radiationAccumulated) &&
          isValidNonNegative(input.linfocitos) &&
          isValidNonNegative(input.neutrofilos)
            ? extractNlr(input)
            : undefined,
      },
    ],
  },
  {
    id: 'R3_CO2_SUBCLINICAL',
    shortCode: 'R3',
    version: RULES_VERSION,
    system: 'environment',
    severity: 'WARNING',
    escalation: 'notify-flight-surgeon',
    title: {
      es: 'Bolsa de CO₂ e hipercapnia temprana (E · Entorno hostil)',
      en: 'CO₂ Pocket & Early Hypercapnia (E · Hostile Env.)',
    },
    summary: {
      es: 'CO₂ cabina > 3500 ppm (umbral de alerta temprana del prototipo, inferior a límites operativos NASA de 4–5,3 mmHg) con SpO₂ ≥ 96%.',
      en: 'Cabin CO₂ > 3500 ppm (prototype early-warning threshold, below NASA operational limits of 4–5.3 mmHg) with SpO₂ ≥ 96%.',
    },
    rationale: {
      es: 'En ausencia de convección natural en 0 g pueden formarse bolsas locales de CO₂ alrededor del tripulante, causando cefalea o deterioro cognitivo sutil mucho antes de que caiga la SpO₂ en el pulsioxímetro. A 1 atm (101,3 kPa), 3500 ppm equivalen a ~2,66 mmHg de ppCO₂: este valor actúa como umbral conservador de alerta temprana del prototipo (inferior a límites operativos NASA de 4–5,3 mmHg / ~5.260–7.000 ppm).',
      en: 'Without buoyancy-driven convection in 0 g, stagnant CO₂ pockets can impair cognition and provoke headache well before arterial SpO₂ drops. At 1 atm (101.3 kPa), 3500 ppm corresponds to ~2.66 mmHg ppCO₂: this serves as a prototype early-warning threshold (below NASA operational limits of 4–5.3 mmHg / ~5,260–7,000 ppm).',
    },
    limitations: {
      es: 'Limitaciones: los sensores de cabina expresados en ppm deben convertirse según presión barométrica total del hábitat (trajes o hábitats hipobáricos modifican la fracción molar equivalente). La hipercapnia no se descarta por SpO₂ normal; confirme ventilación local y depuradores ECLSS.',
      en: 'Limitations: cabin readings reported in ppm depend on total barometric pressure (hypobaric habitats alter ppm-to-mmHg equivalence). Normal SpO₂ does not exclude hypercapnia; inspect local airflow fans and ECLSS scrubbers.',
    },
    actionSummary: {
      es: 'Activar ventilación de mezcla en el compartimento, desplazarse a zona ventilada, inspeccionar cartuchos depuradores de CO₂ y confirmar síntomas.',
      en: 'Boost compartment mixing fans, move to a ventilated zone, inspect CO₂ sorbent cartridges, and recheck symptoms.',
    },
    source: 'NASA-STD-3001 Vol. 2 Cabin Atmosphere CO₂ limits (~4–5.3 mmHg acute vs prototype 3500 ppm early-warning)',
    verified: true,
    criteria: [
      {
        id: 'r3-co2',
        label: {
          es: 'CO₂ ambiental de cabina (~2,66 mmHg a 1 atm)',
          en: 'Cabin CO₂ Concentration (~2.66 mmHg at 1 atm)',
        },
        group: 'all',
        operator: '>',
        threshold: CLINICAL_RULE_THRESHOLDS.co2.minCo2Level,
        unit: 'ppm',
        decimals: 0,
        thresholdNote: () => ({
          es: 'Alerta temprana prototipo (< NASA 4–5,3 mmHg)',
          en: 'Prototype early-warning (< NASA 4–5.3 mmHg)',
        }),
        extract: (input) =>
          isValidNonNegative(input.co2Level) && isValidNonNegative(input.spO2)
            ? input.co2Level
            : undefined,
      },
      {
        id: 'r3-spo2-preserved',
        label: {
          es: 'SpO₂ arterial conservada (enmascaramiento en pulsioxímetro)',
          en: 'Preserved Arterial SpO₂ (oximeter stays normal)',
        },
        group: 'all',
        operator: '>=',
        threshold: CLINICAL_RULE_THRESHOLDS.co2.minSpO2,
        unit: '%',
        decimals: 1,
        extract: (input) =>
          isValidNonNegative(input.co2Level) && isValidNonNegative(input.spO2)
            ? input.spO2
            : undefined,
      },
    ],
  },
  {
    id: 'R4_CODE_RED_EMERGENCY',
    shortCode: 'R4',
    version: RULES_VERSION,
    system: 'emergency',
    severity: 'CRITICAL',
    escalation: 'emergency',
    title: {
      es: 'Emergencia crítica / Código Rojo',
      en: 'Critical Emergency / Code Red',
    },
    summary: {
      es: 'Activación manual de Código Rojo o hipoxemia crítica (SpO₂ < 90%).',
      en: 'Manual Code Red trigger or critical hypoxemia (SpO₂ < 90%).',
    },
    rationale: {
      es: 'Garantiza prioridad visual y sonora ante emergencia declarada por el tripulante o desaturación arterial grave (< 90%). El override manual nunca se apaga automáticamente al variar sensores.',
      en: 'Provides top visual/operational priority upon crew-declared emergency or severe arterial desaturation (< 90%). Manual Code Red override cannot be auto-cleared by incoming telemetry.',
    },
    limitations: {
      es: 'Limitaciones: un artefacto por movimiento o perfusión periférica fría puede causar lecturas falsas de SpO₂ baja; verifique curva y reposicione el sensor mientras prepara O₂ suplementario.',
      en: 'Limitations: motion artifact or cold peripheral vasoconstriction can falsely lower SpO₂ readings; confirm waveform and sensor placement while staging supplemental O₂.',
    },
    actionSummary: {
      es: 'Ejecutar lista de verificación de emergencia a bordo, administrar oxígeno/soporte vital según protocolo y emitir SBAR prioritario a Tierra.',
      en: 'Execute onboard emergency checklist, initiate life-support/O₂ protocol, and queue priority Ground SBAR.',
    },
    source: 'NASA-STD-3001 Emergency Crew Health & Medical Operations Checklist',
    verified: true,
    criteria: [
      {
        id: 'r4-manual-emergency',
        label: { es: 'Interruptor manual Código Rojo (1 = activo)', en: 'Manual Code Red Flag (1 = active)' },
        group: 'or:emergency',
        operator: '==',
        threshold: 1,
        unit: 'flag',
        decimals: 0,
        extract: (input) => (input.isEmergency === true ? 1 : input.isEmergency === false ? 0 : undefined),
      },
      {
        id: 'r4-spo2-critical',
        label: { es: 'SpO₂ arterial crítica', en: 'Critical Arterial SpO₂' },
        group: 'or:emergency',
        operator: '<',
        threshold: CLINICAL_RULE_THRESHOLDS.emergency.minCriticalSpO2,
        unit: '%',
        decimals: 1,
        extract: (input) => (isValidNonNegative(input.spO2) ? input.spO2 : undefined),
      },
    ],
  },
  {
    id: 'R5_BLOOD_PRESSURE',
    shortCode: 'R5',
    version: RULES_VERSION,
    system: 'cardiovascular',
    severity: 'WARNING',
    escalation: 'notify-flight-surgeon',
    title: {
      es: 'Desviación de presión arterial',
      en: 'Blood Pressure Deviation',
    },
    summary: {
      es: 'Sistólica ≥ 140 mmHg, Diastólica ≥ 90 mmHg o Sistólica < 90 mmHg.',
      en: 'Systolic ≥ 140 mmHg, Diastolic ≥ 90 mmHg, or Systolic < 90 mmHg.',
    },
    rationale: {
      es: 'Detecta hipertensión persistente e hipotensión arterial asociada a deshidratación, intolerancia ortostática o dolor agudo tras captura con manguito en reposo.',
      en: 'Flags persistent hypertension or arterial hypotension tied to dehydration, orthostatic intolerance, or acute stress from resting cuff measurements.',
    },
    limitations: {
      es: 'Limitaciones: el desplazamiento cefálico de fluidos en 0 g modifica la hemodinámica basal y un manguito mal ajustado altera la lectura; repetir medición tras 5 minutos de reposo.',
      en: 'Limitations: cephalad fluid shifts in 0 g alter resting hemodynamics and cuff misplacement skews readings; repeat after 5 minutes at rest.',
    },
    actionSummary: {
      es: 'Repetir toma sentado en reposo 5 min; hidratarse si sistólica < 90 mmHg o notificar al Cirujano de Vuelo si persiste ≥ 140/90 mmHg.',
      en: 'Repeat after 5 min resting; hydrate if systolic < 90 mmHg or notify Flight Surgeon if persistently ≥ 140/90 mmHg.',
    },
    source: 'ACC/AHA Blood Pressure Guidelines + NASA Spaceflight Cardiovascular Assessment',
    verified: true,
    criteria: [
      {
        id: 'r5-sys-high',
        label: { es: 'Presión sistólica elevada', en: 'Elevated Systolic BP' },
        group: 'or:bp-range',
        operator: '>=',
        threshold: CLINICAL_RULE_THRESHOLDS.bp.hypertensionSys,
        unit: 'mmHg',
        decimals: 0,
        extract: (input) => (isValidPositive(input.systolicMmHg) ? input.systolicMmHg : undefined),
      },
      {
        id: 'r5-dia-high',
        label: { es: 'Presión diastólica elevada', en: 'Elevated Diastolic BP' },
        group: 'or:bp-range',
        operator: '>=',
        threshold: CLINICAL_RULE_THRESHOLDS.bp.hypertensionDia,
        unit: 'mmHg',
        decimals: 0,
        extract: (input) => (isValidPositive(input.diastolicMmHg) ? input.diastolicMmHg : undefined),
      },
      {
        id: 'r5-sys-low',
        label: { es: 'Hipotensión sistólica', en: 'Systolic Hypotension' },
        group: 'or:bp-range',
        operator: '<',
        threshold: CLINICAL_RULE_THRESHOLDS.bp.hypotensionSys,
        unit: 'mmHg',
        decimals: 0,
        extract: (input) => (isValidPositive(input.systolicMmHg) ? input.systolicMmHg : undefined),
      },
    ],
  },
  {
    id: 'R6_DYSGLYCEMIA',
    shortCode: 'R6',
    version: RULES_VERSION,
    system: 'metabolic',
    severity: 'WARNING',
    escalation: 'notify-flight-surgeon',
    title: {
      es: 'Alteración glucémica capilar',
      en: 'Capillary Dysglycemia',
    },
    summary: {
      es: 'Glucosa < 70 mg/dL (hipoglucemia) o ≥ 126 mg/dL en ayunas (≥ 200 mg/dL postprandial).',
      en: 'Glucose < 70 mg/dL (hypoglycemia) or ≥ 126 mg/dL fasting (≥ 200 mg/dL postprandial).',
    },
    rationale: {
      es: 'La resistencia periférica a la insulina aumenta durante estancias espaciales y la hipoglucemia compromete de inmediato el rendimiento cognitivo antes de tareas críticas o EVA.',
      en: 'Spaceflight induces mild insulin resistance while hypoglycemia acutely impairs executive cognition prior to critical tasks or EVA.',
    },
    limitations: {
      es: 'Limitaciones: tiras reactivas sensibles a temperatura/humedad de cabina y manos sin lavar alteran la glucemia capilar; confirmar con segunda gota.',
      en: 'Limitations: test strip storage temperature/humidity and skin residue skew capillary glucose; confirm with a second washed sample.',
    },
    actionSummary: {
      es: 'Si < 70 mg/dL ingerir 15 g de carbohidratos rápidos y reevaluar a los 15 min; si persiste elevada consultar Cirujano de Vuelo.',
      en: 'If < 70 mg/dL take 15 g fast carbs and recheck in 15 min; if persistently elevated consult Flight Surgeon.',
    },
    source: 'ADA Standards of Care Capillary Glucose Cutoffs',
    verified: true,
    criteria: [
      {
        id: 'r6-hypo',
        label: { es: 'Hipoglucemia capilar', en: 'Capillary Hypoglycemia' },
        group: 'or:glucose',
        operator: '<',
        threshold: CLINICAL_RULE_THRESHOLDS.glucose.hypo,
        unit: 'mg/dL',
        decimals: 0,
        extract: (input) => (isValidPositive(input.glucoseMgDl) ? input.glucoseMgDl : undefined),
      },
      {
        id: 'r6-hyper',
        label: { es: 'Hiperglucemia según contexto', en: 'Context-Adjusted Hyperglycemia' },
        group: 'or:glucose',
        operator: '>=',
        threshold: (input) =>
          input.glucoseContext === 'postprandial'
            ? CLINICAL_RULE_THRESHOLDS.glucose.postprandialHigh
            : CLINICAL_RULE_THRESHOLDS.glucose.fastingHigh,
        thresholdNote: (input) =>
          input.glucoseContext === 'postprandial'
            ? { es: 'postprandial', en: 'postprandial' }
            : { es: 'en ayunas', en: 'fasting' },
        unit: 'mg/dL',
        decimals: 0,
        extract: (input) => (isValidPositive(input.glucoseMgDl) ? input.glucoseMgDl : undefined),
      },
    ],
  },
  {
    id: 'R7_THERMAL_ANOMALY',
    shortCode: 'R7',
    version: RULES_VERSION,
    system: 'metabolic',
    severity: 'WARNING',
    escalation: 'notify-flight-surgeon',
    title: {
      es: 'Fiebre o hipotermia corporal',
      en: 'Fever or Core Hypothermia',
    },
    summary: {
      es: 'Temperatura corporal ≥ 38,0 °C o < 35,5 °C.',
      en: 'Core body temperature ≥ 38.0 °C or < 35.5 °C.',
    },
    rationale: {
      es: 'La fiebre apoya la sospecha de infección en hábitat cerrado o reactivación viral; la hipotermia advierte fallo de traje térmico o sepsis avanzada.',
      en: 'Fever helps differentiate closed-habitat infection or viral reactivation; hypothermia warns of LCG thermal failure or severe illness.',
    },
    limitations: {
      es: 'Limitaciones: la termorregulación en microgravedad presenta menor disipación convectiva y el ejercicio en ARED eleva transitoriamente la temperatura basal (+0,5–1 °C).',
      en: 'Limitations: microgravity lowers convective cooling and ARED exercise transiently raises resting core temperature (+0.5–1 °C).',
    },
    actionSummary: {
      es: 'Repetir en reposo a los 30 min, hidratar, evaluar síntomas respiratorios/urinarios y reportar en SBAR si persiste.',
      en: 'Repeat after 30 min rest, hydrate, screen respiratory/urinary symptoms, and include in Flight Surgeon SBAR if persistent.',
    },
    source: 'Standard Clinical Fever/Hypothermia Definition + NASA Crew Health',
    verified: true,
    criteria: [
      {
        id: 'r7-fever',
        label: { es: 'Temperatura elevada (fiebre)', en: 'Elevated Temperature (Fever)' },
        group: 'or:thermal',
        operator: '>=',
        threshold: CLINICAL_RULE_THRESHOLDS.temp.fever,
        unit: '°C',
        decimals: 1,
        extract: (input) => (isValidPositive(input.bodyTempC) ? input.bodyTempC : undefined),
      },
      {
        id: 'r7-hypothermia',
        label: { es: 'Temperatura baja (hipotermia)', en: 'Low Temperature (Hypothermia)' },
        group: 'or:thermal',
        operator: '<',
        threshold: CLINICAL_RULE_THRESHOLDS.temp.hypothermia,
        unit: '°C',
        decimals: 1,
        extract: (input) => (isValidPositive(input.bodyTempC) ? input.bodyTempC : undefined),
      },
    ],
  },
  {
    id: 'R8_BEHAVIORAL_RISK',
    shortCode: 'R8',
    version: RULES_VERSION,
    system: 'behavioral',
    severity: 'WARNING',
    escalation: 'notify-flight-surgeon',
    title: {
      es: 'Sobrecarga psicosocial / tamizaje PHQ-2 positivo (I · Aislamiento)',
      en: 'Psychosocial Strain / Positive PHQ-2 Screen (I · Isolation)',
    },
    summary: {
      es: 'PHQ-2 ≥ 3 puntos, índice conductual ≥ 55/100 o bandera de seguridad activa.',
      en: 'PHQ-2 ≥ 3 points, behavioral risk index ≥ 55/100, or active safety flag.',
    },
    rationale: {
      es: 'El aislamiento prolongado y el retardo comunicacional en Marte aumentan el riesgo de fatiga, insomnio y sintomatología anímica. El tamizaje breve PHQ-2 y las 6 dimensiones diarias permiten intervención temprana no punitiva.',
      en: 'Prolonged confinement and Mars communication delays raise fatigue, sleep disruption, and mood strain. Brief PHQ-2 plus 6 daily dimensions enable early non-punitive support.',
    },
    limitations: {
      es: 'Limitaciones: el autoinforme depende de la privacidad percibida; los datos conductuales NUNCA se envían al asistente de IA salvo opt-in explícito del astronauta.',
      en: 'Limitations: self-report depends on perceived psychological safety; behavioral check-ins are NEVER sent to the AI assistant without explicit crew opt-in.',
    },
    actionSummary: {
      es: 'Activar protocolo de descarga operativa, descanso protegido y enlace confidencial con equipo de Medicina Conductual en Tierra.',
      en: 'Initiate workload offloading, protected sleep hygiene, and confidential Ground Behavioral Health check-in.',
    },
    source: 'PHQ-2 Validated Screen (Kroenke et al.) + NASA HRP BHP Risk Framework',
    verified: true,
    criteria: [
      {
        id: 'r8-phq2',
        label: { es: 'Puntaje total PHQ-2 (0–6)', en: 'Total PHQ-2 Score (0–6)' },
        group: 'or:behavioral',
        operator: '>=',
        threshold: CLINICAL_RULE_THRESHOLDS.behavioral.phq2ScreenPositive,
        unit: 'pts',
        decimals: 0,
        extract: (input) =>
          input.behavioralCheckIn
            ? input.behavioralCheckIn.phq2Anhedonia + input.behavioralCheckIn.phq2Dysphoria
            : undefined,
      },
      {
        id: 'r8-risk-index',
        label: { es: 'Índice compuesto de carga conductual', en: 'Composite Behavioral Risk Index' },
        group: 'or:behavioral',
        operator: '>=',
        threshold: CLINICAL_RULE_THRESHOLDS.behavioral.highRiskIndex,
        unit: '/100',
        decimals: 0,
        extract: (input) =>
          input.behavioralCheckIn && isValidNonNegative(input.behavioralCheckIn.behavioralRiskIndex)
            ? input.behavioralCheckIn.behavioralRiskIndex
            : undefined,
      },
      {
        id: 'r8-self-harm',
        label: { es: 'Bandera de seguridad conductual (1 = activa)', en: 'Behavioral Safety Flag (1 = active)' },
        group: 'or:behavioral',
        operator: '==',
        threshold: 1,
        unit: 'flag',
        decimals: 0,
        extract: (input) =>
          input.behavioralCheckIn ? (input.behavioralCheckIn.selfHarmFlag ? 1 : 0) : undefined,
      },
    ],
  },
];

export type RuleAlertMap = Pick<
  ClinicalAlerts,
  'isRenalWarning' | 'isRadiationWarning' | 'isCo2Warning'
>;
