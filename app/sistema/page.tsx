'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  MetricPanel,
  Panel,
  ProgressBar,
  StatusBadge,
  ICONS,
  IconBone,
  IconHeart,
  IconRadiation,
  IconRocket,
  IconSatellite,
  IconShield,
  IconPulse,
  type EvStatus,
} from '../../components/ui';
import type { ChartPoint } from '../../components/vitals/MiniChart';

/**
 * Sistema de diseño EXOVITALS: catálogo vivo de tokens y componentes con
 * sus estados. Página interna para el equipo (no forma parte del recorrido
 * del tripulante, por eso no lleva intro ni traducción).
 */

const SWATCHES = [
  { name: 'ev-base', hex: '#0B132B', use: 'Fondo de la app' },
  { name: 'ev-surface', hex: '#1C2541', use: 'Contenedores' },
  { name: 'ev-line', hex: '#2A3A5E', use: 'Bordes y divisores' },
  { name: 'ev-cyan', hex: '#00E5FF', use: 'Acción principal · datos activos' },
  { name: 'ev-amber', hex: '#FFB703', use: 'Precaución' },
  { name: 'ev-red', hex: '#FF3B4E', use: 'Crítico' },
  { name: 'ev-label', hex: '#8D99AE', use: 'Etiquetas y datos técnicos' },
];

/** Serie simulada que se mueve en vivo, para ver las tendencias de sesión. */
function useDemoSeries(base: number, amp: number, drift: number) {
  const [points, setPoints] = useState<ChartPoint[]>(() =>
    Array.from({ length: 40 }, (_, i) => ({ label: `T-${40 - i}s`, y: base + Math.sin(i / 4) * amp + i * drift }))
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      setPoints((p) => {
        const last = p[p.length - 1].y;
        const next = last + drift + (Math.random() - 0.5) * amp;
        return [...p.slice(1), { label: new Date().toLocaleTimeString(), y: next }];
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [amp, drift]);
  return points;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-ev-cyan">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<EvStatus>('nominal');
  const hr = useDemoSeries(72, 3, 0.05);
  const rad = useDemoSeries(28, 6, 1.2);
  const bone = useDemoSeries(1.1, 0.03, 0.004);

  const fakeAction = () => {
    setBusy(true);
    window.setTimeout(() => setBusy(false), 1400);
  };

  const radNow = rad[rad.length - 1].y;
  const radStatus: EvStatus = radNow > 100 ? 'critical' : radNow > 50 ? 'caution' : 'nominal';

  return (
    <main className="min-h-screen bg-ev-base text-white">
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
        <header className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-ev-cyan">EXOVITALS · Design System v1</p>
          <h1 className="font-brand text-4xl sm:text-5xl">Consola de misión</h1>
          <p className="font-lead max-w-2xl text-lg text-ev-label">
            Tokens y componentes para la telemetría de salud: modo oscuro estricto, cristal sutil, cian para lo
            activo, ámbar para la precaución y rojo para lo crítico. Todo vive en <code className="font-mono text-ev-cyan">components/ui</code>.
          </p>
          <Link href="/panel" className="inline-block font-mono text-xs uppercase tracking-[0.2em] text-ev-cyan hover:underline">
            ← Volver al panel
          </Link>
        </header>

        <Section id="color" title="01 · Color">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SWATCHES.map((s) => (
              <div key={s.name} className="ev-glass rounded-lg p-3">
                <div className="mb-3 h-12 rounded border border-white/10" style={{ background: s.hex }} />
                <p className="font-mono text-xs text-white">{s.name}</p>
                <p className="font-mono text-[11px] text-ev-label">{s.hex} · {s.use}</p>
              </div>
            ))}
          </div>
          <p className="font-mono text-[11px] text-ev-label">
            Las clases de Tailwind slate/cyan/amber/red de toda la app ya usan esta paleta (globals.css).
          </p>
        </Section>

        <Section id="type" title="02 · Tipografía">
          <div className="ev-glass space-y-3 rounded-lg p-5">
            <p className="font-brand text-4xl">EXOVITALS</p>
            <p className="text-2xl font-black">Título de panel · Roboto Condensed Black</p>
            <p className="font-lead text-lg text-ev-label">Entradilla · Roboto SemiCondensed Thin</p>
            <p>Texto corrido · Roboto Condensed ExtraLight</p>
            <p className="font-mono text-sm text-ev-label">DATO TÉCNICO · 1.32 mg/L · T+00:42:17 · mono</p>
          </div>
        </Section>

        <Section id="buttons" title="03 · Botones">
          <Panel code="UI-BTN" title="Estados de botón" subtitle="Default · Hover · Active (onda al clic) · Disabled · Cargando">
            <div className="space-y-5">
              {(['primary', 'secondary', 'danger', 'ghost'] as const).map((v) => (
                <div key={v} className="flex flex-wrap items-center gap-3">
                  <span className="w-24 font-mono text-[11px] uppercase text-ev-label">{v}</span>
                  <Button variant={v} icon={<IconRocket size={16} />}>Ejecutar</Button>
                  <Button variant={v} size="sm">Pequeño</Button>
                  <Button variant={v} disabled>Deshabilitado</Button>
                  <Button variant={v} loading={busy} onClick={fakeAction}>Enviar</Button>
                </div>
              ))}
            </div>
          </Panel>
        </Section>

        <Section id="status" title="04 · Estados e indicadores">
          <Panel code="UI-STS" title="Nominal · Precaución · Crítico" subtitle="Icono + forma + texto: nunca solo color">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status="nominal" />
              <StatusBadge status="caution" />
              <StatusBadge status="critical" />
              <StatusBadge status="nominal" live label="Enlace activo" />
              <StatusBadge status="critical" live label="Code Red" />
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <ProgressBar label="Carga ARED" value={82} valueText="82 %" status="nominal" />
              <ProgressBar label="CO2 cabina" value={3900} min={0} max={6000} valueText="3900 ppm" status="caution" cautionAt={3500} criticalAt={5000} />
              <ProgressBar label="Dosis acumulada" value={92} valueText="92 %" status="critical" cautionAt={60} criticalAt={85} />
            </div>
          </Panel>
        </Section>

        <Section id="cards" title="05 · Tarjetas">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setLoading((l) => !l)}>
              {loading ? 'Mostrar datos' : 'Simular carga'}
            </Button>
            {(['nominal', 'caution', 'critical'] as const).map((s) => (
              <Button key={s} variant={status === s ? 'primary' : 'ghost'} size="sm" onClick={() => setStatus(s)}>
                {s}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel
              code="SYS-01 · BIO"
              title="Biomarcadores"
              subtitle="Panel renal y mineral · cartucho POC"
              icon={<IconShield size={20} />}
              status={status}
              loading={loading}
              actions={<Button variant="ghost" size="sm">Detalle</Button>}
            >
              <dl className="grid grid-cols-3 gap-3 font-mono text-sm">
                <div><dt className="text-[10px] uppercase text-ev-label">CisC</dt><dd className="text-2xl font-thin">0.92</dd></div>
                <div><dt className="text-[10px] uppercase text-ev-label">Creat</dt><dd className="text-2xl font-thin">1.04</dd></div>
                <div><dt className="text-[10px] uppercase text-ev-label">Ca²⁺</dt><dd className="text-2xl font-thin">1.18</dd></div>
              </dl>
            </Panel>
            <Panel code="SYS-02 · COMMS" title="Enlace Tierra" subtitle="DSN · latencia 1.3 s" icon={<IconSatellite size={20} />} status="nominal" loading={loading}>
              <ProgressBar label="Cola de envíos" value={3} max={10} valueText="3 / 10" status="nominal" segments={10} />
            </Panel>
          </div>
        </Section>

        <Section id="metrics" title="06 · Paneles de métricas (en vivo)">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricPanel
              code="BIO-HR"
              label="Frecuencia cardíaca"
              icon={<IconHeart size={18} />}
              value={hr[hr.length - 1].y}
              unit="lpm"
              status="nominal"
              delta="▲ +2 lpm en 30 s · estable"
              range={{ min: 40, max: 160, cautionAt: 100, criticalAt: 130 }}
              trend={hr}
              threshold={100}
              loading={loading}
            />
            <MetricPanel
              code="ENV-RAD"
              label="Radiación"
              icon={<IconRadiation size={18} />}
              value={radNow}
              unit="µSv/h"
              digits={1}
              status={radStatus}
              delta={radStatus === 'nominal' ? '▲ subiendo' : '▲ evento de partículas solares'}
              range={{ min: 0, max: 160, cautionAt: 50, criticalAt: 100 }}
              trend={rad}
              threshold={50}
              loading={loading}
            />
            <MetricPanel
              code="BONE-CTX"
              label="Resorción ósea (CTX/NTX)"
              icon={<IconBone size={18} />}
              value={bone[bone.length - 1].y}
              unit="× basal"
              digits={2}
              status={bone[bone.length - 1].y > 1.3 ? 'caution' : 'nominal'}
              delta="Densidad ósea: −0,8 %/mes estimado"
              range={{ min: 0.6, max: 2, cautionAt: 1.3, criticalAt: 1.7 }}
              trend={bone}
              threshold={1.3}
              footnote="Microgravedad: pérdida típica 1–1,5 %/mes sin contramedidas."
              loading={loading}
            />
          </div>
        </Section>

        <Section id="icons" title="07 · Iconografía esquemática">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-10">
            {Object.entries(ICONS).map(([name, Icon]) => (
              <div key={name} className="ev-glass flex flex-col items-center gap-2 rounded-lg p-3 text-ev-cyan">
                <Icon size={26} />
                <span className="font-mono text-[9px] text-ev-label">{name.replace('Icon', '')}</span>
              </div>
            ))}
          </div>
          <p className="flex items-center gap-2 font-mono text-[11px] text-ev-label">
            <IconPulse size={16} className="text-ev-cyan" /> Trazo 1.5 sobre retícula de 24 px · heredan `currentColor`.
          </p>
        </Section>
      </div>
    </main>
  );
}
