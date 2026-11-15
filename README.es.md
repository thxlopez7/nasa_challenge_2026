# ExoVitals — Sistema Autónomo de Soporte a Decisiones Clínicas (CDSS)

> **[English](README.md)** · **[Español](README.es.md)**

![Next.js](https://img.shields.io/badge/Next.js-16.4.6-000000?style=flat-square&logo=nextdotjs)
![React](https://img.shields.io/badge/React-19.3.0-20232A?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5%20Estricto-3178C6?style=flat-square&logo=typescript)
![Zustand](https://img.shields.io/badge/Zustand-5.1-443E38?style=flat-square)
![Gemini](https://img.shields.io/badge/Gemini-3%20Flash%20(Asesor)-4285F4?style=flat-square&logo=googlegemini)

> **Aviso de prototipo:** ExoVitals es una herramienta de apoyo a la decisión clínica (CDSS) para simulación e investigación construida para el **NASA Space Apps Challenge 2026** (*"Create Health Monitoring Software for Astronauts on Space Missions"*). **No** es un dispositivo médico certificado para vuelo ni sustituye el criterio del Cirujano de Vuelo.

---

## 1. Alineación con NASA Space Apps Challenge y HRP (RIDGE)

La tripulación no necesariamente está formada por médicos y opera bajo latencias extremas (Tierra–Luna **~1,3 s**, tránsito a Marte hasta **~20 min por trayecto** más **apagones solares de conjunción de hasta 14 días**). ExoVitals guía al astronauta sobre **qué medir, por qué importa, cómo capturarlo, cuándo preocuparse/escalar y qué contramedida aplicar** frente a los cinco riesgos **NASA HRP (RIDGE)**:

| Riesgo NASA HRP (RIDGE) | Módulo ExoVitals a bordo | Regla determinista / Acción |
|---|---|---|
| **R — Radiación espacial** | NLR (`neutrofilos / linfocitos`), linfocitos, tasa instantánea y dosis acumulada (mSv) | **R2**: Monitoreo hematológico + diagnóstico diferencial + protocolo radioprotector |
| **I — Aislamiento y confinamiento** | Check-in conductual diario (`mood`, `sleepQuality`, `fatigue`, `stress`, `workload`, `socialContact`, `PHQ-2`, `selfHarmFlag`) | **R8**: Índice ponderado local (`0–100`) y escalamiento en 3 niveles (`self-manage` / `notify-flight-surgeon` / `emergency`) |
| **D — Distancia a la Tierra** | Motor determinista sin red (`< 1 ms`), **Bandeja Tierra (Outbox)** en IndexedDB y **SBAR** imprimible en 1 página | Encola paquetes, simula latencia óptica (`×1` / `×60` / `×600`) y respeta bloqueo por conjunción solar |
| **G — Campos gravitatorios (0G)** | Cistatina C, Creatinina, razón `CisC/Cr`, Calcio iónico, `CTX/NTX`, `P1NP`, adherencia `ARED`, delta ortostático (`ΔFC`, `ΔPAS`) | **R1**: Alerta renal/mineral oculta por sarcopenia; contramedidas diarias óseas/CV (P6) + racha XP |
| **E — Ambientes cerrados hostiles** | `CO₂` en cabina (ppm), `SpO₂`, temperatura corporal, presión arterial y glucosa capilar (ayunas / postprandial) | **R3–R7**: Alerta temprana sub-clínica de CO₂ (`3500 ppm` con `SpO₂` conservada), emergencia vital, PA, disglucemia y fiebre/hipotermia |

---

## 2. Fundamento Científico y Limitaciones Explícitas

Priorizamos la transparencia clínica sobre las afirmaciones exageradas. Cada regla en [`config/rules.ts`](config/rules.ts) (`RULES_VERSION = '1.3.0-proto'`) expone sus umbrales, fuentes, diagnósticos diferenciales y estado de verificación directamente en la interfaz (`RuleTrace` y `RulesAndLimitationsSection`):

- **R1 — Riesgo renal oculto y resorción mineral (`verified: false`, pendiente validación de umbral compuesto NASA HRP):**
  - *Mecanismo:* La pérdida de masa muscular en microgravedad (sarcopenia) reduce la generación basal de creatinina sérica y puede enmascarar caídas tempranas del filtrado glomerular. La **Cistatina C** es *mucho menos dependiente de la masa muscular*; evaluarla (`> 1,15 mg/L`) junto con Calcio iónico (`> 1,25 mmol/L`), creatinina aparentemente normal (`≤ 1,10 mg/dL`) o la **razón cistatina C / creatinina (indicador de disociación `> 1,20`)** permite detectar tensión renal y riesgo litogénico de forma temprana.
  - *Limitaciones:* No constituye diagnóstico definitivo de lesión renal aguda (AKI). La Cistatina C puede variar por corticosteroides sistémicos, disfunción tiroidea, inflamación aguda o deshidratación; `CisC/Cr` divide `mg/L` entre `mg/dL` como indicador empírico del prototipo.
- **R2 — Inmunosupresión vinculada a radiación (`verified: false`, pendiente verificación operativa NASA-STD-3001):**
  - Combina flujo/dosis (`≥ 50 µSv/h` o `≥ 50 mSv`) con linfopenia (`< 1000 /µL`) y **NLR > 3,0**.
  - *Diferencial:* Un NLR elevado no es específico de radiación; también aparece en infección aguda o respuesta al cortisol/estrés.
- **R3 — Acumulación sub-clínica de CO₂ (`verified: true` en concepto / umbral prototipo):**
  - Se activa con **`CO₂ > 3500 ppm` y `SpO₂ ≥ 96%` conservada** (bolsas locales de CO₂ deterioran la cognición antes de caer la oximetría).
  - *Distinción operativa:* `3500 ppm` (~2,66 mmHg a 1 atm) es un **umbral de alerta temprana del prototipo**, inferior a los límites operativos NASA de **4–5,3 mmHg** (~5260–7000 ppm a 1 atm).
- **Marcadores óseos y cardiovasculares sin equipamiento terrestre (P6):**
  - **La densitometría DXA no está disponible a bordo** en misiones profundas. ExoVitals combina marcadores bioquímicos (`CTX/NTX` resorción, `P1NP` formación), carga semanal `ARED`, HRV en reposo (`RMSSD`) y deltas ortostáticos (`ΔFC`, `ΔPAS`), indicando explícitamente `DXA: no disponible a bordo`.

---

## 3. Arquitectura Edge-First 100% Operativa sin Conexión

```text
  [Stream JSON 1 Hz / Captura Manual / Inyector de Escenarios]
                           │
                           ▼
        Stores Zustand (persist localStorage v3 + Outbox idb-keyval)
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
  Motor Clínico Determinista        Bandeja Tierra y Reporte SBAR
  (`utils/clinicalEngine.ts`)       (`store/useOutboxStore.ts`)
  • `evaluateRulesWithTrace`        • Cola persistente IndexedDB
  • `runLocalTriage` (< 1 ms)       • Latencia Luna (1,3s) / Marte (20m)
  • 0 dependencias de red           • Conjunción solar y acelerador ×600
            │                             │
            └──────────┬──────────────────┘
                       ▼
         Copiloto Opcional Gemini 3 Flash
         (`POST /api/triage` · validación Zod)
         • Etiquetado "Sugerencia de IA, no es una alerta"
         • Reintentos exponenciales + fallback offline automático
```

### Límite de Privacidad (Check-in Psicológico)
Los datos de salud conductual (`mood`, `PHQ-2`, `selfHarmFlag`, `behavioralRiskIndex`) permanecen **estrictamente locales a bordo por defecto (`sharePsychWithAi: false`)**:
- La regla determinista **R8** y `deriveEscalationLevel()` corren localmente sin conexión.
- [`utils/systemPrompt.ts`](utils/systemPrompt.ts) omite `behavioralCheckIn` del contexto enviado a Gemini salvo consentimiento explícito del tripulante.
- [`components/SbarReportModal.tsx`](components/SbarReportModal.tsx) excluye datos conductuales de la exportación SBAR hacia Tierra a menos que se marque el opt-in.

### Punto de Extensión P5 (Stub Preservado)
La calibración individual por perfil fisiológico y entorno (**P5**) está reservada intencionalmente como stub en [`config/missionProfile.ts`](config/missionProfile.ts) (`MissionProfileHook` / `DEFAULT_MISSION_PROFILE_HOOK`) para integración del equipo, y `evaluateRulesWithTrace` acepta `_profileHook?: MissionProfileHook`.

---

## 4. Rutas, Scripts y Dependencias Fijadas

### Rutas de la Aplicación
- [`/`](app/page.tsx) → Pantalla de entrada / redirección al panel
- [`/panel`](app/panel/page.tsx) → Escáner corporal 3D + Centro de mando (`?mision=luna | marte`)
- [`/demo`](app/demo/page.tsx) → **Tour guiado interactivo de 6 pasos para jurados** (latencia Luna/Marte, R1/P6 renal y óseo, R3 `RuleTrace`, R2 tormenta solar, triaje sin red + SBAR + Outbox `×600`, contramedidas y limitaciones)
- [`/test`](app/test/page.tsx) → Consola QA integrada (persistencia, casos límite matemáticos, resiliencia `/api/triage`, outbox y modo sin conexión)

### Dependencias Incorporadas y Justificación
- `zod@4.6.7` — Validación en tiempo de ejecución de peticiones `/api/triage` y de la respuesta JSON estructurada de Gemini.
- `idb-keyval@6.3.0` — Almacenamiento IndexedDB asíncrono para la cola de paquetes hacia Tierra (`useOutboxStore`).
- `vitest@4.1.12` y `@vitest/coverage-v8@4.1.12` — Suite rápida de tests unitarios y de propiedades compatible con `@types/node@^20`.

### Scripts de Verificación
```bash
npm ci
npm run check:contracts   # Valida contrato único types/telemetry.ts (bloquea telemetry.ts raíz o `any`)
npx tsc --noEmit          # TypeScript estricto en 0 errores
npm run lint              # ESLint sin errores
npm run test:coverage     # Suite Vitest + reporte de cobertura V8
npm run build             # Build de producción Next.js
```

---

## 5. Estructura de Carpetas y Flujo Git

```text
app/          Páginas Next.js App Router (/panel, /demo, /test, /cuerpo, POST /api/triage)
components/   HUD clínico, visor 3D, RuleTrace, OutboxPanel, SbarReportModal, MissionCenter
config/       Única fuente de verdad: rules.ts, ai.ts, missionComms.ts, missionProfile.ts (stub P5)
content/      Guías educativas de indicadores y protocolos offline a bordo (ES/EN)
i18n/         Contexto de idioma y diccionarios ES/EN
public/       Dataset JSON 1 Hz (RIDGE), manifiesto PWA y service worker
scripts/      Controles automáticos de arquitectura (check-contracts.mjs)
store/        Stores Zustand (telemetría persist v3, misión/hábitos, outbox IndexedDB)
tests/        Tests unitarios y de invariantes (Vitest)
types/        Contratos canónicos de telemetría y misión
utils/        Motores puros y deterministas (<1ms): clinicalEngine, localTriage, behavioralScoring, countermeasures
```

**Variables de entorno:** Configura `.env.local` con `GEMINI_API_KEY=...` (ignorado en `.gitignore`, nunca versionado). Sin `GEMINI_API_KEY`, ExoVitals opera por completo mediante triaje determinista local.

**Regla Git:** Prohibido hacer commits directos a `main`. Trabajar en ramas específicas (`fix/...`, `feat/...`, `chore/...`) validadas por [`.github/workflows/ci.yml`](.github/workflows/ci.yml) antes del Pull Request.
