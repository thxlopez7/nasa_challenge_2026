import type { OnboardProtocol, ProtocolKey } from './protocolTypes';

export const ONBOARD_PROTOCOLS_ES: Record<ProtocolKey, OnboardProtocol> = {
  R4_CODE_RED_EMERGENCY: {
    id: 'R4_CODE_RED_EMERGENCY',
    title: 'Protocolo de Emergencia Crítica / Código Rojo',
    urgency: 'emergency',
    headline:
      'Atención inmediata a bordo: estabilización ABC (vía aérea, respiración, circulación) y aviso prioritario a Tierra.',
    immediateSteps: [
      'Verificar estado de conciencia y respiración del tripulante afectado; pedir asistencia inmediata al resto de la tripulación.',
      'Administrar O₂ suplementario al 100% si SpO₂ < 90% o existe dificultad respiratoria; confirmar colocación del sensor.',
      'Preparar el kit médico de emergencia (CMO / AED / soporte de vía aérea) y fijar al paciente con correas de sujeción en 0 g.',
      'Encolar de inmediato un paquete SBAR prioritario en el Outbox Tierra–Nave con signos vitales secuenciales cada 5 minutos.',
    ],
    redFlags: [
      'Pérdida de conciencia, ausencia de pulso o respiración agónica.',
      'SpO₂ persistente < 88% pese a oxígeno suplementario.',
      'Dolor torácico opresivo, déficit neurológico focal o anafilaxia.',
    ],
    whatNotToDo: [
      'No esperar la respuesta de Tierra (20 min en Marte) antes de iniciar oxígeno o soporte vital básico.',
      'No desconectar alertas hasta estabilizar dos mediciones consecutivas.',
    ],
    keywords: [
      'emergencia',
      'codigo rojo',
      'paro',
      'inconsciente',
      'dolor toracico',
      'pecho',
      'desmayo',
      'ahogo',
      'asfixia',
    ],
  },
  R3_CO2_SUBCLINICAL: {
    id: 'R3_CO2_SUBCLINICAL',
    title: 'Protocolo Ambiental ECLSS — Bolsa de CO₂ / Hipercapnia',
    urgency: 'notify-flight-surgeon',
    headline:
      'La hipercapnia subclínica causa cefalea y torpeza antes de bajar la SpO₂: ventilar de inmediato.',
    immediateSteps: [
      'Encender al máximo los ventiladores de mezcla en la zona actual o trasladarse a un módulo con flujo activo de ECLSS.',
      'Inspeccionar visualmente tomas de aire bloqueadas por equipo, filtros o cortinas de cabina.',
      'Verificar en consola el estado del depurador CDRA / cartuchos de hidróxido de litio o aminas.',
      'Reevaluar CO₂ y síntomas (cefalea, fatiga visual, lentitud cognitiva) tras 15 minutos en aire mezclado.',
    ],
    redFlags: [
      'CO₂ continúa subiendo > 5000 ppm o aparecen vómitos, confusión marcada o somnolencia.',
      'Múltiples tripulantes con cefalea simultánea en el mismo compartimento.',
    ],
    whatNotToDo: [
      'No asumir que el ambiente es seguro solo porque el pulsioxímetro muestra SpO₂ ≥ 96%.',
      'No dormir en compartimentos sin ventilación forzada verificada.',
    ],
    keywords: [
      'co2',
      'hipercapnia',
      'cefalea',
      'dolor de cabeza',
      'aire',
      'ventilador',
      'embotado',
      'embotamiento',
      'confusion',
      'nauseas',
    ],
  },
  R2_RADIATION_IMMUNOSUPPRESSION: {
    id: 'R2_RADIATION_IMMUNOSUPPRESSION',
    title: 'Protocolo SPE — Radiación Espacial y Supresión Inmune',
    urgency: 'notify-flight-surgeon',
    headline:
      'Priorizar blindaje de tormenta solar, suspender actividades extravehiculares y vigilar fiebre o infección.',
    immediateSteps: [
      'Trasladar a toda la tripulación al refugio contra tormentas (zona rodeada de depósitos de agua/polietileno) hasta confirmación de caída del flujo.',
      'Cancelar o abortar cualquier EVA programada y verificar lectura del dosímetro personal activo.',
      'Reforzar higiene de manos/superficies y aislamiento relativo ante síntomas respiratorios o cutáneos.',
      'Repetir hemograma diferencial (linfocitos y neutrófilos / NLR) en 12–24 horas y registrar temperatura cada 6 horas.',
    ],
    redFlags: [
      'Fiebre ≥ 38,0 °C con linfocitos < 1000 cél/µL o neutropenia.',
      'Náuseas/vómitos tempranos tras exposición aguda de alta tasa o úlceras mucosas.',
    ],
    whatNotToDo: [
      'No interpretar un NLR elevado sin descartar estrés agudo o infección bacteriana/viral concurrente.',
      'No abandonar el área blindada mientras la tasa siga > 50 µSv/h.',
    ],
    keywords: [
      'radiacion',
      'tormenta solar',
      'spe',
      'gcr',
      'linfocitos',
      'nlr',
      'defensas',
      'infeccion',
      'fiebre',
      'inmune',
    ],
  },
  R1_HIDDEN_NEPHROPATHY: {
    id: 'R1_HIDDEN_NEPHROPATHY',
    title: 'Protocolo Renal / Mineral 0 g — Hidratación y Riesgo Litogénico',
    urgency: 'notify-flight-surgeon',
    headline:
      'Proteger perfusión renal y diluir calcio urinario sin esperar elevación tardía de creatinina.',
    immediateSteps: [
      'Aumentar ingesta hídrica fraccionada a 2,5–3,0 L/día (250–300 mL cada hora vigilia); registrar volumen urinario.',
      'Revisar dieta y evitar suplementos no prescritos de calcio o vitamina D en exceso y exceso de sodio.',
      'Mantener sesión ARED controlada (con buena hidratación previa) para frenar resorción ósea a mediano plazo.',
      'Repetir panel renal (Cistatina C, Creatinina, Ca²⁺ iónico) en 24 h para confirmar tendencia vs deshidratación transitoria.',
    ],
    redFlags: [
      'Dolor lumbar intenso tipo cólico irradiado a flanco/ingle o hematuria (sospecha de cálculo renal).',
      'Oliguria (< 500 mL/24 h) o elevación progresiva de Cistatina C en tomas seriadas.',
    ],
    whatNotToDo: [
      'No descartar estrés renal solo porque la creatinina esté en ≤ 1,10 mg/dL si hay atrofia muscular.',
      'No restringir líquidos para ahorrar agua ante sospecha de litiasis.',
    ],
    keywords: [
      'riñon',
      'rinon',
      'renal',
      'cistatina',
      'creatinina',
      'calcio',
      'orina',
      'calculo',
      'flanco',
      'lumbar',
      'deshidratacion',
    ],
  },
  R5_BLOOD_PRESSURE: {
    id: 'R5_BLOOD_PRESSURE',
    title: 'Protocolo Hemodinámico — Presión Arterial Anómala',
    urgency: 'notify-flight-surgeon',
    headline:
      'Repetir toma estandarizada tras 5 min de reposo y diferenciar hipotensión ortostática vs hipertensión sostenida.',
    immediateSteps: [
      'Repetir la medición de presión arterial tras 5 minutos de reposo tranquilo, con brazalete ajustado al nivel del corazón.',
      'Si la sistólica es < 90 mmHg o hay mareo: recostar/elevar piernas en hábitat con gravedad parcial, hidratar con solución electrolítica (500 mL).',
      'Si es ≥ 140/90 mmHg: evitar cafeína y esfuerzo intenso, repetir en 30 min y documentar en bitácora.',
    ],
    redFlags: [
      'PA ≥ 180/115 mmHg o acompañada de cefalea súbita intensa, dolor torácico o visión borrosa.',
      'Sistólica < 80 mmHg con síncope o confusión.',
    ],
    whatNotToDo: [
      'No realizar tareas críticas ni EVA bajo hipotensión sintomática.',
    ],
    keywords: ['presion', 'hipertension', 'hipotension', 'mareo', 'sistolica', 'diastolica', 'tension'],
  },
  R6_DYSGLYCEMIA: {
    id: 'R6_DYSGLYCEMIA',
    title: 'Protocolo Metabólico — Hipoglucemia / Hiperglucemia Capilar',
    urgency: 'notify-flight-surgeon',
    headline:
      'Corregir de inmediato glucemia < 70 mg/dL con regla 15-15 y confirmar hiperglucemia repetida.',
    immediateSteps: [
      'Si glucosa < 70 mg/dL: ingerir 15 g de carbohidratos de absorción rápida (gel o jugo espacial) y reevaluar a los 15 minutos.',
      'Si glucosa elevada (≥ 126 mg/dL en ayunas o ≥ 200 mg/dL postprandial): lavar manos y repetir con segunda gota verificando contexto.',
      'Hidratar y vigilar síntomas neuroglucopénicos (temblor, sudoración, irritabilidad, visión borrosa).',
    ],
    redFlags: [
      'Glucosa < 54 mg/dL o deterioro del nivel de conciencia.',
      'Glucosa ≥ 300 mg/dL con náuseas, vómitos o respiración rápida.',
    ],
    whatNotToDo: [
      'No iniciar EVA o operación de brazo robótico tras episodio reciente de hipoglucemia hasta normalizar dos controles.',
    ],
    keywords: ['glucosa', 'azucar', 'hipoglucemia', 'hiperglucemia', 'mareado', 'temblor', 'ayunas'],
  },
  R7_THERMAL_ANOMALY: {
    id: 'R7_THERMAL_ANOMALY',
    title: 'Protocolo Térmico — Fiebre o Hipotermia',
    urgency: 'notify-flight-surgeon',
    headline:
      'Diferenciar elevación post-ARED frente a proceso infeccioso o fallo del circuito térmico.',
    immediateSteps: [
      'Esperar 30 minutos fuera de ejercicio ARED y repetir temperatura timpánica u oral.',
      'Si ≥ 38,0 °C: hidratar, evaluar síntomas respiratorios/urinarios/cutáneos y reducir carga operativa.',
      'Si < 35,5 °C: aislar térmicamente al tripulante y verificar temperatura ambiental y traje LCG.',
    ],
    redFlags: [
      'Temperatura ≥ 39,5 °C o ≤ 34,5 °C.',
      'Fiebre acompañada de rigidez de nuca, disnea o neutropenia/linfopenia severa.',
    ],
    whatNotToDo: [
      'No tomar antiinflamatorios sin registrar antes la temperatura basal y sin revisar función renal/hidratación.',
    ],
    keywords: ['fiebre', 'temperatura', 'escalofrios', 'hipotermia', 'calentura', 'frio'],
  },
  R8_BEHAVIORAL_RISK: {
    id: 'R8_BEHAVIORAL_RISK',
    title: 'Protocolo Conductual y Descanso — Carga Psicosocial (BHP)',
    urgency: 'notify-flight-surgeon',
    headline:
      'Priorizar descarga segura, higiene del sueño y apoyo confidencial; ante bandera de seguridad, acompañamiento inmediato.',
    immediateSteps: [
      'Si existe riesgo de autolesión o crisis aguda: activar acompañamiento presencial inmediato con compañero de confianza y notificar confidencialmente al Cirujano de Vuelo.',
      'Redistribuir tareas no críticas durante 24–48 horas y proteger ventana continua de sueño ≥ 7–8 horas en módulo silencioso/ventilado.',
      'Realizar respiración guiada (4-7-8) y contacto programado asincrónico (audio/video privado) con red de apoyo en Tierra.',
    ],
    redFlags: [
      'Ideas de autolesión o desesperanza severa persistente.',
      'Insomnio severo (< 4 h) durante ≥ 3 noches seguidas con errores operativos.',
    ],
    whatNotToDo: [
      'No ocultar fatiga severa ni sobrecompensar con estimulantes antes de sueño protegido.',
    ],
    keywords: ['sueno', 'insomnio', 'animo', 'ansiedad', 'estres', 'fatiga', 'aislamiento', 'triste', 'cansado'],
  },
  NOMINAL: {
    id: 'NOMINAL',
    title: 'Estado Nominal — Prevención y Vigilancia Rutinaria',
    urgency: 'self-manage',
    headline:
      'Signos vitales y ambiente dentro de rangos nominales del prototipo. Mantener rutina preventiva.',
    immediateSteps: [
      'Completar hidratación objetivo (≥ 2,5 L/día) y sesión programada de contramedidas ARED / aeróbicas.',
      'Registrar presión arterial, glucosa capilar y temperatura según calendario operativo.',
      'Conservar bitácora diaria de sueño y bienestar conductual.',
    ],
    redFlags: [
      'Cefalea nueva aunque SpO₂ parezca normal (vigilar bolsas de CO₂).',
      'Aumento sostenido de Cistatina C o caída abrupta de linfocitos.',
    ],
    whatNotToDo: [
      'No saltarse controles manuales de PA/glucosa/temperatura por exceso de confianza en sensores pasivos.',
    ],
    keywords: ['normal', 'nominal', 'preventivo', 'rutina', 'chequeo'],
  },
};
