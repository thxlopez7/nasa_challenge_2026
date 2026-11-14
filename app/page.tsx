'use client';

import MedicalCopilot from '../components/MedicalCopilot';
import SensorSimulator from '../components/SensorSimulator';
import { useTelemetryStore } from '../store/useTelemetryStore';

export default function DevTelemetryDashboard() {
  const {
    heartRate,
    spO2,
    cistatinaC,
    creatinina,
    calcioIonico,
    linfocitos,
    neutrofilos,
    co2Level,
    radiationAccumulated,
    isEmergency,
    isRenalWarning,
    isRadiationWarning,
    isCo2Warning,
    simulateScenario,
    triggerCodeRed,
  } = useTelemetryStore();

  const nlr =
    linfocitos > 0 ? (neutrofilos / linfocitos).toFixed(2) : '0.00';
  const cistatinaCreatininaRatio =
    creatinina > 0 ? (cistatinaC / creatinina).toFixed(2) : '0.00';

  return (
    <main className="min-h-screen bg-slate-900 text-white font-mono p-6 lg:p-10">
      <SensorSimulator />

      <div className="max-w-7xl mx-auto space-y-8">
        <header className="border-b border-slate-700 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-400">
              NASA Space Apps Challenge 2026 // Edge-First CDSS
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              EXOVITALS — MISSION MEDICAL COMMAND
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              1 Hz TELEMETRY STREAM
            </span>
          </div>
        </header>

        {/* Layout Principal en Grid de 3 Columnas en Pantallas Grandes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Columna Izquierda (2/3): Telemetría, Motor Clínico y God Mode */}
          <div className="lg:col-span-2 space-y-6">
            {/* SECCIÓN 1: Telemetría en Vivo */}
            <section className="bg-slate-800/70 border border-slate-700 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
                1. Telemetría en Vivo
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">
                    Heart Rate (HR)
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {heartRate}{' '}
                    <span className="text-sm text-slate-400">bpm</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">SpO2: {spO2}%</p>
                </div>

                <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">Nivel CO2</p>
                  <p className="text-2xl font-bold mt-1">
                    {co2Level}{' '}
                    <span className="text-sm text-slate-400">ppm</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Umbral: &gt; 3500 ppm
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">
                    Cistatina C
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {cistatinaC.toFixed(2)}{' '}
                    <span className="text-sm text-slate-400">mg/L</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    CisC/Cr: {cistatinaCreatininaRatio} | Ca²⁺:{' '}
                    {calcioIonico.toFixed(2)}
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase">Linfocitos</p>
                  <p className="text-2xl font-bold mt-1">
                    {linfocitos}{' '}
                    <span className="text-sm text-slate-400">cél/µL</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    NLR: {nlr} | Rad: {radiationAccumulated} mSv
                  </p>
                </div>
              </div>
            </section>

            {/* SECCIÓN 2: Motor Clínico (RIDGE) */}
            <section className="bg-slate-800/70 border border-slate-700 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
                2. Motor Clínico (RIDGE)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between bg-slate-900/90 border border-slate-700 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-semibold">
                      Alerta Renal (Gravedad Alterada)
                    </p>
                    <p className="text-xs text-slate-400">
                      (CisC &gt; 1.15 &amp;&amp; CisC/Cr &gt; 1.2) || Ca²⁺ &gt;
                      1.32
                    </p>
                  </div>
                  <span
                    className={
                      isRenalWarning
                        ? 'text-red-500 font-bold text-lg'
                        : 'text-emerald-400 font-medium text-lg'
                    }
                  >
                    {String(isRenalWarning).toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-900/90 border border-slate-700 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-semibold">
                      Alerta Radiación (Inmunosupresión)
                    </p>
                    <p className="text-xs text-slate-400">
                      NLR &gt; 3.5 &amp;&amp; Linf &lt; 1200 &amp;&amp; Rad
                      &gt; 50
                    </p>
                  </div>
                  <span
                    className={
                      isRadiationWarning
                        ? 'text-red-500 font-bold text-lg'
                        : 'text-emerald-400 font-medium text-lg'
                    }
                  >
                    {String(isRadiationWarning).toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-900/90 border border-slate-700 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-semibold">
                      Alerta CO2 (Entorno Hostil)
                    </p>
                    <p className="text-xs text-slate-400">
                      CO2 &gt; 3500 ppm &amp;&amp; SpO2 &gt;= 96%
                    </p>
                  </div>
                  <span
                    className={
                      isCo2Warning
                        ? 'text-red-500 font-bold text-lg'
                        : 'text-emerald-400 font-medium text-lg'
                    }
                  >
                    {String(isCo2Warning).toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-900/90 border border-slate-700 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-semibold">
                      Emergencia Crítica (CODE RED)
                    </p>
                    <p className="text-xs text-slate-400">
                      Override manual o prioridad crítica de misión
                    </p>
                  </div>
                  <span
                    className={
                      isEmergency
                        ? 'text-red-500 font-bold text-lg'
                        : 'text-emerald-400 font-medium text-lg'
                    }
                  >
                    {String(isEmergency).toUpperCase()}
                  </span>
                </div>
              </div>
            </section>

            {/* SECCIÓN 3: Panel God Mode */}
            <section className="bg-slate-800/70 border border-slate-700 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">
                  3. Panel God Mode (Inyección de Escenarios)
                </h2>
                <button
                  type="button"
                  onClick={triggerCodeRed}
                  className="px-3 py-1.5 rounded bg-red-950 hover:bg-red-900 border border-red-600 text-red-300 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Trigger Code Red
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => simulateScenario('SOLAR_STORM')}
                  className="p-4 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500 text-amber-300 font-bold text-sm uppercase tracking-wider transition cursor-pointer text-left"
                >
                  <span className="block text-xs text-amber-400/80 mb-1">
                    Escenario 01
                  </span>
                  SOLAR_STORM
                </button>

                <button
                  type="button"
                  onClick={() => simulateScenario('CO2_LEAK')}
                  className="p-4 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500 text-purple-300 font-bold text-sm uppercase tracking-wider transition cursor-pointer text-left"
                >
                  <span className="block text-xs text-purple-400/80 mb-1">
                    Escenario 02
                  </span>
                  CO2_LEAK
                </button>

                <button
                  type="button"
                  onClick={() => simulateScenario('RENAL_DAMAGE')}
                  className="p-4 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500 text-rose-300 font-bold text-sm uppercase tracking-wider transition cursor-pointer text-left"
                >
                  <span className="block text-xs text-rose-400/80 mb-1">
                    Escenario 03
                  </span>
                  RENAL_DAMAGE
                </button>

                <button
                  type="button"
                  onClick={() => simulateScenario('RESET')}
                  className="p-4 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500 text-emerald-300 font-bold text-sm uppercase tracking-wider transition cursor-pointer text-left"
                >
                  <span className="block text-xs text-emerald-400/80 mb-1">
                    Restaurar Base
                  </span>
                  RESET
                </button>
              </div>
            </section>
          </div>

          {/* Columna Derecha (1/3): Chat Médico con IA */}
          <div className="lg:col-span-1">
            <MedicalCopilot />
          </div>
        </div>
      </div>
    </main>
  );
}
