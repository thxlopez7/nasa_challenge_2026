'use client';

import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { SYSTEM_MODELS, type BodySystemId } from './modelCatalog';
import LoadingOverlay from './LoadingOverlay';
import NormalizedModel from './NormalizedModel';
import { useT } from '../../i18n/I18nContext';

/** Vista de detalle del órgano asociado al sistema elegido. */
export function OrganViewer({ system }: { system: BodySystemId }) {
  const { t, lang } = useT();
  const { models } = SYSTEM_MODELS[system];
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
  const whyText = t.bodyHud.systems[system].why3d;

  const localizedModelLabel = (url: string, fallback: string): string => {
    if (url.includes('brain_sleep')) return t.bodyHud.systemsModels.brainSleep;
    if (url.includes('brain')) return t.bodyHud.systemsModels.brainOverview;
    if (url.includes('body')) return t.bodyHud.systemsModels.wholeBody;
    if (url.includes('heart')) return t.bodyHud.systemsModels.heart;
    if (url.includes('lymphatic')) return t.bodyHud.systemsModels.lymphatic;
    if (url.includes('kidney')) return t.bodyHud.systemsModels.kidney;
    if (url.includes('skeleton')) return t.bodyHud.systemsModels.skeleton;
    if (url.includes('muscle')) return t.bodyHud.systemsModels.muscle;
    return fallback;
  };

  const localizedCreditTitle = (url: string, fallback: string): string => {
    if (url.includes('lymphatic')) {
      return lang === 'en'
        ? t.bodyHud.systemsModels.lymphaticCreditTitle
        : fallback;
    }
    return fallback;
  };

  return (
    <section className="organ3d" aria-label={t.bodyHud.organViewerTitle}>
      <div className="organ3d-head">
        <p className="kick" style={{ margin: 0 }}>
          {t.bodyHud.organViewerTitle}
        </p>
        {models.length > 1 && (
          <div role="group" aria-label={t.bodyHud.switchOrganPart} className="organ3d-tabs">
            {models.map((m, i) => (
              <button
                key={m.url}
                type="button"
                className="btn"
                aria-pressed={m === model}
                onClick={() => setIndex(i)}
              >
                {localizedModelLabel(m.url, m.label)}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="organ3d-why">{whyText}</p>

      {model ? (
        <>
          <div className="organ3d-canvas">
            <Canvas camera={{ position: [0, 0, 2.85], fov: 35 }} dpr={[1, 2]}>
              <ambientLight intensity={0.65} />
              <hemisphereLight args={['#dfe9ff', '#1a1208', 0.65]} />
              <directionalLight position={[2, 3, 3]} intensity={1.7} />
              <directionalLight position={[-3, -1, -2]} intensity={0.85} color="#00a8e8" />
              <Suspense fallback={null}>
                <NormalizedModel
                  key={model.url}
                  url={model.url}
                  size={model.url.includes('lymphatic') ? 2.65 : 2.3}
                  fit="max"
                  rotation={model.rotation}
                />
              </Suspense>
              <OrbitControls
                enablePan={false}
                minDistance={1.1}
                maxDistance={6}
                autoRotate={!reduced}
                autoRotateSpeed={0.8}
              />
            </Canvas>
            <LoadingOverlay label={t.common.loading} />
          </div>
          <p className="organ3d-credit dim">
            {t.bodyHud.modelCreditLabel}:{' '}
            <a href={model.credit.source} target="_blank" rel="noreferrer">
              {localizedCreditTitle(model.url, model.credit.title)}
            </a>{' '}
            · {model.credit.author} · {model.credit.license}
          </p>
        </>
      ) : (
        <p className="organ3d-empty dim">{t.bodyHud.noModelAvailable}</p>
      )}
    </section>
  );
}

export default OrganViewer;
