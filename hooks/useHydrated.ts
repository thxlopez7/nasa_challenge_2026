'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useMissionStore } from '../store/useMissionStore';

const emptySubscribe = () => () => {};

/**
 * Devuelve `false` en SSR y en el primer render del cliente, y `true` tras hidratar.
 * Evita React hydration mismatches con stores persistidos en localStorage.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Componente invisible que rehidrata los stores de Zustand con `skipHydration: true`
 * una sola vez en el cliente sin bloquear el primer render SSR.
 */
export function StoreHydrator() {
  useEffect(() => {
    void useTelemetryStore.persist.rehydrate();
    void useMissionStore.persist.rehydrate();
  }, []);

  return null;
}
