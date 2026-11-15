'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
import { useT } from '../../i18n/I18nContext';

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
const INTRO_TARGET = new Vector3(0, 0.05, 0);
/** Más de estos píxeles entre pulsar y soltar = arrastre, no clic. */
const CLICK_TOLERANCE_PX = 6;

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

function HologramBody({ frame, anomalies, onActivate }: {
  frame: React.RefObject<FrameState>;
  anomalies: Anomaly[];
  /** Clic (no arrastre) sobre el holograma; sólo durante el escaneo. */
  onActivate?: () => void;
}) {
  // El cursor se cambia en el propio canvas del evento.
  const setCursor = (e: ThreeEvent<PointerEvent | MouseEvent>, c: string) => {
    const el = e.nativeEvent.target;
    if (el instanceof HTMLElement) el.style.cursor = c;
  };
  const handlers = onActivate
    ? {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta <= CLICK_TOLERANCE_PX) {
            setCursor(e, '');
            onActivate();
          }
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setCursor(e, 'pointer');
        },
        onPointerOut: (e: ThreeEvent<PointerEvent>) => setCursor(e, ''),
      }
    : {};
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
    <group scale={scale} {...handlers}>
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
/* Proyector 3D → DOM de marcadores (sin ReactDOM.createRoot)         */
/* ------------------------------------------------------------------ */

const PROJ_VEC = new Vector3();

function MarkerProjector({
  markers,
  active,
  markerMap,
}: {
  markers: BodyMarker[];
  active: boolean;
  markerMap: Map<BodySystemId, HTMLButtonElement | null>;
}) {
  const { camera, size } = useThree();

  useFrame(() => {
    for (const marker of markers) {
      const el = markerMap.get(marker.id);
      if (!el) continue;

      if (!active) {
        if (!el.hidden) el.hidden = true;
        continue;
      }

      const [x, y, z] = BODY_HOTSPOTS[marker.id].position;
      PROJ_VEC.set(x, y, z).project(camera);
      const visible = PROJ_VEC.z >= -1 && PROJ_VEC.z <= 1;

      if (!visible) {
        if (!el.hidden) el.hidden = true;
        continue;
      }

      if (el.hidden) el.hidden = false;
      const px = (PROJ_VEC.x * 0.5 + 0.5) * size.width;
      const py = (-PROJ_VEC.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
    }
  });

  return null;
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
  markerMap,
  onDetect,
  onProgress,
  onIntroDone,
  onBodyClick,
}: {
  stage: Stage;
  layer: Layer;
  anomalies: Anomaly[];
  selected: BodySystemId;
  homeKey: number;
  introKey: number;
  reduced: boolean;
  markers: BodyMarker[];
  markerMap: Map<BodySystemId, HTMLButtonElement | null>;
  onDetect: (id: BodySystemId) => void;
  onProgress: (pct: number) => void;
  onIntroDone: () => void;
  onBodyClick?: () => void;
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
  /** Durante el escaneo: el usuario ya tomó el control de la cámara. */
  const manual = useRef(false);

  // Reinicia el escaneo cuando cambia introKey.
  useEffect(() => {
    introStart.current = performance.now();
    detected.current = new Set();
    done.current = false;
    lastPct.current = -1;
    frame.current.reveal = new Array(MAX_ZONES).fill(0);
    manual.current = false;
  }, [introKey]);

  // Al tocar la escena durante el escaneo, la cámara pasa a ser del usuario.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const take = () => {
      manual.current = true;
    };
    c.addEventListener('start', take);
    return () => c.removeEventListener('start', take);
  }, []);

  useFrame((state, delta) => {
    const f = frame.current;
    const now = performance.now();
    f.time += delta;
    const cam = state.camera;

    if (stage === 'intro') {
      const t = reduced ? 1 : Math.min(1, (now - introStart.current) / INTRO_MS);
      const c = controls.current;
      if (!manual.current) {
        // Vuelta automática de 360° hasta que el usuario toma el control.
        const angle = ease(t) * Math.PI * 2;
        cam.position.set(Math.sin(angle) * INTRO_RADIUS, 0.25 + Math.sin(t * Math.PI) * 0.35, Math.cos(angle) * INTRO_RADIUS);
        cam.lookAt(INTRO_TARGET);
        if (c) c.target.copy(INTRO_TARGET);
        // Al terminar la vuelta, la cámara queda libre (girar, panear, zoom).
        if (t >= 1) manual.current = true;
      } else if (c) {
        c.update();
      }

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
        <HologramBody
          frame={frame}
          anomalies={anomalies}
          onActivate={stage === 'intro' ? onBodyClick : undefined}
        />
        <AnatomyBody frame={frame} />
        {stage === 'explore' &&
          anomalies.map((a) => <AnomalyBeacon key={a.id} anomaly={a} frame={frame} />)}
      </Suspense>
      <MarkerProjector markers={markers} active={stage === 'explore'} markerMap={markerMap} />
      <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      screenSpacePanning
      minDistance={1}
      maxDistance={6.5}
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
  onBodyClick,
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
  /** Clic sobre el holograma durante el escaneo (pasa a la anatomía). */
  onBodyClick?: () => void;
}) {
  const { t } = useT();
  const reduced = usePrefersReducedMotion();
  const markerMap = useMemo(() => new Map<BodySystemId, HTMLButtonElement | null>(), []);
  const isExplore = stage === 'explore';

  return (
    <div className={`xp-canvas${isExplore ? ' is-explore' : ''}`}>
      <Canvas
        camera={{ position: [0, 0.25, INTRO_RADIUS], fov: 34 }}
        dpr={[1, 2]}
        gl={{ antialias: true, localClippingEnabled: true }}
        aria-label={t.bodyHud.overviewHeading}
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
          markerMap={markerMap}
          onDetect={onDetect}
          onProgress={onProgress}
          onIntroDone={onIntroDone}
          onBodyClick={onBodyClick}
        />
      </Canvas>
      <div className="xp-markers" aria-hidden={!isExplore}>
        {markers.map((marker) => {
          const { side, labelDy } = BODY_HOTSPOTS[marker.id];
          const isSelected = marker.id === selected;
          return (
            <button
              key={marker.id}
              ref={(el) => {
                markerMap.set(marker.id, el);
              }}
              type="button"
              className={`body3d-marker${side < 0 ? ' is-left' : ''}${isSelected ? ' is-selected' : ''}${marker.critical ? ' is-critical' : ''}`}
              hidden={!isExplore}
              tabIndex={!isExplore ? -1 : 0}
              style={{ ['--status' as string]: marker.color, ['--dy' as string]: `${labelDy}px` }}
              aria-pressed={isSelected}
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
          );
        })}
      </div>
      <LoadingOverlay label={t.common.loading3dBody} />
    </div>
  );
}

export default BodyExperience;
