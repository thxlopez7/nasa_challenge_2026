'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { BODY_HOTSPOTS, BODY_MODEL, type BodySystemId } from './modelCatalog';
import LoadingOverlay from './LoadingOverlay';
import NormalizedModel from './NormalizedModel';

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


/**
 * Controles de órbita que desplazan suavemente el foco de la cámara hacia el
 * sistema elegido (sin animación si el usuario prefiere menos movimiento).
 */
function FocusControls({ targetY, reduced }: { targetY: number; reduced: boolean }) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    const k = reduced ? 1 : 0.08;
    c.target.y += (targetY - c.target.y) * k;
    c.update();
  });
  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      minDistance={1.4}
      maxDistance={5}
      minPolarAngle={Math.PI * 0.3}
      maxPolarAngle={Math.PI * 0.7}
      enableDamping={!reduced}
    />
  );
}

function Marker({
  marker,
  selected,
  onSelect,
}: {
  marker: BodyMarker;
  selected: boolean;
  onSelect: (id: BodySystemId) => void;
}) {
  const { position, side, labelDy } = BODY_HOTSPOTS[marker.id];
  // Sin `center`: el ancla (0×0) cae justo sobre el punto 3D; el punto se
  // centra en ella y el rótulo sale hacia un lado con una línea guía.
  return (
    <Html position={position} zIndexRange={[20, 0]}>
      <button
        type="button"
        className={`body3d-marker${side < 0 ? ' is-left' : ''}${selected ? ' is-selected' : ''}${marker.critical ? ' is-critical' : ''}`}
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
          <em>{marker.statusLabel}</em>
        </span>
      </button>
    </Html>
  );
}

/** Cuerpo 3D con un marcador de estado por sistema. */
export function BodyViewer({
  markers,
  selected,
  onSelect,
}: {
  markers: BodyMarker[];
  selected: BodySystemId;
  onSelect: (id: BodySystemId) => void;
}) {
  const reduced = usePrefersReducedMotion();
  // El foco se inclina un poco hacia el sistema elegido sin sacar los pies de cuadro.
  const targetY = Math.max(-0.1, Math.min(0.2, BODY_HOTSPOTS[selected].position[1] * 0.2));

  return (
    <div className="body3d" role="group" aria-label="Mapa corporal 3D: arrastra para girar el cuerpo">
      <Canvas camera={{ position: [0, 0.1, 4.1], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#dfe9ff', '#1a1208', 0.6]} />
        <directionalLight position={[2.5, 3, 3]} intensity={1.6} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.9} color="#00a8e8" />

        <Suspense fallback={null}>
          <NormalizedModel url={BODY_MODEL.url} size={2} fit="height" />
          {markers.map((m) => (
            <Marker key={m.id} marker={m} selected={m.id === selected} onSelect={onSelect} />
          ))}
        </Suspense>

        <FocusControls targetY={targetY} reduced={reduced} />
      </Canvas>
      <LoadingOverlay label="Cargando cuerpo 3D…" />
      <p className="body3d-hint dim">Arrastra para girar · rueda para acercar</p>
    </div>
  );
}

export default BodyViewer;
