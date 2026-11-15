'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import SensorSimulator from '../../components/SensorSimulator';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { advanceOutboxPackets } from '../../store/useOutboxStore';
import { evaluateRulesWithTrace } from '../../utils/clinicalEngine';
import { runLocalTriage } from '../../utils/localTriage';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'PASS' | 'ERROR';
  testName: string;
  status?: number;
  details: string;
}

export default function QAStressTestDashboard() {
  const telemetryState = useTelemetryStore();
  const {
    heartRate,
    spO2,
    cistatinaC,
    creatinina,
    calcioIonico,
    linfocitos,
    neutrofilos,
    cortisol,
    co2Level,
    radiationRate,
    radiationAccumulated,
    isEmergency,
    isRenalWarning,
    isRadiationWarning,
    isCo2Warning,
    updateSensors,
    simulateScenario,
  } = telemetryState;

  // MÓDULO 4: Medidor de fluctuación de Heart Rate (Tick Test)
  const prevHeartRateRef = useRef<number>(heartRate);
  const [hrDelta, setHrDelta] = useState<number>(0);
  const [deltaHistory, setDeltaHistory] = useState<number[]>([]);
  const [tickCount, setTickCount] = useState<number>(0);

  useEffect(() => {
    const diff = heartRate - prevHeartRateRef.current;
    prevHeartRateRef.current = heartRate;
    setHrDelta(diff);
    setTickCount((prev) => prev + 1);
    setDeltaHistory((prev) => [diff, ...prev].slice(0, 10));
  }, [heartRate]);

  // MÓDULO 3: Estados para Pruebas de Fallo y Resiliencia de API
  const [customQuery, setCustomQuery] = useState<string>('');
  const [isApiTesting, setIsApiTesting] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [errorLogs, setErrorLogs] = useState<AuditLogEntry[]>([]);

  const appendLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString(),
    };

    setAuditLogs((prev) => [newEntry, ...prev]);

    if (entry.level === 'ERROR') {
      setErrorLogs((prev) => [newEntry, ...prev]);
    }
  };

  // MÓDULO 2: Handlers de Edge Cases Clínicos
  const handleInjectNegativeValues = () => {
    updateSensors({
      co2Level: -500,
      heartRate: -10,
    });

    const afterState = useTelemetryStore.getState();
    appendLog({
      level: 'PASS',
      testName: 'EDGE CASE: Inyección de Valores Negativos',
      details: `co2Level=${afterState.co2Level}, heartRate=${afterState.heartRate} | Sin crash de runtime. Alertas: CO2=${afterState.isCo2Warning}, Renal=${afterState.isRenalWarning}, Rad=${afterState.isRadiationWarning}`,
    });
  };

  const handleRenalFalsePositiveTest = () => {
    updateSensors({
      creatinina: 3.0,
      cistatinaC: 0.2,
      calcioIonico: 1.1,
    });

    const afterState = useTelemetryStore.getState();
    const passed = afterState.isRenalWarning === false;

    appendLog({
      level: passed ? 'PASS' : 'ERROR',
      testName: 'EDGE CASE: Falso Positivo Renal (Creatinina 3.0 / Cistatina C 0.2)',
      details: `isRenalWarning=${afterState.isRenalWarning} (Esperado: false). Ratio CisC/Cr=${(
        afterState.cistatinaC / afterState.creatinina
      ).toFixed(3)}. Cistatina C gobierna correctamente la regla renal en 0G.`,
    });
  };

  const handleIsolatedImmunosuppressionTest = () => {
    updateSensors({
      linfocitos: 600,
      neutrofilos: 4200, // NLR = 7.0 (> 3.5) y Linfocitos < 1200
      radiationRate: 0, // Tasa instantánea en 0 µSv/h
      radiationAccumulated: 0, // Radiación acumulada en 0 mSv
    });

    const afterState = useTelemetryStore.getState();
    const passed = afterState.isRadiationWarning === false;

    appendLog({
      level: passed ? 'PASS' : 'ERROR',
      testName: 'EDGE CASE: Inmunosupresión Aislada (Rad = 0 mSv)',
      details: `isRadiationWarning=${afterState.isRadiationWarning} (Esperado: false). NLR=${(
        afterState.neutrofilos / afterState.linfocitos
      ).toFixed(2)}, Linfocitos=${afterState.linfocitos}, Rate=${afterState.radiationRate} µSv/h, Rad=${afterState.radiationAccumulated} mSv.`,
    });
  };

  // MÓDULO 3: Handlers de Resiliencia de API (/api/triage)
  const handleEmptyPayloadTest = async () => {
    setIsApiTesting(true);
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = (await res.json()) as { error?: string; response?: string };

      if (!res.ok) {
        appendLog({
          level: 'ERROR',
          testName: 'TEST API: Payload Vacío (HTTP 400 Esperado)',
          status: res.status,
          details: `Status ${res.status} capturado correctamente -> ${JSON.stringify(data)}`,
        });
      } else {
        appendLog({
          level: 'INFO',
          testName: 'TEST API: Payload Vacío',
          status: res.status,
          details: `Respuesta inesperada 200 OK: ${JSON.stringify(data)}`,
        });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Excepción de red desconocida';
      appendLog({
        level: 'ERROR',
        testName: 'TEST API: Payload Vacío (Excepción Fetch)',
        details: message,
      });
    } finally {
      setIsApiTesting(false);
    }
  };

  const handleGiantPromptTest = async () => {
    setIsApiTesting(true);
    try {
      const baseChunk =
        'ALERTA BIOMÉTRICA ESPACIAL: Mareo vestibular severo en microgravedad, hipercapnia subclínica y fatiga muscular. ';
      const giantPrompt = baseChunk.repeat(50).slice(0, 5000);
      const currentTelemetry = useTelemetryStore.getState();

      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: giantPrompt,
          telemetry: currentTelemetry,
        }),
      });

      const data = (await res.json()) as { error?: string; response?: string };

      if (!res.ok) {
        appendLog({
          level: 'ERROR',
          testName: `TEST API: Prompt Gigante (${giantPrompt.length} chars)`,
          status: res.status,
          details: `Fallo HTTP ${res.status}: ${data.error ?? 'Sin detalle'}`,
        });
      } else {
        appendLog({
          level: 'PASS',
          testName: `TEST API: Prompt Gigante (${giantPrompt.length} chars)`,
          status: res.status,
          details: `Gemini procesó 5000 chars exitosamente. Respuesta (${
            data.response?.length ?? 0
          } chars): "${data.response?.slice(0, 220)}..."`,
        });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Error de red en Prompt Gigante';
      appendLog({
        level: 'ERROR',
        testName: 'TEST API: Prompt Gigante (Catch)',
        details: message,
      });
    } finally {
      setIsApiTesting(false);
    }
  };

  const handleNetworkStressTest = async () => {
    setIsApiTesting(true);
    const currentTelemetry = useTelemetryStore.getState();

    try {
      const concurrentRequests = Array.from({ length: 5 }, (_, idx) =>
        fetch('/api/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `[STRESS-TEST REQ #${idx + 1}] Reporte rápido de signos vitales y protocolo de emergencia.`,
            telemetry: currentTelemetry,
          }),
        }).then(async (res) => {
          const payload = (await res.json()) as {
            response?: string;
            error?: string;
          };
          return {
            index: idx + 1,
            ok: res.ok,
            status: res.status,
            payload,
          };
        })
      );

      const results = await Promise.all(concurrentRequests);

      results.forEach((item) => {
        if (!item.ok) {
          appendLog({
            level: 'ERROR',
            testName: `TEST ESTRÉS DE RED [Req #${item.index}/5]`,
            status: item.status,
            details: `Backend capturó fallo con HTTP ${item.status} sin caer: ${
              item.payload.error ?? 'Rate limit / Server Error'
            }`,
          });
        } else {
          appendLog({
            level: 'PASS',
            testName: `TEST ESTRÉS DE RED [Req #${item.index}/5]`,
            status: item.status,
            details: `HTTP ${item.status} OK -> ${item.payload.response?.slice(
              0,
              120
            )}...`,
          });
        }
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Excepción crítica en Promise.all';
      appendLog({
        level: 'ERROR',
        testName: 'TEST ESTRÉS DE RED (Excepción Global)',
        details: message,
      });
    } finally {
      setIsApiTesting(false);
    }
  };

  const handleCustomMiniChat = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customQuery.trim() || isApiTesting) return;

    setIsApiTesting(true);
    const currentTelemetry = useTelemetryStore.getState();

    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: customQuery,
          telemetry: currentTelemetry,
        }),
      });

      const data = (await res.json()) as { response?: string; error?: string };

      if (!res.ok) {
        appendLog({
          level: 'ERROR',
          testName: 'MINI-CHAT QA (Fallo Endpoint)',
          status: res.status,
          details: `HTTP ${res.status}: ${data.error ?? 'Error desconocido'}`,
        });
      } else {
        appendLog({
          level: 'PASS',
          testName: `MINI-CHAT QA ("${customQuery.slice(0, 35)}")`,
          status: res.status,
          details: data.response ?? 'Sin contenido',
        });
      }
      setCustomQuery('');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Fallo de red en Mini-Chat QA';
      appendLog({
        level: 'ERROR',
        testName: 'MINI-CHAT QA (Excepción Fetch)',
        details: message,
      });
    } finally {
      setIsApiTesting(false);
    }
  };

  const handleOfflineOutboxAndTriageTest = async () => {
    setIsApiTesting(true);
    try {
      const sampleBioEnv = {
        heartRate: 84,
        spO2: 98,
        cistatinaC: 0.9,
        creatinina: 1.0,
        calcioIonico: 1.15,
        linfocitos: 1500,
        neutrofilos: 3000,
        cortisol: 12,
        co2Level: 4300,
        radiationRate: 15,
        radiationAccumulated: 45,
        isEmergency: false,
      };
      const traces = evaluateRulesWithTrace(sampleBioEnv);
      const localReport = runLocalTriage(sampleBioEnv, traces, 'es', 'cefalea intensa');
      const triageOk = localReport.matchedProtocolIds.includes('R3_CO2_SUBCLINICAL');

      const pktList = advanceOutboxPackets(
        [
          {
            id: 'qa-mars-1',
            kind: 'SBAR_REPORT',
            title: 'QA Mars SBAR',
            missionProfileId: 'MARS_CONJUNCTION',
            priority: 'priority',
            payload: localReport.sbarSummary,
            createdAtMs: 1000,
            oneWayLatencySec: 1200,
            remainingSec: 1200,
            status: 'queued',
            attempts: 0,
          },
        ],
        {
          deltaRealSec: 2.5,
          speedup: 600,
          offline: false,
          conjunctionBlackout: false,
          nowMs: 3500,
        }
      );
      const outboxOk = pktList[0]?.status === 'delivered';

      const offlineRes = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test link loss',
          telemetry: sampleBioEnv,
          simulateOffline: true,
        }),
      });
      const offlineApiOk = offlineRes.status === 503;

      appendLog({
        level: triageOk && outboxOk && offlineApiOk ? 'PASS' : 'ERROR',
        testName: 'TEST P4: Triaje Local Offline + Outbox Mars (×600) + API 503',
        status: offlineRes.status,
        details: `LocalTriage=${triageOk}, OutboxDelivered=${outboxOk}, SimulatedOfflineHTTP=${offlineRes.status}.`,
      });
    } catch (error: unknown) {
      appendLog({
        level: 'ERROR',
        testName: 'TEST P4 (Excepción)',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsApiTesting(false);
    }
  };

  const rawSerializableState = {
    heartRate,
    spO2,
    cistatinaC,
    creatinina,
    calcioIonico,
    linfocitos,
    neutrofilos,
    cortisol,
    co2Level,
    radiationRate,
    radiationAccumulated,
    isEmergency,
    isRenalWarning,
    isRadiationWarning,
    isCo2Warning,
  };

  const isHrDeltaWithinSpec = Math.abs(hrDelta) <= 5;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-mono p-6 lg:p-10">
      {/* MÓDULO 4 (Componente Invisible Activo a 1 Hz) */}
      <SensorSimulator />

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Cabecera QA */}
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-400">
              EXO-QA // AUTOMATION &amp; EDGE-CASE STRESS SUITE
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-white">
              EXOVITALS — LEAD ARCHITECT STRESS CONSOLE
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => simulateScenario('RESET')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold uppercase tracking-wider text-emerald-400 transition cursor-pointer"
            >
              Reset Store Base
            </button>
            <span className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
              Storage Key:{' '}
              <strong className="text-cyan-400">exovitals-core-storage</strong>
            </span>
          </div>
        </header>

        {/* Grid de los 4 Módulos Críticos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* MÓDULO 1: Monitor de Estado y Persistencia (Zustand) */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-cyan-400 block">
                    MÓDULO 01
                  </span>
                  <h2 className="text-lg font-bold text-white">
                    Monitor de Estado y Persistencia (Zustand)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow"
                >
                  Recargar Página (Test Persistencia)
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Inspección en crudo del estado global sincronizado con{' '}
                <code>localStorage</code>. Modifica métricas en el Módulo 2 y
                recarga la página para verificar hidratación persistente.
              </p>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-x-auto max-h-80">
                <pre className="text-xs text-emerald-400 leading-relaxed">
                  {JSON.stringify(rawSerializableState, null, 2)}
                </pre>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs">
              <div
                className={`p-2 rounded border ${
                  isRenalWarning
                    ? 'bg-red-950/80 border-red-600 text-red-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-emerald-400'
                }`}
              >
                RENAL: {String(isRenalWarning).toUpperCase()}
              </div>
              <div
                className={`p-2 rounded border ${
                  isRadiationWarning
                    ? 'bg-red-950/80 border-red-600 text-red-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-emerald-400'
                }`}
              >
                RAD: {String(isRadiationWarning).toUpperCase()}
              </div>
              <div
                className={`p-2 rounded border ${
                  isCo2Warning
                    ? 'bg-red-950/80 border-red-600 text-red-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-emerald-400'
                }`}
              >
                CO2: {String(isCo2Warning).toUpperCase()}
              </div>
              <div
                className={`p-2 rounded border ${
                  isEmergency
                    ? 'bg-red-950/80 border-red-600 text-red-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-emerald-400'
                }`}
              >
                EMERG: {String(isEmergency).toUpperCase()}
              </div>
            </div>
          </section>

          {/* MÓDULO 2: Pruebas de Estrés del Motor Clínico (Edge Cases) */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-[11px] uppercase tracking-widest text-amber-400 block">
                MÓDULO 02
              </span>
              <h2 className="text-lg font-bold text-white">
                Pruebas de Estrés del Motor Clínico (Edge Cases)
              </h2>
            </div>

            <p className="text-xs text-slate-400">
              Inyección directa a <code>updateSensors()</code> con valores
              corruptos, extremos o casos clínicos disociados para auditar la
              determinística de <code>evaluateTelemetry()</code>.
            </p>

            <div className="space-y-3">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-rose-400">
                    1. Inyectar Valores Negativos
                  </p>
                  <p className="text-xs text-slate-400">
                    Envía <code>co2Level: -500</code>,{' '}
                    <code>heartRate: -10</code>. Verifica ausencia de crash.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleInjectNegativeValues}
                  className="px-4 py-2.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-600 text-rose-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer shrink-0"
                >
                  Inyectar Valores Negativos
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-amber-400">
                    2. Falso Positivo Renal (Sarcopenia vs Daño Real)
                  </p>
                  <p className="text-xs text-slate-400">
                    Envía <code>creatinina: 3.0</code>,{' '}
                    <code>cistatinaC: 0.2</code>, <code>calcioIonico: 1.1</code>
                    . <code>isRenalWarning</code> DEBE ser <code>false</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRenalFalsePositiveTest}
                  className="px-4 py-2.5 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-600 text-amber-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer shrink-0"
                >
                  Falso Positivo Renal
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-purple-400">
                    3. Inmunosupresión Aislada (Sin Radiación)
                  </p>
                  <p className="text-xs text-slate-400">
                    Envía <code>linfocitos: 600</code>,{' '}
                    <code>neutrofilos: 4200</code>,{' '}
                    <code>radiationAccumulated: 0</code>.{' '}
                    <code>isRadiationWarning</code> DEBE ser <code>false</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleIsolatedImmunosuppressionTest}
                  className="px-4 py-2.5 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-600 text-purple-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer shrink-0"
                >
                  Inmunosupresión Aislada
                </button>
              </div>
            </div>
          </section>

          {/* MÓDULO 3: Pruebas de Fallo del Copiloto IA (API Resilience) */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-rose-400 block">
                  MÓDULO 03
                </span>
                <h2 className="text-lg font-bold text-white">
                  Pruebas de Fallo del Copiloto IA (API Resilience)
                </h2>
              </div>
              {isApiTesting && (
                <span className="text-xs text-amber-400 animate-pulse font-bold">
                  EJECUTANDO VECTOR DE ATAQUE...
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Batería de pruebas contra <code>POST /api/triage</code> para
              validar manejo de errores 400/500, truncamiento de tokens y
              ráfagas concurrentes (<code>Promise.all</code>).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                disabled={isApiTesting}
                onClick={handleEmptyPayloadTest}
                className="p-3 rounded-lg bg-red-950/70 hover:bg-red-900/80 disabled:opacity-50 border border-red-600 text-red-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Test: Payload Vacío (400)
              </button>

              <button
                type="button"
                disabled={isApiTesting}
                onClick={handleGiantPromptTest}
                className="p-3 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 disabled:opacity-50 border border-amber-600 text-amber-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Test: Prompt Gigante (5000 chars)
              </button>

              <button
                type="button"
                disabled={isApiTesting}
                onClick={handleNetworkStressTest}
                className="p-3 rounded-lg bg-fuchsia-950/70 hover:bg-fuchsia-900/80 disabled:opacity-50 border border-fuchsia-600 text-fuchsia-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Test: Estrés de Red (5x Promise.all)
              </button>

              <button
                type="button"
                disabled={isApiTesting}
                onClick={handleOfflineOutboxAndTriageTest}
                className="p-3 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 disabled:opacity-50 border border-cyan-600 text-cyan-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Test: Offline / Outbox / SBAR
              </button>
            </div>

            {/* Mini-Chat de Prueba Manual */}
            <form onSubmit={handleCustomMiniChat} className="flex gap-2 pt-2">
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="Mini-chat QA: inyectar prompt de prueba a /api/triage..."
                disabled={isApiTesting}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={isApiTesting || !customQuery.trim()}
                className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold uppercase cursor-pointer"
              >
                Probar
              </button>
            </form>

            {/* Consola Roja de Errores de Auditoría */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-red-400">
                  Div de Auditoría de Errores Capturados ({errorLogs.length})
                </p>
                {errorLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setErrorLogs([])}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Limpiar errores
                  </button>
                )}
              </div>

              <div className="bg-red-950/40 border border-red-700/80 rounded-lg p-3 h-40 overflow-y-auto space-y-2">
                {errorLogs.length === 0 ? (
                  <p className="text-xs text-red-300/60">
                    Sin errores capturados aún. Presiona &quot;Test: Payload
                    Vacío&quot; o &quot;Test: Estrés de Red&quot; para auditar
                    fallos HTTP 400/500.
                  </p>
                ) : (
                  errorLogs.map((err) => (
                    <div
                      key={err.id}
                      className="bg-red-950/90 border border-red-600 rounded p-2 text-xs text-red-200"
                    >
                      <div className="flex justify-between font-bold text-red-400">
                        <span>
                          [{err.timestamp}] {err.testName}
                        </span>
                        {err.status && <span>HTTP {err.status}</span>}
                      </div>
                      <p className="mt-1 break-words">{err.details}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* MÓDULO 4: Simulador de Hardware (Tick Test) */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-emerald-400 block">
                  MÓDULO 04
                </span>
                <h2 className="text-lg font-bold text-white">
                  Simulador de Hardware (1 Hz Tick &amp; Jitter Auditor)
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs">
                Ticks: {tickCount}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Verifica en tiempo real que el ruido inyectado por{' '}
              <code>&lt;SensorSimulator /&gt;</code> cada 1000 ms se mantenga
              acotado dentro del rango de seguridad <code>[-5, +5] bpm</code> y
              nunca diverja al infinito.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-400 uppercase">
                  Heart Rate Actual
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {heartRate} <span className="text-xs text-slate-400">bpm</span>
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-400 uppercase">
                  Fluctuación (Δ HR)
                </p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    isHrDeltaWithinSpec ? 'text-emerald-400' : 'text-red-500'
                  }`}
                >
                  {hrDelta > 0 ? `+${hrDelta}` : hrDelta}{' '}
                  <span className="text-xs text-slate-400">bpm/tick</span>
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-400 uppercase">
                  Estado de Ruido
                </p>
                <p
                  className={`text-sm font-bold mt-2 ${
                    isHrDeltaWithinSpec ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {isHrDeltaWithinSpec
                    ? 'NOMINAL (|Δ| <= 5 bpm)'
                    : 'CAMBIO BRUSCO (INYECCIÓN MANUAL)'}
                </p>
              </div>
            </div>

            {/* Medidor Visual de Fluctuación (-5 a +5 bpm) */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>-5 bpm</span>
                <span>0 bpm (Centro Gaussiano)</span>
                <span>+5 bpm</span>
              </div>
              <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-500" />
                <div
                  className={`absolute top-0 bottom-0 w-3 rounded-full transition-all duration-300 ${
                    isHrDeltaWithinSpec ? 'bg-emerald-400' : 'bg-red-500'
                  }`}
                  style={{
                    left: `calc(${Math.min(
                      100,
                      Math.max(0, ((hrDelta + 5) / 10) * 100)
                    )}% - 6px)`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Últimos 10 deltas (bpm):{' '}
                <span className="text-cyan-300">
                  {deltaHistory
                    .map((d) => (d > 0 ? `+${d}` : String(d)))
                    .join(' | ')}
                </span>
              </p>
            </div>
          </section>
        </div>

        {/* Bitácora General de Ejecución QA */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
              Bitácora General de Pruebas QA ({auditLogs.length} eventos)
            </h2>
            {auditLogs.length > 0 && (
              <button
                type="button"
                onClick={() => setAuditLogs([])}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Limpiar bitácora
              </button>
            )}
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">
                Ejecuta cualquier prueba de los Módulos 2 o 3 para registrar la
                traza de auditoría.
              </p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2.5 rounded border text-xs ${
                    log.level === 'ERROR'
                      ? 'bg-red-950/60 border-red-700 text-red-200'
                      : log.level === 'PASS'
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                      : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="flex justify-between font-bold">
                    <span>
                      [{log.timestamp}] [{log.level}] {log.testName}
                    </span>
                    {log.status && <span>HTTP {log.status}</span>}
                  </div>
                  <p className="mt-1 text-slate-300 break-words">
                    {log.details}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
