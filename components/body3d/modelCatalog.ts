/**
 * Catálogo de modelos 3D del mapa corporal.
 *
 * Los .glb de /public/models están optimizados para web (mallas simplificadas,
 * compresión meshopt y texturas WebP de 1024 px). Todos vienen de Sketchfab y
 * requieren atribución; los marcados CC-BY-NC-SA sólo admiten uso no
 * comercial y obligan a compartir las obras derivadas con la misma licencia.
 */

export type BodySystemId = 'neuro' | 'cardio' | 'inmune' | 'oseo' | 'conducta';

export interface ModelCredit {
  title: string;
  author: string;
  source: string;
  license: 'CC-BY-4.0' | 'CC-BY-NC-SA-4.0';
}

export interface ModelEntry {
  url: string;
  label: string;
  /** Rotación extra [x, y, z] en radianes para presentarlo de frente */
  rotation?: [number, number, number];
  credit: ModelCredit;
}

export const BODY_MODEL: ModelEntry = {
  url: '/models/body.glb',
  label: 'Cuerpo completo (écorché)',
  credit: {
    title: 'Male Full Body Ecorche',
    author: 'Diego Luján García',
    source: 'https://sketchfab.com/3d-models/male-full-body-ecorche-ab11ebff89224f03bd75efede1164cf6',
    license: 'CC-BY-4.0',
  },
};

export const WIREFRAME_MODEL: ModelEntry = {
  url: '/models/body-wireframe.glb',
  label: 'Cuerpo holográfico (wireframe)',
  credit: {
    title: '3D human body wireframe model',
    author: 'Syed Mohammad Hasan',
    source: 'https://sketchfab.com/3d-models/3d-human-body-wireframe-model-66f684f022fb47ef9e22eaae406b231e',
    license: 'CC-BY-4.0',
  },
};

const EYE_BLUE: ModelEntry = {
  url: '/models/eye-blue.glb',
  label: 'Iris azul',
  credit: {
    title: 'Blue Eyeball (Free)',
    author: 'Tom Hodes',
    source: 'https://sketchfab.com/3d-models/blue-eyeball-free-18915d2f17a2431fbefeb3eaf4411f16',
    license: 'CC-BY-4.0',
  },
};

const EYE_BROWN: ModelEntry = {
  url: '/models/eye-brown.glb',
  label: 'Iris marrón',
  credit: {
    title: 'Brown Eyeball (Free)',
    author: 'Tom Hodes',
    source: 'https://sketchfab.com/3d-models/brown-eyeball-free-9189fb68802a4f70b955f7e00da6e6f7',
    license: 'CC-BY-4.0',
  },
};

const HEART: ModelEntry = {
  url: '/models/heart.glb',
  label: 'Corazón',
  credit: {
    title: 'Cardiac Anatomy: external view',
    author: 'E-learning UMCG',
    source: 'https://sketchfab.com/3d-models/cardiac-anatomy-external-view-e8e8c6685e82474d8393693fd0646dc7',
    license: 'CC-BY-NC-SA-4.0',
  },
};

const LUNGS: ModelEntry = {
  url: '/models/lungs.glb',
  label: 'Pulmones',
  credit: {
    title: 'Pulmones Atropellado',
    author: '3D_UTPL',
    source: 'https://sketchfab.com/3d-models/pulmones-atropellado-06db6f9f83d94aee8fdff011a7120f8e',
    license: 'CC-BY-NC-SA-4.0',
  },
};

const LYMPHATIC: ModelEntry = {
  url: '/models/lymphatic.glb',
  label: 'Sistema linfático',
  credit: {
    title: 'Lymphatisch systeem - een overzicht',
    author: 'E-learning UMCG',
    source: 'https://sketchfab.com/3d-models/lymphatisch-systeem-een-overzicht-944e5e64850a454ba95717ccf5a5eece',
    license: 'CC-BY-NC-SA-4.0',
  },
};

const SPINE: ModelEntry = {
  url: '/models/spine.glb',
  label: 'Columna vertebral',
  credit: {
    title: 'Spine (collection of thunthu)',
    author: 'thunthu',
    source: 'https://sketchfab.com/3d-models/spine-collection-of-thunthu-1ce94666922f48c9b68cd0e196b74a0a',
    license: 'CC-BY-4.0',
  },
};

/**
 * Qué órgano se muestra en detalle para cada sistema, ordenado por
 * relevancia para el riesgo espacial que vigila ese sistema.
 */
export const SYSTEM_MODELS: Record<BodySystemId, { why: string; models: ModelEntry[] }> = {
  neuro: {
    why: 'El síndrome neuro-ocular (SANS) deforma el globo ocular y engrosa el nervio óptico.',
    models: [EYE_BLUE, EYE_BROWN],
  },
  cardio: {
    why: 'Sin gravedad el corazón trabaja menos y se remodela; los pulmones delatan el CO2 de cabina.',
    models: [HEART, LUNGS],
  },
  inmune: {
    why: 'La radiación reduce los linfocitos que circulan por ganglios y vasos linfáticos.',
    models: [LYMPHATIC],
  },
  oseo: {
    why: 'Sin carga, las vértebras y los huesos de apoyo pierden densidad mes a mes.',
    models: [SPINE],
  },
  conducta: {
    why: 'El sueño y el ánimo no tienen un órgano único: se siguen con cuestionarios y el reloj.',
    models: [],
  },
};

export const ALL_CREDITS: ModelCredit[] = [
  WIREFRAME_MODEL.credit,
  BODY_MODEL.credit,
  EYE_BLUE.credit,
  EYE_BROWN.credit,
  HEART.credit,
  LUNGS.credit,
  LYMPHATIC.credit,
  SPINE.credit,
];

/**
 * Marcador de cada sistema sobre el cuerpo normalizado (altura 2, centrado en
 * el origen, mirando a +Z) y lado hacia el que sale su rótulo. Los rótulos
 * alternan lados, como en el mapa corporal 2D original, para no solaparse.
 */
export const BODY_HOTSPOTS: Record<
  BodySystemId,
  { position: [number, number, number]; side: 1 | -1; labelDy: number }
> = {
  conducta: { position: [-0.03, 0.95, 0.03], side: -1, labelDy: -14 },
  neuro: { position: [0.035, 0.85, 0.1], side: 1, labelDy: 6 },
  cardio: { position: [0.05, 0.47, 0.1], side: 1, labelDy: 0 },
  inmune: { position: [-0.15, 0.56, 0.03], side: -1, labelDy: 0 },
  oseo: { position: [0, 0.12, -0.08], side: -1, labelDy: 0 },
};
