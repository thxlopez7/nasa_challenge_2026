import type { EducationalIndicatorId, IndicatorGuide } from './indicators.es';

export const INDICATORS_EN: Record<EducationalIndicatorId, IndicatorGuide> = {
  bp: {
    id: 'bp',
    title: 'Blood Pressure (Systolic / Diastolic)',
    unit: 'mmHg',
    whatItMeasures:
      'Force exerted by circulating blood on arterial walls during heart contraction (systolic) and relaxation (diastolic).',
    whyInSpace:
      'Microgravity shifts fluids toward the chest and head; transitions back into lunar or Martian gravity increase risk of orthostatic intolerance.',
    howToMeasure:
      'Rest quietly for 5 minutes in neutral posture, align cuff at heart level, keep legs uncrossed, and avoid speaking during inflation.',
    referenceRange: 'Resting prototype reference: 90–129 / 60–84 mmHg.',
    whenToWorry:
      'Repeated reading ≥ 140/90 mmHg or systolic < 90 mmHg paired with dizziness, headache, or blurred vision.',
    whenToEscalate:
      'Notify Flight Surgeon if persistently ≥ 140/90 mmHg; Emergency immediately if ≥ 180/115 mmHg or < 80 mmHg with neurological symptoms.',
    prevention:
      'Maintain daily hydration, scheduled aerobic/resistive training, and gradual postural transitions.',
    sourceNote: 'General AHA/ACC adult ranges; prototype flight thresholds TODO: verify.',
    verified: false,
  },
  glucose: {
    id: 'glucose',
    title: 'Capillary Blood Glucose',
    unit: 'mg/dL',
    whatItMeasures:
      'Available blood sugar supplying immediate energy to brain tissue and active muscles.',
    whyInSpace:
      'Shifted schedules, elevated stress cortisol, skipped meals before EVA, or altered insulin sensitivity can trigger hypoglycemia or hyperglycemia.',
    howToMeasure:
      'Clean and dry fingertip, prick the side of the finger pad, apply droplet to test strip, and tag Fasting or Postprandial context.',
    referenceRange: 'Fasting: 70–99 mg/dL · Postprandial (2 h): < 140 mg/dL.',
    whenToWorry:
      'Glucose < 70 mg/dL (shakiness, cold sweat, confusion) or fasting ≥ 126 mg/dL / postprandial ≥ 200 mg/dL.',
    whenToEscalate:
      'Self-manage 55–69 mg/dL when alert using rapid oral carbs and re-check in 15 min; Emergency if < 54 mg/dL or ≥ 300 mg/dL.',
    prevention:
      'Balance carbohydrate and protein intake ahead of demanding EVA or resistive sessions.',
    sourceNote: 'Standard ADA adult capillary ranges.',
    verified: true,
  },
  temp: {
    id: 'temp',
    title: 'Body Temperature',
    unit: '°C',
    whatItMeasures:
      'Core thermal balance helping detect early infection, suit heat stress during EVA, or hypothermia.',
    whyInSpace:
      'Immune changes in radiation/confinement plus limited convective cooling inside suits increase thermal and infectious risk.',
    howToMeasure:
      'Use tympanic or oral thermometer at least 15 minutes after hot/cold drinks or heavy exercise.',
    referenceRange: 'Nominal adult range: 36.1–37.5 °C.',
    whenToWorry:
      'Fever ≥ 38.0 °C or drop < 35.5 °C, especially with chills or respiratory symptoms.',
    whenToEscalate:
      'Notify Flight Surgeon at ≥ 38.0 °C; Emergency at ≥ 39.5 °C or ≤ 34.5 °C.',
    prevention:
      'Habitat air hygiene, cooling loop adjustment (LCVG) during EVA, and early symptom logging.',
    sourceNote: 'Standard clinical thermometry bands; operational thresholds TODO: verify.',
    verified: false,
  },
  heartRate: {
    id: 'heartRate',
    title: 'Heart Rate & Arterial SpO₂',
    unit: 'bpm · %',
    whatItMeasures:
      'Heart contraction rate and percentage of arterial hemoglobin carrying oxygen.',
    whyInSpace:
      'Cardiovascular deconditioning raises effort heart rates, while cabin depressurization or ECLSS issues endanger oxygen delivery.',
    howToMeasure:
      'Continuous biometric strap/shirt reading verified with pulse oximeter on a warm, still fingertip.',
    referenceRange: 'Resting HR: 50–100 bpm · SpO₂: 95–100%.',
    whenToWorry:
      'Sustained resting tachycardia > 105 bpm, symptomatic bradycardia < 50 bpm, or SpO₂ < 94%.',
    whenToEscalate:
      'Notify Flight Surgeon if SpO₂ 90–94%; Emergency immediately if SpO₂ < 90% or chest pain/severe dyspnea.',
    prevention:
      'Consistent aerobic exercise and hydration; never dismiss dyspnea even if initial SpO₂ looks borderline.',
    sourceNote: 'Standard resting HR & oximetry guidance; personalized baselines live in P5.',
    verified: false,
  },
  co2: {
    id: 'co2',
    title: 'Cabin Carbon Dioxide (CO₂)',
    unit: 'ppm',
    whatItMeasures:
      'Ambient CO₂ concentration around crew living and sleeping quarters.',
    whyInSpace:
      'Without buoyancy-driven natural convection, exhaled CO₂ can pool locally causing headache and cognitive fog before SpO₂ drops.',
    howToMeasure:
      'Continuous habitat atmosphere sensor positioned near crew breathing zone.',
    referenceRange: 'Nominal prototype baseline: < 1000 ppm · Prototype early alert: > 3500 ppm (~2.66 mmHg).',
    whenToWorry:
      'Exceeding 3500 ppm (prototype conservative early-warning threshold, below NASA operational limits of 4–5.3 mmHg) or experiencing headache.',
    whenToEscalate:
      'Increase ventilation immediately and inspect CO₂ scrubbers; notify Ground if persistent > 3500 ppm.',
    prevention:
      'Keep circulation fans active in sleep stations and replace sorbent cartridges on schedule.',
    sourceNote: 'NASA-STD-3001 CO₂ bands (~4–5.3 mmHg acute); 3500 ppm is prototype early-warning.',
    verified: false,
  },
  renal: {
    id: 'renal',
    title: 'Cystatin C, Creatinine & Ionized Calcium',
    unit: 'mg/L · mg/dL · mmol/L',
    whatItMeasures:
      'Glomerular kidney filtration markers alongside circulating free calcium mobilized from bone.',
    whyInSpace:
      'Muscle atrophy lowers baseline creatinine and can mask renal strain; Cystatin C is much less dependent on muscle mass, so the Cystatin C / Creatinine ratio highlights dissociation alongside bone resorption.',
    howToMeasure:
      'Point-of-care biochemical cartridge on scheduled sampling days or after dehydration episodes.',
    referenceRange: 'Cystatin C: 0.6–1.0 mg/L · Ca²⁺: 1.10–1.25 mmol/L.',
    whenToWorry:
      'Cystatin C > 1.15 mg/L combined with Ca²⁺ > 1.25 mmol/L (occult renal strain and stone-forming risk).',
    whenToEscalate:
      'Notify Flight Surgeon on persistent elevation or flank pain / hematuria.',
    prevention:
      'Target ≥ 2.5 L/day fluid intake, ARED resistive loading, and avoid non-prescribed calcium supplements.',
    sourceNote: 'Cystatin C eGFR principles + NASA renal stone risk; compound cutoffs TODO: verify.',
    verified: false,
  },
  radiation: {
    id: 'radiation',
    title: 'Space Radiation & NLR Ratio',
    unit: 'µSv/h · mSv · ratio',
    whatItMeasures:
      'Instantaneous radiation flux and cumulative dose alongside Neutrophil-to-Lymphocyte Ratio (NLR).',
    whyInSpace:
      'Lymphocytes are highly radiosensitive; high radiation exposure combined with lymphopenia and elevated NLR warns of immune stress.',
    howToMeasure:
      'Habitat active dosimeter paired with single-drop leukocyte differential analyzer.',
    referenceRange: 'Resting adult NLR typically ~1.0–3.0 · Radiation varies by orbit/transit.',
    whenToWorry:
      'Solar particle event (SPE) spike or high cumulative dose paired with lymphocytes < 1000/µL and NLR > 3.0.',
    whenToEscalate:
      'Immediate storm-shelter move during SPE; notify Flight Surgeon if NLR > 3.0 or fever develops.',
    prevention:
      'Follow space-weather alerts, cancel EVA during flux spikes, and maximize water/polyethylene shielding.',
    sourceNote: 'Prototype composite radiation+NLR heuristic; operational NASA limits TODO: verify.',
    verified: false,
  },
  behavioral: {
    id: 'behavioral',
    title: 'Behavioral Health, Sleep & PHQ-2',
    unit: '1–5 Scale · PHQ-2 (0–6)',
    whatItMeasures:
      'Mood, sleep quality, fatigue, perceived stress, workload, social connectedness, and brief PHQ-2 screen.',
    whyInSpace:
      'Long-duration confinement, isolation, and Earth delay impact mood, sleep architecture, and crew error rates.',
    howToMeasure:
      'Brief < 60 s daily check-in; stays private onboard unless you explicitly opt in to share with AI.',
    referenceRange: 'PHQ-2 < 3 · Behavioral risk index < 40/100.',
    whenToWorry:
      'PHQ-2 ≥ 3, recurrent short sleep < 6 h, severe exhaustion, or persistent isolation.',
    whenToEscalate:
      'Self-care and sleep protection for mild strain; Notify Flight Surgeon if PHQ-2 ≥ 3; Immediate priority care if any self-harm concern arises.',
    prevention:
      'Maintain light/dark schedule, peer connection, balanced task pacing, and Ground family/team calls.',
    sourceNote: 'PHQ-2 validated screen (Kroenke et al., ≥ 3); composite index is prototype heuristic.',
    verified: true,
  },
};
