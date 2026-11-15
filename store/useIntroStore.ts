import { create } from 'zustand';

/** Pasos de la entrada: pantalla de título (misión) → perfiles. */
export type IntroStep = 'title' | 'profiles';

/**
 * Estado de la entrada a la app. Empieza abierta en la pantalla de título:
 * cada vez que se carga la app (en cualquier ruta) aparece la intro. Las
 * navegaciones dentro de la app no la reabren; los botones de la barra sí.
 */
export const useIntroStore = create<{
  open: boolean;
  step: IntroStep;
  /** Sube cada vez que se cierra la intro: sirve para reiniciar el escaneo. */
  closedCount: number;
  show: (step?: IntroStep) => void;
  goTo: (step: IntroStep) => void;
  hide: () => void;
}>()((set) => ({
  open: true,
  step: 'title',
  closedCount: 0,
  show: (step = 'title') => set({ open: true, step }),
  goTo: (step) => set({ step }),
  hide: () => set((s) => ({ open: false, closedCount: s.closedCount + 1 })),
}));
