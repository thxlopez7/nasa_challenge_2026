'use client';

import { useProgress } from '@react-three/drei';

/**
 * Indicador de carga en el DOM, fuera del <Canvas>. Usar <Html> de drei como
 * fallback de Suspense provoca que React desmonte su raíz durante el render.
 */
export function LoadingOverlay({ label }: { label: string }) {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <p className="body3d-loading body3d-overlay" role="status">
      {label} {Math.round(progress)}%
    </p>
  );
}

export default LoadingOverlay;
