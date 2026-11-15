import { AdditiveBlending, Color, DoubleSide, NormalBlending, Vector4 } from 'three';

/** Máximo de zonas de anomalía que el shader dibuja a la vez. */
export const MAX_ZONES = 5;

/**
 * Parámetros del material holográfico del cuerpo wireframe (para
 * <shaderMaterial {...hologramParams()} />).
 *
 * - Cian translúcido con borde de Fresnel.
 * - Una banda de escáner horizontal (uScanY) que barre el cuerpo.
 * - Hasta MAX_ZONES zonas de anomalía: núcleo rojo que late y una onda que
 *   se expande desde el foco ("latencia"). Cada zona se revela con uReveal[i].
 * - Todo lo que queda por debajo de uCutY se descarta: permite que el cuerpo
 *   anatómico "se materialice" mientras el holograma desaparece.
 *
 * Trabaja en coordenadas de mundo: el cuerpo está normalizado (altura 2,
 * centrado en el origen), igual que las posiciones de las zonas.
 */
export function hologramParams({ wire }: { wire: boolean }) {
  const zones = Array.from({ length: MAX_ZONES }, () => new Vector4(0, 0, 0, 0));
  return {
    wireframe: wire,
    transparent: true,
    depthWrite: !wire,
    side: DoubleSide,
    blending: wire ? AdditiveBlending : NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uScanY: { value: 10 },
      uCutY: { value: -10 },
      uBase: { value: new Color('#00a8e8') },
      uAlert: { value: new Color('#ff3b2f') },
      uZones: { value: zones },
      uReveal: { value: new Array(MAX_ZONES).fill(0) },
      uWire: { value: wire ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uScanY;
      uniform float uCutY;
      uniform vec3 uBase;
      uniform vec3 uAlert;
      uniform vec4 uZones[${MAX_ZONES}];
      uniform float uReveal[${MAX_ZONES}];
      uniform float uWire;
      varying vec3 vWorld;
      varying vec3 vNormalW;

      void main() {
        if (vWorld.y < uCutY) discard;

        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormalW))), 2.0);

        vec3 color = uBase;
        float alpha = uWire > 0.5 ? 0.42 : 0.05 + fresnel * 0.22;

        // Banda del escáner
        float scan = exp(-pow((vWorld.y - uScanY) * 14.0, 2.0));
        color = mix(color, vec3(0.85, 1.0, 1.0), scan);
        alpha += scan * 0.6;

        // Línea de materialización
        float cut = exp(-pow((vWorld.y - uCutY) * 30.0, 2.0)) * step(-5.0, uCutY);
        color = mix(color, vec3(1.0, 0.95, 0.4), cut);
        alpha += cut * 0.8;

        // Zonas de anomalía: núcleo que late + onda expansiva
        float heat = 0.0;
        for (int i = 0; i < ${MAX_ZONES}; i++) {
          vec4 z = uZones[i];
          if (z.w <= 0.0) continue;
          float critical = step(1.5, z.w);
          float radius = mix(0.14, 0.2, critical);
          float speed = mix(3.2, 6.4, critical);
          float d = distance(vWorld, z.xyz);
          float pulse = 0.55 + 0.45 * sin(uTime * speed);
          float core = smoothstep(radius, 0.0, d) * pulse;
          float wavePos = fract(uTime * mix(0.5, 0.9, critical)) * radius * 1.8;
          float wave = exp(-pow((d - wavePos) * 28.0, 2.0)) * (1.0 - wavePos / (radius * 1.8));
          heat += (core + wave * 0.7) * uReveal[i];
        }
        heat = clamp(heat, 0.0, 1.0);
        color = mix(color, uAlert, heat);
        alpha += heat * 0.75;

        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * uOpacity);
      }
    `,
  };
}
