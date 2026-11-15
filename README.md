# 🚀 ExoVitals: Autonomous Clinical Decision Support System (CDSS)

### **NASA Space Apps Challenge 2026 — Deep Space Edge-First Medical Architecture**

![Next.js 15](https://img.shields.io/badge/Next.js_15-App_Router-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-Concurrent_UI-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript_5-Strict_Mode-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand_5-Edge_Persistence-443E38?style=for-the-badge&logo=react&logoColor=F59E0B)
![Gemini 3 Flash](https://img.shields.io/badge/Gemini_3_Flash-Autonomous_Flight_Surgeon-4285F4?style=for-the-badge&logo=google-gemini&logoColor=white)

---

## 🌌 Resumen Ejecutivo

En misiones de exploración de espacio profundo —como el tránsito y operaciones de superficie en Marte bajo la **Arquitectura de Referencia de Diseño de la NASA (DRA 5.0)**— la distancia Tierra-Marte impone una latencia de comunicaciones de hasta **20 minutos por tramo (40 minutos ida y vuelta)**, además de periodos de apagón total durante la conjunción solar. En este escenario, la telemedicina síncrona desde el Control de Misión en Houston (MCC-H) resulta inviable ante una emergencia médica aguda.

**ExoVitals** es un **Sistema de Soporte de Decisiones Clínicas (CDSS) Edge-First** diseñado para operar de forma autónoma a bordo del hábitat o vehículo espacial. Combina un **motor clínico determinista basado en la matriz de riesgos espaciales RIDGE de la NASA** (latencia cero) con un **Cirujano de Vuelo Autónomo impulsado por IA**, capaz de ingerir telemetría biométrica y ambiental a $1\text{ Hz}$ y guiar a tripulantes sin formación médica quirúrgica mediante protocolos accionables paso a paso.

---

## 🧬 Lógica de Negocio y Fundamento Científico (Matriz RIDGE)

La fisiología humana en microgravedad ($0\text{ G}$) y bajo exposición a radiación espacial altera drásticamente los rangos de referencia clínicos terrestres. Un diagnóstico basado en umbrales hospitalarios convencionales en la Tierra produce **falsos negativos letales** en el espacio. **ExoVitals** aborda tres vectores fisiopatológicos críticos:

### 1. Nefropatía Oculta y Riesgo Litogénico en Microgravedad (`isRenalWarning`)
- **El Problema Clínico (El Engaño de la Creatinina):** En la Tierra, la tasa de filtración glomerular (TFG) suele estimarse mediante la **Creatinina sérica**. Sin embargo, en microgravedad el astronauta sufre **sarcopenia acelerada (atrofia muscular por descarga mecánica)**. Al disminuir la masa muscular total y el recambio basal de fosfocreatina, la producción endógena de creatinina cae significativamente. Como consecuencia, un astronauta puede estar sufriendo una **caída aguda de la función renal o una uropatía obstructiva incipiente** mientras su creatinina sérica permanece engañosamente "normal" ($\le 1.1\text{ mg/dL}$).
- **La Solución Biomédica de ExoVitals:** Sustituimos la dependencia exclusiva de la creatinina por una regla compuesta de alta sensibilidad espacial que cruza:
  1. **Cistatina C sérica ($> 1.15\text{ mg/L}$):** Proteína de bajo peso molecular producida a tasa constante por todas las células nucleadas, completamente **independiente de la masa muscular y de la atrofia en $0\text{ G}$**.
  2. **Calcio Iónico libre ($> 1.25 - 1.32\text{ mmol/L}$):** En ingravidez, la resorción ósea osteoclástica libera grandes cantidades de calcio al torrente sanguíneo (hipercalcemia e hipercalciuria), multiplicando el riesgo de **nefrolitiasis (cálculos renales de oxalato/fosfato cálcico)** y daño tubular renal.
  3. **Índice de Disociación $\text{Cistatina C} / \text{Creatinina}$ ($> 1.2$):** Detecta el síndrome de poro encogido glomerular y la pérdida de filtrado oculta tras la sarcopenia espacial.

### 2. Inmunosupresión Inducida por Radiación Cósmica y Eventos Solares (`isRadiationWarning`)
- **El Problema Clínico:** Fuera de la magnetosfera terrestre, la tripulación está expuesta de forma crónica a **Rayos Cósmicos Galácticos (GCR)** de alta energía (iones HZE) y de forma aguda a **Eventos de Partículas Solares (SPE / Tormentas Solares)**. El tejido hematopoyético y los linfocitos circulantes son extremadamente radiosensibles; la apoptosis linfocitaria precede a las manifestaciones clínicas del síndrome hematopoyético agudo.
- **La Solución Biomédica de ExoVitals:** El motor calcula de forma continua el **Índice Neutrófilos-Linfocitos (NLR, *Neutrophil-to-Lymphocyte Ratio*)**:
  $$\text{NLR} = \frac{\text{Neutrófilos (cél/}\mu\text{L)}}{\text{Linfocitos (cél/}\mu\text{L)}}$$
  Cuando un pico de tasa de dosis ($> 50\text{ }\mu\text{Sv/h}$) o una dosis acumulada de misión elevada ($> 50\text{ mSv}$) coincide con **linfopenia absoluta ($< 1000 - 1200\text{ cél/}\mu\text{L}$)** y una desviación inflamatoria **$\text{NLR} > 3.0 - 3.5$**, el sistema dispara inmediatamente la alerta de inmunosupresión radiológica para activar blindaje tormentoso (*Storm Shelter*) y profilaxis clínica.

### 3. Falla Ambiental ECLSS e Hipercapnia Silenciosa (`isCo2Warning`)
- **El Problema Clínico (Bolsillos de $\text{CO}_2$ con $\text{SpO}_2$ Normal):** En ausencia de convección térmica natural en microgravedad, el dióxido de carbono exhalado tiende a formar "bolsillos" locales alrededor de la cabeza del astronauta o acumularse en el hábitat ante una saturación de los filtros *scrubber* (hidróxido de litio / aminas sólidas del sistema ECLSS). El peligro crítico radica en que **la oximetría de pulso ($\text{SpO}_2$) permanece normal ($\ge 96\%$)** mientras la presión parcial de $\text{CO}_2$ se dispara, provocando cefalea espacial, deterioro cognitivo en maniobras críticas, vasodilatación cerebral (agravando el síndrome neuro-ocular SANS) y narcosis hipercápnica sin cianosis previa.
- **La Solución Biomédica de ExoVitals:** El motor correlaciona en tiempo real los sensores ambientales del hábitat con la telemetría fisiológica: si $\text{CO}_2 > 3500\text{ ppm}$ mientras $\text{SpO}_2 \ge 96\%$, identifica una **hipercapnia enmascarada** antes de que ocurra hipoxia secundaria.

---

## 🛠️ Arquitectura del Sistema (Edge-First & Zero-Latency)

El diseño arquitectónico de **ExoVitals** separa estrictamente el camino crítico de seguridad vital del copiloto generativo:

1. **Autonomía Offline-First (Retraso Tierra-Marte de 20 min):**
   - El **Motor Clínico Determinista (`utils/clinicalEngine.ts`)** está escrito en funciones puras de TypeScript sin dependencias externas ni llamadas de red. Se ejecuta localmente en el borde (*Edge*) en menos de $1\text{ ms}$ por cada tick de sensor, garantizando que las alertas críticas (`isRenalWarning`, `isRadiationWarning`, `isCo2Warning`) jamás dependan de conectividad externa.
2. **Estado Global Reactivo con Persistencia Resiliente (`Zustand` + `localStorage`):**
   - El store central (`store/useTelemetryStore.ts`) utiliza el middleware `persist` con almacenamiento seguro para SSR y *throttling* de escritura en `localStorage` (`exovitals-core-storage`). Si la terminal de cabina sufre un reinicio eléctrico o recarga de interfaz, el estado clínico e historial de misión (`exovitals-mission-storage`) se rehidratan instantáneamente sin pérdida de contexto.
3. **Simulador de Hardware Científico a $1\text{ Hz}$ (`SensorSimulator.tsx`):**
   - Un motor de reproducción invisible en segundo plano consume curvas fisiológicas y ambientales pre-modeladas científicamente con **Pandas** (`public/data/scenario_ridge_critical.json`) a una frecuencia de **$1\text{ Hz}$ ($1000\text{ ms}$)**, con soporte de interrupción segura mediante **Manual Override (`isManualOverride`)** cuando se inyectan escenarios de emergencia desde el panel *God Mode*.
4. **Cirujano de Vuelo Autónomo con Inyección Dinámica de Contexto (`Gemini 3 Flash Preview`):**
   - El endpoint `POST /api/triage` utiliza `gemini-3-flash-preview` como oficial médico autónomo de a bordo. Antes de procesar la consulta del astronauta, el servidor intercepta la petición e inyecta de forma transparente la instantánea completa de biomarcadores y alertas activas dentro del `systemInstruction` del modelo con temperatura determinista (`0.2`), protegido con `AbortController` para control estricto de timeouts (`15s`).
5. **Escáner Corporal 3D Reactivo y Contramedidas Sensoriales:**
   - **Visor Anatómico 3D (`components/body3d/`):** Modelo holográfico y muscular en Three.js / React Three Fiber conectado en tiempo real al store de telemetría (`useTelemetryStore`) y las banderas RIDGE, permitiendo alternar entre vista *Tripulación* y *Cirujano de vuelo* e iniciar el protocolo de emergencia en `0 G`.
   - **Sensor Ultrasónico de Sueño y Coherencia Cardíaca (`SleepSensorPanel.tsx`, `CoherencePacer.tsx`):** Clasificación nocturna de arquitectura del sueño sin contacto (estimación por distancia, respiración y movimiento) integrada con biofeedback respiratorio y diagnóstico determinista en el **Centro de Misión** para perfiles **Artemis Lunar (40 días)**, **ISS (180 días)** y **Marte Conjunción DRA 5.0 (900 días)**.
   - **Intro Cinemática Galáctica (`components/landing/`):** Puerta de entrada interactiva con selección de perfil de misión (`?mision=luna|marte`) y campo estelar reactivo con parallax.

---

## 📂 Estructura de Carpetas

```text
exovitals/
├── app/
│   ├── api/
│   │   └── triage/
│   │       └── route.ts          # Endpoint POST de triaje médico con inyección de telemetría en Gemini 3 Flash
│   ├── cuerpo/
│   │   └── page.tsx              # Redirección directa hacia la sección del escáner 3D (#cuerpo)
│   ├── panel/
│   │   └── page.tsx              # Página única integrada: Escáner Corporal 3D + Centro de Mando
│   ├── test/
│   │   └── page.tsx              # Consola oculta de QA, pruebas de estrés de API y auditoría de Edge Cases
│   ├── globals.css               # Estilos globales Tailwind CSS v4 (paleta aeroespacial de alto contraste)
│   ├── layout.tsx                # Root Layout con fuentes locales e IntroGate galáctico
│   └── page.tsx                  # Entrada principal (redirige a /panel)
├── components/
│   ├── body3d/                   # Escáner corporal 3D Three.js conectado a telemetría RIDGE (BodyMapHUD, BodyExperience, OrganViewer)
│   ├── landing/                  # Intro cinemática galáctica 3D y selector Luna / Marte (IntroGate, CoverPage, Starfield)
│   ├── mission/                  # Suite longitudinal (MissionCenter, DailyEvaluation, TrendChart, MissionCalendar, SleepSensorPanel, CoherencePacer)
│   ├── AppNav.tsx                # Barra de navegación superior y conmutador de perfil Lunar / Marciano
│   ├── CommandDashboard.tsx      # Centro de mando con telemetría 1 Hz, reglas RIDGE y Centro de Misión
│   ├── GodModePanel.tsx          # Inyector de escenarios críticos (Tormenta Solar, Fuga CO2, Daño Renal, Code Red)
│   ├── MedicalCopilot.tsx        # Interfaz de chat clínico conectada al estado en vivo de Zustand
│   └── SensorSimulator.tsx       # Reproductor headless a 1 Hz del dataset científico con reinicio automático en RESET
├── public/
│   ├── data/
│   │   └── scenario_ridge_critical.json # Dataset secuencial (120 frames, 11 métricas) generado con Pandas/NumPy
│   ├── images/                   # Activos visuales de portada galáctica
│   └── models/                   # Modelos anatómicos GLB optimizados para operación 100% offline
├── scripts/
│   └── generate_telemetry_colab.py # Script Python/Pandas compatible con Google Colab para regenerar el dataset
├── store/
│   ├── useIntroStore.ts          # Control de apertura/cierre de la intro galáctica
│   ├── useMissionStore.ts        # Estado persistente de progresión (Artemis 40d / ISS 180d / Marte 900d)
│   └── useTelemetryStore.ts      # Store central Zustand con evaluación clínica automática y persistencia
├── types/
│   ├── mission.ts                # Contratos de datos para evaluación diaria, fases de misión y calendario
│   ├── sleep.ts                  # Contrato de etapas y métricas del sensor ultrasónico de sueño
│   └── telemetry.ts              # SINGLE SOURCE OF TRUTH: Contrato estricto de Biomarkers, Environment y Alerts
├── utils/
│   ├── clinicalEngine.ts         # Motor matemático determinista puro (Reglas RIDGE R1, R2, R3)
│   ├── demoHistory.ts            # Generador determinista (Mulberry32) de historial clínico simulado
│   ├── missionChoice.ts          # Persistencia y slug de selección de misión (?mision=luna|marte)
│   ├── missionPlan.ts            # Lógica de fases DRA 5.0 / Artemis, rangos XP, rachas 6/7 y diagnóstico
│   ├── sleepSensing.ts           # Simulador y umbrales del sensor ultrasónico nocturno sin contacto
│   └── systemPrompt.ts           # Ingeniería de prompt clínico y sanitización de payload para Gemini 3 Flash
└── telemetry.ts                  # Re-exportación limpia de ./types/telemetry para compatibilidad inter-ramas
```

---

## 👨‍💻 Guía para Desarrolladores (Git Workflow & Setup)

### 1. Reglas Estrictas de Control de Versiones y Arquitectura
- 🚫 **Prohibido hacer commits directos a `main`:** La rama `main` está reservada exclusivamente para código auditado y estable de demostración. Todo desarrollo debe realizarse en una rama dedicada siguiendo la convención:
  - `feat/<modulo>` (ej. `feat/ui-dashboard`, `feat/core-clinical-engine`, `feat/scientific-telemetry`)
  - `fix/<descripcion>` (ej. `fix/hydration-mismatch`)
- 🔄 **Integración mediante Pull Requests (PR):** Toda rama debe superar `npx tsc --noEmit` y `npm run lint` con **0 errores** antes de abrir un Pull Request hacia `main`.
- 📜 **Contrato Único de Datos (*Single Source of Truth*):** El archivo `types/telemetry.ts` es el **único Contrato de Datos** autorizado para tipar componentes de interfaz, gráficas y stores. Ningún componente de UI debe definir interfaces paralelas para biomarcadores ni utilizar el tipo `any`.

### 2. Instalación y Configuración Local

```bash
# 1. Clonar el repositorio oficial del equipo
git clone https://github.com/thxlopez7/nasa_challenge_2026.git
cd nasa_challenge_2026

# 2. Crear tu rama de trabajo desde main actualizado
git checkout main
git pull origin main
git checkout -b feat/tu-modulo

# 3. Instalar dependencias
npm install
```

### 3. Variables de Entorno (`.env.local`)
Crea un archivo `.env.local` en la raíz del proyecto e incluye tu clave de API de Google AI Studio para habilitar el Cirujano de Vuelo Autónomo:

```env
GEMINI_API_KEY="TU_CLAVE_DE_API_DE_GEMINI_AQUI"
```

### 4. Ejecución del Servidor de Desarrollo y Verificación

```bash
# Iniciar entorno de desarrollo (http://localhost:3000)
npm run dev

# Verificar tipado estricto de TypeScript (sin emitir archivos)
npx tsc --noEmit

# Ejecutar linter de código
npm run lint
```

---

## 🧪 QA, Auditoría de Estrés y Testing (`/test`)

El proyecto incluye una consola dedicada de aseguramiento de calidad accesible en la ruta **`/test`** (`http://localhost:3000/test`), diseñada para auditar la robustez del sistema frente a casos límite (*Edge Cases*) antes de cada demostración:

1. **Módulo 01 — Auditoría de Persistencia e Hidratación (Zustand):** Inspección en tiempo real del JSON serializado en `localStorage` (`exovitals-core-storage`) y prueba de recarga en caliente (`window.location.reload()`) para validar la conservación del estado clínico.
2. **Módulo 02 — Pruebas de Estrés del Motor Clínico (Edge Cases):**
   - *Inyección de Valores Negativos:* Verifica que lecturas corruptas de hardware ($\text{CO}_2 = -500\text{ ppm}$, $\text{HR} = -10\text{ bpm}$) sean rechazadas sin provocar excepciones ni falsos positivos.
   - *Falso Positivo Renal:* Valida que una creatinina elevada aislada ($3.0\text{ mg/dL}$) con Cistatina C baja ($0.2\text{ mg/L}$) **no** dispare en falso la alerta renal.
   - *Inmunosupresión Aislada:* Comprueba que una linfopenia sin exposición radiológica ($\text{Radiación} = 0\text{ mSv}$) no active erróneamente la alerta de radiación.
3. **Módulo 03 — Resiliencia del Copiloto IA (`/api/triage`):** Pruebas automatizadas de rechazo de payloads vacíos (`HTTP 400`), saturación de contexto con prompts de $5000$ caracteres y ráfagas concurrentes (`5x Promise.all`) para auditar el comportamiento bajo *rate-limiting* y control de timeouts.
4. **Módulo 04 — Auditor de Jitter y Fluctuación ($1\text{ Hz}$ Tick Test):** Monitoreo continuo del diferencial de frecuencia cardíaca ($\Delta\text{HR}$) entre ticks consecutivos.

---

<p align="center">
  <strong>Desarrollado para el NASA Space Apps Challenge 2026</strong><br/>
  <em>"Protecting human life beyond low Earth orbit through deterministic clinical intelligence."</em>
</p>
