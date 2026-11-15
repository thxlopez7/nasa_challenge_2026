# ExoVitals — Autonomous Crew Clinical Decision Support System (CDSS)

> **[English](README.md)** · **[Español](README.es.md)**

![Next.js](https://img.shields.io/badge/Next.js-16.4.6-000000?style=flat-square&logo=nextdotjs)
![React](https://img.shields.io/badge/React-19.3.0-20232A?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5%20Strict-3178C6?style=flat-square&logo=typescript)
![Zustand](https://img.shields.io/badge/Zustand-5.1-443E38?style=flat-square)
![Gemini](https://img.shields.io/badge/Gemini-3%20Flash%20(Advisory)-4285F4?style=flat-square&logo=googlegemini)

> **Prototype Disclaimer:** ExoVitals is a research and simulation CDSS built for the **NASA Space Apps Challenge 2026** (*"Create Health Monitoring Software for Astronauts on Space Missions"*). It is **not** a flight-certified medical device and does not replace physician judgment or operational Flight Surgeon consultation.

---

## 1. NASA Space Apps Challenge & HRP RIDGE Alignment

Astronauts are not physicians, and deep-space crews operate across extreme communication latency (Earth–Moon **~1.3 s**, Mars transit up to **~20 min one-way** plus **14-day solar conjunction blackouts**). ExoVitals helps non-physician crew **what to measure, why it matters, how to capture it, when to escalate, and how to counteract** across all five **NASA Human Research Program (HRP) RIDGE** hazards:

| NASA HRP RIDGE Hazard | Onboard ExoVitals Module | Deterministic Rule / Action |
|---|---|---|
| **R — Space Radiation** | NLR (`neutrofilos / linfocitos`), lymphocytes, instantaneous rate & accumulated mSv | **R2**: NLR & lymphocyte tracking + differential considerations + radioprotective protocol |
| **I — Isolation & Confinement** | Daily behavioral check-in (`mood`, `sleepQuality`, `fatigue`, `stress`, `workload`, `socialContact`, `PHQ-2`, `selfHarmFlag`) | **R8**: Local weighted Behavioral Risk Index (`0–100`) & 3-tier escalation (`self-manage` / `notify-flight-surgeon` / `emergency`) |
| **D — Distance from Earth** | Zero-network deterministic engine (`< 1 ms`), IndexedDB **Earth Outbox**, 1-page printable **SBAR** | Queues telemetry packets, simulates light delay (`×1` / `×60` / `×600`), respects solar conjunction hold |
| **G — Gravity Fields (0G / Partial G)** | Cystatin C, Creatinine, `CisC/Cr` ratio, Ionized Ca²⁺, `CTX/NTX`, `P1NP`, `ARED` adherence, orthostatic delta (`ΔHR`, `ΔSys`) | **R1**: Sarcopenia-masked renal/mineral alert; P6 daily bone/cardio countermeasures + XP streak |
| **E — Hostile Closed Environments** | Cabin `CO₂ (ppm)`, `SpO₂`, body temperature, blood pressure, capillary glucose (fasting / postprandial) | **R3–R7**: Subclinical CO₂ early warning (`3500 ppm` vs preserved `SpO₂`), emergency arrest guard, BP, dysglycemia, thermoregulation |

---

## 2. Scientific Foundation & Explicit Clinical Limitations

Clinical integrity takes priority over hype. Every rule in [`config/rules.ts`](config/rules.ts) (`RULES_VERSION = '1.3.0-proto'`) exposes its thresholds, references, differential diagnoses, and prototype verification status directly in the UI (`RuleTrace` & `RulesAndLimitationsSection`):

- **R1 — Masked Renal & Bone Resorption Risk (`verified: false`, pending NASA HRP compound threshold validation):**
  - *Mechanism:* Prolonged microgravity induces muscular atrophy (sarcopenia), lowering baseline serum creatinine generation and potentially masking early GFR decline. **Cystatin C** is far less dependent on muscle mass (`mucho menos dependiente de la masa muscular`); pairing Cystatin C (`> 1.15 mg/L`) and mobilized Ionized Calcium (`> 1.25 mmol/L`) with masked creatinine (`≤ 1.10 mg/dL`) or an empirical **Cystatin C / Creatinine dissociation ratio (`> 1.20`)** provides an earlier warning flag for renal strain and nephrolithiasis risk.
  - *Limitations:* Not a standalone Acute Kidney Injury (AKI) diagnosis. Cystatin C can shift with systemic corticosteroids, thyroid dysfunction, acute inflammation, or hemoconcentration/dehydration; `CisC/Cr` compares `mg/L` against `mg/dL` as a prototype empirical indicator.
- **R2 — Radiation-Linked Immunosuppression (`verified: false`, pending NASA-STD-3001 SPE alert verification):**
  - Pairs cumulative/instantaneous radiation load (`≥ 50 µSv/h` or `≥ 50 mSv`) with lymphopenia (`< 1000 /µL`) and elevated **NLR (`> 3.0`)**.
  - *Differential:* Elevated NLR is non-specific and also rises during acute bacterial/viral infection or glucocorticoid/cortisol stress surges.
- **R3 — Subclinical CO₂ Accumulation (`verified: true` concept / prototype threshold):**
  - Triggers at **`CO₂ > 3500 ppm` with preserved `SpO₂ ≥ 96%`** (localized habitable-module ventilation pockets cause headache/cognitive impairment before pulse oximetry drops).
  - *Important Distinction:* `3500 ppm` (~2.66 mmHg at 1 atm) is a **prototype early-warning threshold** — intentionally lower than NASA operational cabin limits of **4–5.3 mmHg** (~5260–7000 ppm at 1 atm).
- **Bone & Cardiovascular Markers without Ground Diagnostics (P6):**
  - **DXA bone densitometry is unavailable onboard deep-space habitats.** ExoVitals monitors serum/urine turnover surrogate indices (`CTX/NTX` resorption, `P1NP` formation), weekly `ARED` resistive adherence, resting HRV (`RMSSD`), and simplified stand-test orthostatic deltas (`ΔHR`, `ΔSys`) — while explicitly flagging `DXA: unavailable onboard`.

---

## 3. Edge-First Offline Architecture

```text
  [1 Hz JSON Stream / Manual Capture / Scenario Injector]
                           │
                           ▼
        Zustand Stores (persist localStorage v3 + idb-keyval Outbox)
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
  Deterministic Clinical Engine     Earth Outbox & SBAR Export
  (`utils/clinicalEngine.ts`)       (`store/useOutboxStore.ts`)
  • `evaluateRulesWithTrace`        • IndexedDB packet queue
  • `runLocalTriage` (< 1 ms)       • Moon (1.3s) / Mars (20m) delay
  • Strictly 0 network required     • Conjunction hold & ×600 warp
            │                             │
            └──────────┬──────────────────┘
                       ▼
         Optional Gemini 3 Flash Copilot
         (`POST /api/triage` · Zod guardrails)
         • Labeled "AI suggestion, not an alert"
         • Exponential backoff + auto offline fallback
```

### Privacy Boundary (Psychological & Behavioral Check-In)
Mental health check-in data (`mood`, `PHQ-2`, `selfHarmFlag`, `behavioralRiskIndex`) is **strictly private onboard by default (`sharePsychWithAi: false`)**:
- Deterministic rule **R8** and `deriveEscalationLevel()` run 100% locally on-device.
- [`utils/systemPrompt.ts`](utils/systemPrompt.ts) strips `behavioralCheckIn` before building prompts unless the crew member enables explicit opt-in sharing.
- [`components/SbarReportModal.tsx`](components/SbarReportModal.tsx) likewise excludes psychological details from ground SBAR JSON exports unless explicitly opted in.

### P5 Extension Point (Intentionally Unimplemented Stub)
The mission/crew baseline calibration block (**P5**) is intentionally left for a teammate in [`config/missionProfile.ts`](config/missionProfile.ts) (`MissionProfileHook` / `DEFAULT_MISSION_PROFILE_HOOK`). `evaluateRulesWithTrace` already accepts an optional `_profileHook?: MissionProfileHook` signature without altering current R1–R8 behavior.

---

## 4. Routes, Scripts & Pinned Dependencies

### App Routes
- [`/`](app/page.tsx) → Cover landing / redirects cleanly into the cockpit
- [`/panel`](app/panel/page.tsx) → Interactive 3D body scanner + Mission Command Center (`?mision=luna | marte`)
- [`/demo`](app/demo/page.tsx) → **6-step interactive Space Apps judge walkthrough** (Moon vs Mars latency, R1/P6 renal & bone, R3 `RuleTrace`, R2 solar storm, offline local triage + SBAR + `×600` Earth Outbox, countermeasures & limitations matrix)
- [`/test`](app/test/page.tsx) → Built-in QA validation harness (localStorage persistence, mathematical edge cases, `/api/triage` resilience, outbox & offline check)

### Pinned Additions & Rationale
- `zod@4.6.7` — Runtime validation of `/api/triage` request payloads and structured Gemini JSON responses (strict non-diagnostic schema guardrail).
- `idb-keyval@6.3.0` — Lightweight asynchronous IndexedDB persistence for the deep-space Earth Outbox queue.
- `vitest@4.1.12` & `@vitest/coverage-v8@4.1.12` — Fast ES/TS unit & property test runner compatible with `@types/node@^20` (v5 requires `@types/node >=22`).

### Verification Scripts
```bash
npm ci
npm run check:contracts   # Ensures canonical types/telemetry.ts (blocks duplicate root telemetry.ts / any)
npx tsc --noEmit          # Strict TypeScript check
npm run lint              # ESLint validation
npm run test:coverage     # Vitest unit & property suites with V8 coverage
npm run build             # Production Next.js build (all routes)
```

---

## 5. Folder Map & Git Workflow

```text
app/          Next.js App Router pages (/panel, /demo, /test, /cuerpo, POST /api/triage)
components/   UI HUD, 3D viewer, RuleTrace, OutboxPanel, SbarReportModal, MissionCenter
config/       Single source of truth: rules.ts, ai.ts, missionComms.ts, missionProfile.ts (P5 stub)
content/      Bilingual Spaceflight indicator guides & onboard offline protocols (ES/EN)
i18n/         Dictionary context & strict ES/EN UI copy
public/       1 Hz RIDGE telemetry JSON stream, PWA manifest & service worker shell
scripts/      CI guardrails (check-contracts.mjs)
store/        Zustand stores (persist v3 telemetry, mission plan/habits, IndexedDB outbox)
tests/        Vitest unit & property suites
types/        Canonical telemetry & mission TypeScript contracts
utils/        Pure deterministic engines (<1ms): clinicalEngine, localTriage, behavioralScoring, countermeasures
```

**Environment Setup:** Create `.env.local` with `GEMINI_API_KEY=...` (ignored via `.gitignore`, never committed). Without `GEMINI_API_KEY`, ExoVitals remains fully operational via deterministic local triage.

**Git Rule:** Never commit directly to `main`. Develop on scoped branches (`fix/...`, `feat/...`, `chore/...`) verified by [`.github/workflows/ci.yml`](.github/workflows/ci.yml) before opening a Pull Request.
