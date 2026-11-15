'use client';

import { useEffect } from 'react';

export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerSw = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch {
        // Ignorar en entornos sin soporte SW o contextos restringidos
      }
    };

    void registerSw();
  }, []);

  return null;
}

export default PwaRegistrar;
