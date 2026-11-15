import { create } from 'zustand';

/**
 * ¿Se está mostrando la intro? Empieza abierta: cada vez que se carga la app
 * (en cualquier ruta) aparece la pantalla de título. Las navegaciones dentro
 * de la app no la reabren; el botón ✦ de la barra sí.
 */
export const useIntroStore = create<{
  open: boolean;
  /** Sube cada vez que se cierra la intro: sirve para reiniciar el escaneo. */
  closedCount: number;
  show: () => void;
  hide: () => void;
}>()((set) => ({
  open: true,
  closedCount: 0,
  show: () => set({ open: true }),
  hide: () => set((s) => ({ open: false, closedCount: s.closedCount + 1 })),
}));
