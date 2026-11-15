export type EducationalIndicatorId =
  | 'bp'
  | 'glucose'
  | 'temp'
  | 'heartRate'
  | 'co2'
  | 'renal'
  | 'radiation'
  | 'behavioral';

export interface IndicatorGuide {
  id: EducationalIndicatorId;
  title: string;
  unit: string;
  whatItMeasures: string;
  whyInSpace: string;
  howToMeasure: string;
  referenceRange: string;
  whenToWorry: string;
  whenToEscalate: string;
  prevention: string;
  sourceNote: string;
  verified: boolean;
}

export const INDICATORS_ES: Record<EducationalIndicatorId, IndicatorGuide> = {
  bp: {
    id: 'bp',
    title: 'Presión arterial (Sistólica / Diastólica)',
    unit: 'mmHg',
    whatItMeasures:
      'La fuerza con que la sangre empuja las paredes arteriales al latir el corazón (sistólica) y al relajarse (diastólica).',
    whyInSpace:
      'En microgravedad e hipogravedad los líquidos suben hacia el tórax y cabeza; al volver a gravedad lunar/marciana aumenta el riesgo de mareo ortostático o desregulación vascular.',
    howToMeasure:
      'Siéntate o fíjate en soporte neutro, descansa 5 minutos, coloca el manguito a la altura del corazón y realiza la lectura sin cruzar piernas ni hablar.',
    referenceRange: 'Referencia prototipo en reposo: 90–129 / 60–84 mmHg.',
    whenToWorry:
      'Lectura repetida ≥ 140/90 mmHg o sistólica < 90 mmHg acompañada de mareo, cefalea o visión borrosa.',
    whenToEscalate:
      'Notificar al Cirujano de Vuelo si persiste ≥ 140/90 mmHg; Emergencia inmediata si ≥ 180/115 mmHg o < 80 mmHg con síntomas neurológicos.',
    prevention:
      'Mantener hidratación diaria, entrenamiento aeróbico/resistivo y transición progresiva al incorporarse tras reposo.',
    sourceNote: 'AHA/ACC general adult ranges; prototype thresholds TODO: verify flight-surgeon limits.',
    verified: false,
  },
  glucose: {
    id: 'glucose',
    title: 'Glucosa capilar',
    unit: 'mg/dL',
    whatItMeasures:
      'Cantidad de azúcar disponible en sangre capilar como combustible inmediato para el cerebro y los músculos.',
    whyInSpace:
      'Turnos irregulares, estrés elevado por cortisol, ayunos involuntarios en EVA o menor sensibilidad insulínica pueden causar hipoglucemia o hiperglucemia.',
    howToMeasure:
      'Lava y seca el dedo, usa lanceta estéril en el lateral de la yema, aplica la gota en la tira reactiva y marca si estás en ayunas o tras comida (posprandial).',
    referenceRange: 'Ayunas: 70–99 mg/dL · Posprandial (2 h): < 140 mg/dL.',
    whenToWorry:
      'Glucosa < 70 mg/dL (temblor, sudor frío, confusión) o ayunas ≥ 126 mg/dL / posprandial ≥ 200 mg/dL.',
    whenToEscalate:
      'Autocuidado con carbohidratos rápidos si 55–69 mg/dL consciente y reevaluar en 15 min; Emergencia si < 54 mg/dL o ≥ 300 mg/dL.',
    prevention:
      'Fraccionar comidas antes de tareas exigentes o EVA y evitar períodos prolongados sin ingesta calórica.',
    sourceNote: 'ADA standard adult capillary glucose ranges; prototype space nutrition context.',
    verified: true,
  },
  temp: {
    id: 'temp',
    title: 'Temperatura corporal',
    unit: '°C',
    whatItMeasures:
      'Balance térmico del cuerpo; ayuda a detectar infecciones tempranas, estrés térmico en traje EVA o hipotermia.',
    whyInSpace:
      'La inmunidad se altera en radiación y confinamiento, y los trajes EVA o fallas térmicas pueden dificultar disipar calor.',
    howToMeasure:
      'Usa el termómetro timpánico o sublingual tras esperar 15 min desde bebidas calientes/frías o ejercicio intenso.',
    referenceRange: 'Nominal adulto: 36,1–37,5 °C.',
    whenToWorry:
      'Fiebre ≥ 38,0 °C o descenso < 35,5 °C, especialmente si se acompaña de escalofríos o tos.',
    whenToEscalate:
      'Notificar al Cirujano de Vuelo con ≥ 38,0 °C; Emergencia ante ≥ 39,5 °C o ≤ 34,5 °C.',
    prevention:
      'Higiene de cabina, ventilación adecuada, ajuste del lazo térmico del traje (LCVG) y detección temprana de infecciones.',
    sourceNote: 'Standard clinical thermometry bands; calibrated operational thresholds TODO: verify.',
    verified: false,
  },
  heartRate: {
    id: 'heartRate',
    title: 'Frecuencia cardíaca y SpO₂',
    unit: 'lpm · %',
    whatItMeasures:
      'Velocidad de bombeo del corazón y porcentaje de hemoglobina transportando oxígeno hacia los tejidos.',
    whyInSpace:
      'El descondicionamiento cardíaco en gravedad reducida eleva las pulsaciones ante esfuerzos y las caídas de presión o fallos ECLSS afectan SpO₂.',
    howToMeasure:
      'Lectura continua por camiseta/banda biométrica y confirmación con pulsioxímetro en dedo tibio e inmóvil.',
    referenceRange: 'FC en reposo: 50–100 lpm · SpO₂: 95–100%.',
    whenToWorry:
      'Taquicardia persistente > 105 lpm en reposo, bradicardia < 50 lpm sintomática o SpO₂ < 94%.',
    whenToEscalate:
      'Escalar al Cirujano de Vuelo con SpO₂ 90–94%; Emergencia inmediata si SpO₂ < 90% o dolor torácico/disnea severa.',
    prevention:
      'Ejercicio aeróbico regular e hidratación consistente; nunca ignorar disnea aunque SpO₂ inicial parezca aceptable.',
    sourceNote: 'Standard pulse oximetry & resting HR guidance; flight-medical individual limits in P5.',
    verified: false,
  },
  co2: {
    id: 'co2',
    title: 'Dióxido de carbono en cabina (CO₂)',
    unit: 'ppm',
    whatItMeasures:
      'Concentración local de CO₂ en el aire respirable del hábitat o alrededor de la cabeza del tripulante.',
    whyInSpace:
      'Sin convección natural por gravedad, el CO₂ exhalado puede formar «bolsillos» estancados provocando cefalea, somnolencia y menor rendimiento cognitivo antes de que caiga el oxígeno.',
    howToMeasure:
      'Sensor ambiental continuo cerca de la zona de descanso o trabajo del tripulante.',
    referenceRange: 'Nominal del prototipo: < 1000 ppm · Alerta temprana del prototipo: > 3500 ppm (~2,66 mmHg).',
    whenToWorry:
      'Superar 3500 ppm (umbral conservador de alerta temprana del prototipo, inferior a límites operativos NASA de 4–5,3 mmHg) o sentir cefalea/embotamiento.',
    whenToEscalate:
      'Ventilar inmediatamente e inspeccionar depuradores; notificar Control si persiste > 3500 ppm o hay confusión.',
    prevention:
      'Asegurar flujo de ventiladores activos en áreas de sueño y cambiar puntualmente cartuchos de absorción de CO₂.',
    sourceNote: 'NASA-STD-3001 CO₂ operational bands (~4–5.3 mmHg acute); 3500 ppm is prototype early-warning.',
    verified: false,
  },
  renal: {
    id: 'renal',
    title: 'Cistatina C, Creatinina y Calcio iónico',
    unit: 'mg/L · mg/dL · mmol/L',
    whatItMeasures:
      'Filtración de los riñones (Cistatina C y Creatinina) junto al calcio libre movilizado desde los huesos.',
    whyInSpace:
      'Al perder masa muscular en microgravedad baja la creatinina basal y puede enmascarar daño renal; la Cistatina C es mucho menos dependiente de la masa muscular y la razón Cistatina C / Creatinina ayuda a detectar esa disociación junto a resorción ósea.',
    howToMeasure:
      'Cartucho bioquímico capilar/venoso en analizador portátil según rutina médica o tras deshidratación severa.',
    referenceRange: 'Cistatina C: 0,6–1,0 mg/L · Ca²⁺: 1,10–1,25 mmol/L.',
    whenToWorry:
      'Cistatina C > 1,15 mg/L combinada con Ca²⁺ > 1,25 mmol/L (riesgo de disfunción renal oculta y cálculos renales).',
    whenToEscalate:
      'Notificar al Cirujano de Vuelo si persiste o aparece dolor en flanco/hematuria.',
    prevention:
      'Ingesta ≥ 2,5 L/día de agua, entrenamiento resistivo ARED y evitar suplementos extra de calcio sin prescripción.',
    sourceNote: 'Inker et al. eGFR CysC concepts + NASA renal stone risk; prototype compound cutoffs TODO: verify.',
    verified: false,
  },
  radiation: {
    id: 'radiation',
    title: 'Radiación espacial y razón NLR',
    unit: 'µSv/h · mSv · ratio',
    whatItMeasures:
      'Exposición acumulada y tasa instantánea a radiación cósmica/solar, junto a la razón Neutrófilos/Linfocitos (NLR).',
    whyInSpace:
      'Los linfocitos son altamente radiosensibles; un aumento rápido de radiación con caída linfocitaria y NLR elevado alerta de estrés hematológico e inmunosupresión.',
    howToMeasure:
      'Dosímetro activo/pasivo de cabina combinado con recuento diferencial leucocitario de 1 gota.',
    referenceRange: 'NLR típico adulto en calma: ~1,0–3,0 · Tasa basal orbital variable.',
    whenToWorry:
      'Tormenta solar (SPE) con tasa alta o dosis acumulada significativa acompañadas de linfocitos < 1000/µL y NLR > 3,0.',
    whenToEscalate:
      'Refugio inmediato ante tormenta solar; notificar Cirujano de Vuelo si NLR > 3,0 con síntomas infecciosos.',
    prevention:
      'Respetar alertas de clima espacial, limitar EVA en picos de flujo y usar zonas de mayor masa de agua/polietileno.',
    sourceNote: 'Prototype composite radiation+NLR heuristic; operational ALARA & NASA limits TODO: verify.',
    verified: false,
  },
  behavioral: {
    id: 'behavioral',
    title: 'Bienestar conductual, sueño y PHQ-2',
    unit: 'Escala 1–5 · PHQ-2 (0–6)',
    whatItMeasures:
      'Estado de ánimo, calidad de sueño, fatiga, estrés, carga operativa, conexión social y tamizaje breve PHQ-2.',
    whyInSpace:
      'El aislamiento, el encierro y la desconexión temporal con la Tierra alteran el ritmo circadiano y aumentan errores operativos si no se atienden temprano.',
    howToMeasure:
      'Check-in breve de 6 escalas (< 60 s) y dos preguntas PHQ-2; permanece privado a bordo salvo opt-in explícito.',
    referenceRange: 'PHQ-2 < 3 · Índice de riesgo conductual < 40/100.',
    whenToWorry:
      'PHQ-2 ≥ 3 persistente, sueño < 6 h reiterado, agotamiento extremo o sensación de desconexión total.',
    whenToEscalate:
      'Autocuidado y descanso si riesgo leve; Notificar al Cirujano de Vuelo si PHQ-2 ≥ 3; Atención prioritaria inmediata ante cualquier señal de autolesión.',
    prevention:
      'Proteger horarios de luz/oscuridad, pausas de recuperación, contacto regular con compañeros/familia y carga laboral realista.',
    sourceNote: 'PHQ-2 validated screening (Kroenke et al., cutoff >=3); composite index is prototype heuristic.',
    verified: true,
  },
};
