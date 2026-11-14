'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Group, Matrix4, Mesh, Plane, ShaderMaterial, Vector3 } from 'three';
import type { BufferGeometry, Material } from 'three';
import {
  BODY_HOTSPOTS,
  BODY_MODEL,
  WIREFRAME_MODEL,
  type BodySystemId,
} from './modelCatalog';
import { MAX_ZONES, hologramParams } from './hologramMaterial';
import LoadingOverlay from './LoadingOverlay';
import { useNormalizedScene } from './NormalizedModel';

/* ------------------------------------------------------------------ */
/* Tipos públicos                                                      */
/* ------------------------------------------------------------------ */

export type Stage = 'intro' | 'explore';
export type Layer = 'anatomy' | 'hologram';

export interface Anomaly {
  id: BodySystemId;
  /** 1 = precaución, 2 = crítico */
  severity: 1 | 2;
}

export interface BodyMarker {
  id: BodySystemId;
  number: number;
  title: string;
  statusLabel: string;
  icon: string;
  color: string;
  metric: string;
  critical: boolean;
}

/** Duración de la vuelta de 360° del escaneo inicial. */
export const INTRO_MS = 9000;
const MATERIALIZE_SPEED = 1.4; // unidades de altura por segundo
const FLY_MS = 1100;
const HOME_CAMERA = new Vector3(0, 0.1, 4.1);
const HOME_TARGET = new Vector3(0, 0, 0);
const INTRO_RADIUS = 3.7;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------------------------------------------ */
/* Cuerpo holográfico (wireframe)                                      */
/* ------------------------------------------------------------------ */

interface FrameState {
  scanY: number;
  cutY: number;
  time: number;
  reveal: number[];
}

function HologramBody({ frame, anomalies }: {
  frame: React.RefObject<FrameState>;
  anomalies: Anomaly[];
}) {
  const { object, scale, offset } = useNormalizedScene(WIREFRAME_MODEL.url, { size: 2 });
  const fillRef = useRef<ShaderMaterial>(null);
  const wireRef = useRef<ShaderMaterial>(null);
  const fillParams = useMemo(() => hologramParams({ wire: false }), []);
  const wireParams = useMemo(() => hologramParams({ wire: true }), []);

  // Geometría + transformación local de cada malla del modelo.
  const parts = useMemo(() => {
    const list: { geometry: BufferGeometry; matrix: Matrix4 }[] = [];
    object.updateMatrixWorld(true);
    object.traverse((o) => {
      if (o instanceof Mesh) list.push({ geometry: o.geometry, matrix: o.matrixWorld.clone() });
    });
    return list;
  }, [object]);

  useFrame(() => {
    const f = frame.current;
    for (const mat of [fillRef.current, wireRef.current]) {
      if (!mat) continue;
      const u = mat.uniforms;
      u.uTime.value = f.time;
      u.uScanY.value = f.scanY;
      u.uCutY.value = f.cutY;
      for (let i = 0; i < MAX_ZONES; i++) {
        const a = anomalies[i];
        const v = u.uZones.value[i];
        if (a) {
          const [x, y, z] = BODY_HOTSPOTS[a.id].position;
          v.set(x, y, z * 0.6, a.severity);
        } else {
          v.set(0, 0, 0, 0);
        }
        u.uReveal.value[i] = f.reveal[i] ?? 0;
      }
    }
  });

  return (
    <group scale={scale}>
      <group position={offset}>
        {parts.map((p, i) => (
          <group key={i} matrix={p.matrix} matrixAutoUpdate={false}>
            <mesh geometry={p.geometry} renderOrder={1}>
              <shaderMaterial ref={fillRef} {...fillParams} />
            </mesh>
            <mesh geometry={p.geometry} renderOrder={2}>
              <shaderMaterial ref={wireRef} {...wireParams} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Cuerpo anatómico (músculos) que se materializa con un plano de corte */
/* ------------------------------------------------------------------ */

function AnatomyBody({ frame }: { frame: React.RefObject<FrameState> }) {
  const { object, scale, offset } = useNormalizedScene(BODY_MODEL.url, {
    size: 2,
    cloneMaterials: true,
  });
  const root = useRef<Group>(null);
  // Conserva lo que queda por debajo de la línea de corte (y ≤ cutY).
  const plane = useRef(new Plane(new Vector3(0, -1, 0), -10));
  const wired = useRef(false);

  useFrame(() => {
    plane.current.constant = frame.current.cutY;
    if (!wired.current && root.current) {
      root.current.traverse((o) => {
        if (o instanceof Mesh) {
          const mats = (Array.isArray(o.material) ? o.material : [o.material]) as Material[];
          for (const m of mats) m.clippingPlanes = [plane.current];
        }
      });
      wired.current = true;
    }
    if (root.current) root.current.visible = frame.current.cutY > -1.05;
  });

  return (
    <group ref={root} scale={scale}>
      <group position={offset}>
        <primitive object={object} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Faros de anomalía sobre la anatomía                                 */
/* ------------------------------------------------------------------ */

function AnomalyBeacon({ anomaly, frame }: { anomaly: Anomaly; frame: React.RefObject<FrameState> }) {
  const core = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const critical = anomaly.severity === 2;
  const [x, y, z] = BODY_HOTSPOTS[anomaly.id].position;

  useFrame(() => {
    const t = frame.current.time;
    const shown = frame.current.cutY > y ? 1 : 0;
    const speed = critical ? 6.4 : 3.2;
    if (core.current) {
      const s = (0.85 + 0.25 * Math.sin(t * speed)) * shown;
      core.current.scale.setScalar(Math.max(s, 0.0001));
    }
    // Sólo lo crítico emite la onda expansiva; la precaución late sin onda.
    if (ring.current) {
      const p = (t * 0.9) % 1;
      ring.current.scale.setScalar(Math.max((0.7 + p * 1.1) * shown * (critical ? 1 : 0), 0.0001));
      (ring.current.material as Material & { opacity: number }).opacity = (1 - p) * 0.55;
    }
  });

  return (
    <group position={[x, y, z]}>
      <mesh ref={core} renderOrder={5}>
        <sphereGeometry args={[critical ? 0.07 : 0.045, 24, 16]} />
        <meshBasicMaterial color={critical ? '#ff3b2f' : '#ffa23a'} transparent opacity={0.45} depthTest={false} />
      </mesh>
      <mesh ref={ring} renderOrder={5}>
        <sphereGeometry args={[0.07, 24, 16]} />
        <meshBasicMaterial color="#ff3b2f" transparent opacity={0.5} depthTest={false} wireframe />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Marcadores (HTML anclado a 3D)                                       */
/* ------------------------------------------------------------------ */

function Marker({ marker, selected, onSelect, hidden }: {
  marker: BodyMarker;
  selected: boolean;
  onSelect: (id: BodySystemId) => void;
  hidden: boolean;
}) {
  const { position, side, labelDy } = BODY_HOTSPOTS[marker.id];
  // Sin `center`: el ancla (0×0) cae justo sobre el punto 3D.
  return (
    <Html position={position} zIndexRange={[20, 0]}>
      <button
        type="button"
        className={`body3d-marker${side < 0 ? ' is-left' : ''}${selected ? ' is-selected' : ''}${marker.critical ? ' is-critical' : ''}`}
        hidden={hidden}
        tabIndex={hidden ? -1 : 0}
        style={{ ['--status' as string]: marker.color, ['--dy' as string]: `${labelDy}px` }}
        aria-pressed={selected}
        aria-label={`${marker.title}: ${marker.statusLabel}. ${marker.metric}`}
        onClick={() => onSelect(marker.id)}
      >
        <span className="body3d-dot" aria-hidden>
          {marker.icon}
          <span className="body3d-num">{marker.number}</span>
        </span>
        <span className="body3d-lead" aria-hidden />
        <span className="body3d-label" aria-hidden>
          <strong>{marker.title}</strong>
          <em>{marker.statusLabel} · {marker.metric}</em>
        </span>
      </button>
    </Html>
  );
}

/* ------------------------------------------------------------------ */
/* Director: cámara, escáner, detección y materialización               */
/* ------------------------------------------------------------------ */

function Director({
  stage,
  layer,
  anomalies,
  selected,
  homeKey,
  introKey,
  reduced,
  markers,
  onSelect,
  onDetect,
  onProgress,
  onIntroDone,
}: {
  stage: Stage;
  layer: Layer;
  anomalies: Anomaly[];
  selected: BodySystemId;
  homeKey: number;
  introKey: number;
  reduced: boolean;
  markers: BodyMarker[];
  onSelect: (id: BodySystemId) => void;
  onDetect: (id: BodySystemId) => void;
  onProgress: (pct: number) => void;
  onIntroDone: () => void;
}) {
  // Estado de animación compartido: sólo el director lo escribe; los cuerpos lo leen.
  const frame = useRef<FrameState>({ scanY: 10, cutY: -10, time: 0, reveal: new Array(MAX_ZONES).fill(0) });
  const controls = useRef<OrbitControlsImpl | null>(null);
  const introStart = useRef(0);
  const detected = useRef(new Set<BodySystemId>());
  const done = useRef(false);
  const lastPct = useRef(-1);
  const fly = useRef<{ start: number; fromPos: Vector3; fromTarget: Vector3; toPos: Vector3; toTarget: Vector3 } | null>(null);
  const prevSelected = useRef<BodySystemId | null>(null);
  const prevHome = useRef(homeKey);
  const prevStage = useRef<Stage>(stage);

  // Reinicia el escaneo cuando cambia introKey.
  useEffect(() => {
    introStart.current = performance.now();
    detected.current = new Set();
    done.current = false;
    lastPct.current = -1;
    frame.current.reveal = new Array(MAX_ZONES).fill(0);
  }, [introKey]);

  useFrame((state, delta) => {
    const f = frame.current;
    const now = performance.now();
    f.time += delta;
    const cam = state.camera;

    if (stage === 'intro') {
      const t = reduced ? 1 : Math.min(1, (now - introStart.current) / INTRO_MS);
      const angle = ease(t) * Math.PI * 2;
      cam.position.set(Math.sin(angle) * INTRO_RADIUS, 0.25 + Math.sin(t * Math.PI) * 0.35, Math.cos(angle) * INTRO_RADIUS);
      cam.lookAt(0, 0.05, 0);

      // El escáner baja de la cabeza a los pies durante el 85 % de la vuelta.
      const scanT = Math.min(1, t / 0.85);
      f.scanY = t >= 1 ? 10 : 1.08 - scanT * 2.2;
      f.cutY = -10;

      anomalies.forEach((a, i) => {
        const y = BODY_HOTSPOTS[a.id].position[1];
        if (!detected.current.has(a.id) && f.scanY <= y + 0.02) {
          detected.current.add(a.id);
          onDetect(a.id);
        }
        const target = detected.current.has(a.id) ? 1 : 0;
        f.reveal[i] += (target - f.reveal[i]) * Math.min(1, delta * 4);
      });

      const pct = Math.round(t * 100);
      if (pct !== lastPct.current && (pct % 2 === 0 || pct === 100)) {
        lastPct.current = pct;
        onProgress(pct);
      }
      if (t >= 1 && !done.current) {
        done.current = true;
        onIntroDone();
      }
      prevStage.current = stage;
      return;
    }

    // ---- Exploración ----
    f.scanY = 10;
    anomalies.forEach((_, i) => {
      f.reveal[i] += (1 - f.reveal[i]) * Math.min(1, delta * 4);
    });

    const targetCut = layer === 'anatomy' ? 1.25 : -1.25;
    if (reduced) f.cutY = targetCut;
    else if (f.cutY < targetCut) f.cutY = Math.min(targetCut, Math.max(f.cutY, -1.1) + delta * MATERIALIZE_SPEED);
    else f.cutY = Math.max(targetCut, f.cutY - delta * MATERIALIZE_SPEED);

    const c = controls.current;
    if (!c) return;

    // Al entrar desde la intro, o al pedir "vista completa": volver a casa.
    if (prevStage.current !== stage || prevHome.current !== homeKey) {
      prevStage.current = stage;
      prevHome.current = homeKey;
      prevSelected.current = selected;
      fly.current = { start: now, fromPos: cam.position.clone(), fromTarget: c.target.clone(), toPos: HOME_CAMERA.clone(), toTarget: HOME_TARGET.clone() };
    } else if (prevSelected.current !== selected) {
      // Elegir un sistema acerca la cámara a esa zona.
      prevSelected.current = selected;
      const [x, y, z] = BODY_HOTSPOTS[selected].position;
      const toTarget = new Vector3(x * 0.5, y * 0.85, 0);
      const fromBack = z < 0;
      const toPos = toTarget.clone().add(new Vector3(x * 0.8, 0.12, fromBack ? -2.3 : 2.3));
      fly.current = { start: now, fromPos: cam.position.clone(), fromTarget: c.target.clone(), toPos, toTarget };
    }

    if (fly.current) {
      const k = reduced ? 1 : Math.min(1, (now - fly.current.start) / FLY_MS);
      const e = ease(k);
      cam.position.lerpVectors(fly.current.fromPos, fly.current.toPos, e);
      c.target.lerpVectors(fly.current.fromTarget, fly.current.toTarget, e);
      if (k >= 1) fly.current = null;
    }
    c.update();
  });

  return (
    <>
      <Suspense fallback={null}>
        <HologramBody frame={frame} anomalies={anomalies} />
        <AnatomyBody frame={frame} />
        {stage === 'explore' &&
          anomalies.map((a) => <AnomalyBeacon key={a.id} anomaly={a} frame={frame} />)}
        {/* Siempre montados (desmontar <Html> durante el render dispara avisos de
            React 19); durante el escaneo sólo se ocultan. */}
        {markers.map((m) => (
          <Marker key={m.id} marker={m} selected={m.id === selected} onSelect={onSelect} hidden={stage !== 'explore'} />
        ))}
      </Suspense>
      <OrbitControls
      ref={controls}
      enabled={stage === 'explore'}
      enablePan={false}
      minDistance={1.3}
      maxDistance={5.5}
      minPolarAngle={Math.PI * 0.25}
      maxPolarAngle={Math.PI * 0.75}
      enableDamping={!reduced}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Componente público                                                  */
/* ------------------------------------------------------------------ */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function BodyExperience({
  stage,
  layer,
  anomalies,
  markers,
  selected,
  onSelect,
  homeKey,
  introKey,
  onDetect,
  onProgress,
  onIntroDone,
}: {
  stage: Stage;
  layer: Layer;
  anomalies: Anomaly[];
  markers: BodyMarker[];
  selected: BodySystemId;
  onSelect: (id: BodySystemId) => void;
  homeKey: number;
  introKey: number;
  onDetect: (id: BodySystemId) => void;
  onProgress: (pct: number) => void;
  onIntroDone: () => void;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className={`xp-canvas${stage === 'explore' ? ' is-explore' : ''}`}>
      <Canvas
        camera={{ position: [0, 0.25, INTRO_RADIUS], fov: 34 }}
        dpr={[1, 2]}
        gl={{ antialias: true, localClippingEnabled: true }}
        aria-label="Cuerpo 3D del tripulante"
      >
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#dfe9ff', '#1a1208', 0.6]} />
        <directionalLight position={[2.5, 3, 3]} intensity={1.6} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.9} color="#00a8e8" />

        <Director
          stage={stage}
          layer={layer}
          anomalies={anomalies}
          selected={selected}
          homeKey={homeKey}
          introKey={introKey}
          reduced={reduced}
          markers={markers}
          onSelect={onSelect}
          onDetect={onDetect}
          onProgress={onProgress}
          onIntroDone={onIntroDone}
        />
      </Canvas>
      <LoadingOverlay label="Cargando cuerpo 3D…" />
    </div>
  );
}

export default BodyExperience;
