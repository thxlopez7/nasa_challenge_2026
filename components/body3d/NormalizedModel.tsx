'use client';

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Material, Mesh, Object3D, Vector3 } from 'three';

export interface NormalizedScene {
  object: Object3D;
  scale: number;
  offset: Vector3;
}

/**
 * Carga un .glb y calcula cómo normalizarlo: centrado en el origen y escalado
 * para que su altura (`fit="height"`) o su mayor dimensión (`fit="max"`) mida
 * `size`. Así modelos de escalas muy distintas se comportan igual en escena.
 */
export function useNormalizedScene(
  url: string,
  {
    size = 2,
    fit = 'height',
    rotation,
    cloneMaterials = false,
  }: {
    size?: number;
    fit?: 'height' | 'max';
    rotation?: [number, number, number];
    /** Clona los materiales para poder modificarlos sin tocar la caché */
    cloneMaterials?: boolean;
  } = {}
): NormalizedScene {
  // Sin Draco (evita descargar el decodificador de internet); meshopt va incluido.
  const { scene } = useGLTF(url, false, true);

  return useMemo(() => {
    const object = scene.clone(true);
    if (cloneMaterials) {
      object.traverse((o) => {
        if (o instanceof Mesh) {
          o.material = Array.isArray(o.material)
            ? o.material.map((m: Material) => m.clone())
            : (o.material as Material).clone();
        }
      });
    }
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
  }, [scene, size, fit, rotation, cloneMaterials]);
}

/** Modelo normalizado listo para usar. */
export function NormalizedModel(props: {
  url: string;
  size?: number;
  fit?: 'height' | 'max';
  rotation?: [number, number, number];
}) {
  const { object, scale, offset } = useNormalizedScene(props.url, props);
  return (
    <group scale={scale}>
      <group position={offset}>
        <primitive object={object} />
      </group>
    </group>
  );
}

export default NormalizedModel;
