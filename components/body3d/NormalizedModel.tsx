'use client';

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';

/**
 * Carga un .glb y lo normaliza: centrado en el origen y escalado para que su
 * altura (`fit="height"`) o su mayor dimensión (`fit="max"`) mida `size`.
 * Así modelos de escalas muy distintas (cm, m, unidades de Sketchfab) se
 * comportan igual en escena.
 */
export function NormalizedModel({
  url,
  size = 2,
  fit = 'height',
  rotation,
}: {
  url: string;
  size?: number;
  fit?: 'height' | 'max';
  rotation?: [number, number, number];
}) {
  // Sin Draco (evita descargar el decodificador de internet); meshopt va incluido.
  const { scene } = useGLTF(url, false, true);

  const { object, scale, offset } = useMemo(() => {
    const object = scene.clone(true);
    if (rotation) object.rotation.set(...rotation);
    object.updateMatrixWorld(true);
    const box = new Box3().setFromObject(object);
    const dims = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const reference = fit === 'height' ? dims.y : Math.max(dims.x, dims.y, dims.z);
    return {
      object,
      scale: reference > 0 ? size / reference : 1,
      offset: center.multiplyScalar(-1),
    };
  }, [scene, size, fit, rotation]);

  return (
    <group scale={scale}>
      <group position={offset}>
        <primitive object={object} />
      </group>
    </group>
  );
}

export default NormalizedModel;
