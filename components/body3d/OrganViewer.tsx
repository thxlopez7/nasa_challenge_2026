'use client';

import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { SYSTEM_MODELS, type BodySystemId } from './modelCatalog';
import LoadingOverlay from './LoadingOverlay';
import NormalizedModel from './NormalizedModel';

/** Vista de detalle del órgano asociado al sistema elegido. */
export function OrganViewer({ system }: { system: BodySystemId }) {
  const { why, models } = SYSTEM_MODELS[system];
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const model = models[Math.min(index, models.length - 1)];

  return (
    <section className="organ3d" aria-label="Vista 3D del órgano">
      <div className="organ3d-head">
        <p className="kick" style={{ margin: 0 }}>Vista del órgano</p>
        {models.length > 1 && (
          <div role="group" aria-label="Elegir modelo" className="organ3d-tabs">
            {models.map((m, i) => (
              <button
                key={m.url}
                type="button"
                className="btn"
                aria-pressed={m === model}
                onClick={() => setIndex(i)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="organ3d-why">{why}</p>

      {model ? (
        <>
          <div className="organ3d-canvas">
            <Canvas camera={{ position: [0, 0, 3.2], fov: 35 }} dpr={[1, 2]}>
              <ambientLight intensity={0.6} />
              <hemisphereLight args={['#dfe9ff', '#1a1208', 0.6]} />
              <directionalLight position={[2, 3, 3]} intensity={1.7} />
              <directionalLight position={[-3, -1, -2]} intensity={0.8} color="#00a8e8" />
              <Suspense fallback={null}>
                <NormalizedModel key={model.url} url={model.url} size={1.9} fit="max" rotation={model.rotation} />
              </Suspense>
              <OrbitControls enablePan={false} minDistance={1.6} maxDistance={6} autoRotate={!reduced} autoRotateSpeed={0.8} />
            </Canvas>
            <LoadingOverlay label="Cargando…" />
          </div>
          <p className="organ3d-credit dim">
            Modelo:{' '}
            <a href={model.credit.source} target="_blank" rel="noreferrer">
              {model.credit.title}
            </a>{' '}
            · {model.credit.author} · {model.credit.license}
          </p>
        </>
      ) : (
        <p className="organ3d-empty dim">
          Este sistema se sigue con el cuestionario diario y el registro de sueño del reloj.
        </p>
      )}
    </section>
  );
}

export default OrganViewer;
