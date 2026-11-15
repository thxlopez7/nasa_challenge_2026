import type { OnboardProtocol, ProtocolKey } from './protocolTypes';

export const ONBOARD_PROTOCOLS_EN: Record<ProtocolKey, OnboardProtocol> = {
  R4_CODE_RED_EMERGENCY: {
    id: 'R4_CODE_RED_EMERGENCY',
    title: 'Critical Emergency Protocol / Code Red',
    urgency: 'emergency',
    headline:
      'Immediate onboard response: ABC stabilization (airway, breathing, circulation) and priority Ground notification.',
    immediateSteps: [
      'Verify consciousness and breathing immediately; alert fellow crew members for Crew Medical Officer support.',
      'Deliver 100% supplemental O₂ if SpO₂ < 90% or respiratory distress is present; confirm probe placement.',
      'Stage the medical kit (CMO / AED / airway bag) and secure patient with 0 g restraint straps.',
      'Queue a priority SBAR packet in the Earth Outbox with repeat vitals every 5 minutes.',
    ],
    redFlags: [
      'Unresponsiveness, absent pulse, or agonal breathing.',
      'SpO₂ remaining < 88% despite supplemental oxygen.',
      'Crushing chest pain, focal neurological deficit, or anaphylaxis.',
    ],
    whatNotToDo: [
      'Never wait for Ground reply (up to 20 min one-way on Mars) before starting oxygen or BLS.',
      'Do not silence emergency alerts until two consecutive stabilized readings confirm recovery.',
    ],
    keywords: ['emergency', 'code red', 'arrest', 'unconscious', 'chest pain', 'faint', 'shortness of breath', 'choking'],
  },
  R3_CO2_SUBCLINICAL: {
    id: 'R3_CO2_SUBCLINICAL',
    title: 'ECLSS Atmosphere Protocol — CO₂ Pocket / Hypercapnia',
    urgency: 'notify-flight-surgeon',
    headline:
      'Subclinical hypercapnia causes headache and cognitive fog before SpO₂ drops: restore airflow immediately.',
    immediateSteps: [
      'Boost mixing fans to maximum in the current bay or relocate to an actively ventilated module.',
      'Check for blocked air intakes, cargo bags, or sleep-station curtains.',
      'Verify CO₂ scrubber (CDRA / LiOH / amine bed) status on the environmental console.',
      'Recheck cabin CO₂ and headache/concentration after 15 minutes in mixed airflow.',
    ],
    redFlags: [
      'CO₂ rising above 5000 ppm or onset of vomiting, marked confusion, or somnolence.',
      'Multiple crew reporting simultaneous headache in the same module.',
    ],
    whatNotToDo: [
      'Do not assume air is safe solely because pulse oximetry shows SpO₂ ≥ 96%.',
      'Do not sleep inside a bay with unverified fan circulation.',
    ],
    keywords: ['co2', 'hypercapnia', 'headache', 'air', 'fan', 'ventilation', 'foggy', 'confusion', 'nausea'],
  },
  R2_RADIATION_IMMUNOSUPPRESSION: {
    id: 'R2_RADIATION_IMMUNOSUPPRESSION',
    title: 'SPE Radiation & Immune Suppression Protocol',
    urgency: 'notify-flight-surgeon',
    headline:
      'Move to storm-shelter shielding immediately, pause EVA, and monitor for fever or infection.',
    immediateSteps: [
      'Relocate crew into the designated storm shelter (water/polyethylene shielded core) until flux subsides.',
      'Suspend any planned or active EVA and log active personal dosimeter readings.',
      'Increase hand/surface hygiene and relative respiratory precautions.',
      'Repeat leukocyte differential (lymphocytes & NLR) in 12–24 h and log core temp every 6 hours.',
    ],
    redFlags: [
      'Fever ≥ 38.0 °C paired with lymphocytes < 1000 cells/µL.',
      'Prodromal nausea/vomiting during high dose-rate SPE exposure.',
    ],
    whatNotToDo: [
      'Do not interpret elevated NLR without also evaluating acute stress or intercurrent infection.',
      'Do not exit shielded volume while flux exceeds 50 µSv/h.',
    ],
    keywords: ['radiation', 'solar storm', 'spe', 'gcr', 'lymphocytes', 'nlr', 'immune', 'infection', 'fever'],
  },
  R1_HIDDEN_NEPHROPATHY: {
    id: 'R1_HIDDEN_NEPHROPATHY',
    title: '0 g Renal & Mineral Protocol — Hydration & Stone Prevention',
    urgency: 'notify-flight-surgeon',
    headline:
      'Support renal perfusion and dilute urinary calcium without waiting for late creatinine rise.',
    immediateSteps: [
      'Increase divided fluid intake to 2.5–3.0 L/day (250–300 mL per waking hour) and monitor urine output.',
      'Avoid non-prescribed calcium/vitamin D supplements and limit high sodium intake.',
      'Maintain scheduled ARED resistive sessions (well-hydrated beforehand) to curb bone resorption.',
      'Repeat Cystatin C, Creatinine, and ionized Ca²⁺ within 24 h to distinguish persistent drift vs dehydration.',
    ],
    redFlags: [
      'Severe flank-to-groin colicky pain or visible hematuria (renal stone suspicion).',
      'Low urine output (< 500 mL/24 h) or steadily rising Cystatin C across serial panels.',
    ],
    whatNotToDo: [
      'Do not rule out renal strain just because creatinine is ≤ 1.10 mg/dL during muscle loss.',
      'Do not restrict water intake when stone risk is elevated.',
    ],
    keywords: ['kidney', 'renal', 'cystatin', 'creatinine', 'calcium', 'urine', 'stone', 'flank pain', 'dehydration'],
  },
  R5_BLOOD_PRESSURE: {
    id: 'R5_BLOOD_PRESSURE',
    title: 'Hemodynamic Protocol — Blood Pressure Deviation',
    urgency: 'notify-flight-surgeon',
    headline:
      'Repeat standardized cuff reading after 5 min rest; separate orthostatic hypotension from sustained hypertension.',
    immediateSteps: [
      'Rest quietly for 5 minutes and repeat blood pressure with properly sized cuff at heart level.',
      'If systolic < 90 mmHg or dizzy: recline safely, hydrate with 500 mL oral electrolyte solution.',
      'If ≥ 140/90 mmHg: avoid caffeine/strenuous exercise, recheck in 30 min, and log in SBAR.',
    ],
    redFlags: [
      'BP ≥ 180/115 mmHg or paired with severe sudden headache, chest pain, or visual changes.',
      'Systolic < 80 mmHg with syncope or confusion.',
    ],
    whatNotToDo: ['Do not perform EVA or hazardous operations while symptomatically hypotensive.'],
    keywords: ['blood pressure', 'bp', 'hypertension', 'hypotension', 'dizzy', 'dizziness', 'systolic', 'diastolic'],
  },
  R6_DYSGLYCEMIA: {
    id: 'R6_DYSGLYCEMIA',
    title: 'Metabolic Protocol — Capillary Hypoglycemia / Hyperglycemia',
    urgency: 'notify-flight-surgeon',
    headline:
      'Treat capillary glucose < 70 mg/dL immediately using the 15-15 rule and confirm elevated readings.',
    immediateSteps: [
      'If < 70 mg/dL: consume 15 g fast-acting carbohydrates and recheck capillary glucose in 15 minutes.',
      'If elevated (≥ 126 mg/dL fasting or ≥ 200 mg/dL postprandial): wash hands thoroughly and retest.',
      'Maintain hydration and check for neuroglycopenic symptoms (tremor, diaphoresis, blurred vision).',
    ],
    redFlags: [
      'Glucose < 54 mg/dL or altered mental status.',
      'Glucose ≥ 300 mg/dL with nausea, vomiting, or rapid breathing.',
    ],
    whatNotToDo: [
      'Do not start EVA or precision robotics until two consecutive glucose checks confirm stability.',
    ],
    keywords: ['glucose', 'sugar', 'hypoglycemia', 'hyperglycemia', 'shaky', 'tremor', 'fasting'],
  },
  R7_THERMAL_ANOMALY: {
    id: 'R7_THERMAL_ANOMALY',
    title: 'Thermal Protocol — Fever or Hypothermia',
    urgency: 'notify-flight-surgeon',
    headline:
      'Distinguish post-ARED exercise heat retention from closed-habitat infection or LCG loop fault.',
    immediateSteps: [
      'Rest 30 minutes away from ARED workout and repeat tympanic/oral temperature.',
      'If ≥ 38.0 °C: hydrate, screen respiratory/urinary/skin symptoms, and reduce workload.',
      'If < 35.5 °C: provide active thermal insulation and check cabin air / LCG suit cooling.',
    ],
    redFlags: [
      'Core temperature ≥ 39.5 °C or ≤ 34.5 °C.',
      'Fever paired with neck stiffness, dyspnea, or severe lymphopenia.',
    ],
    whatNotToDo: [
      'Do not mask persistent fever with antipyretics before logging baseline trend and hydration status.',
    ],
    keywords: ['fever', 'temperature', 'chills', 'hypothermia', 'hot', 'cold'],
  },
  R8_BEHAVIORAL_RISK: {
    id: 'R8_BEHAVIORAL_RISK',
    title: 'Behavioral Health & Sleep Support Protocol (BHP)',
    urgency: 'notify-flight-surgeon',
    headline:
      'Prioritize safe workload offloading, protected sleep, and confidential support; immediate buddy care for safety flags.',
    immediateSteps: [
      'If self-harm safety flag or acute crisis is present: initiate immediate supportive buddy presence and confidential Flight Surgeon escalation.',
      'Offload non-critical tasks for 24–48 h and protect an uninterrupted 7–8 h sleep window in a quiet, well-ventilated bay.',
      'Use paced breathing (4-7-8) and schedule private asynchronous audio/video message with Earth support team.',
    ],
    redFlags: [
      'Thoughts of self-harm or persistent severe hopelessness.',
      'Severe insomnia (< 4 h/night) for ≥ 3 consecutive nights affecting safety.',
    ],
    whatNotToDo: [
      'Do not conceal severe exhaustion or rely on stimulants instead of protected recovery.',
    ],
    keywords: ['sleep', 'insomnia', 'mood', 'anxiety', 'stress', 'fatigue', 'isolation', 'sad', 'tired'],
  },
  NOMINAL: {
    id: 'NOMINAL',
    title: 'Nominal Status — Routine Preventive Vigilance',
    urgency: 'self-manage',
    headline:
      'Telemetry and habitat readings are within prototype nominal bounds. Continue preventive countermeasures.',
    immediateSteps: [
      'Meet daily hydration target (≥ 2.5 L/day) and scheduled ARED / aerobic sessions.',
      'Log periodic manual blood pressure, capillary glucose, and body temperature checks.',
      'Keep daily sleep and behavioral well-being log updated.',
    ],
    redFlags: [
      'New headache even with normal SpO₂ (check for local CO₂ pocket).',
      'Progressive Cystatin C elevation or sudden lymphocyte drop.',
    ],
    whatNotToDo: [
      'Do not skip manual BP, glucose, and temperature measurements solely because passive sensors are active.',
    ],
    keywords: ['normal', 'nominal', 'preventive', 'routine', 'checkup'],
  },
};
