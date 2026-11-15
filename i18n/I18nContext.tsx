'use client';

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { es, type TranslationDict } from './es';
import { en } from './en';
import type { SupportedLang } from '../config/missionComms';

const LANG_STORAGE_KEY = 'exovitals-lang';

let currentLang: SupportedLang = 'es';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SupportedLang {
  return currentLang;
}

function getServerSnapshot(): SupportedLang {
  return 'es';
}

export function setAppLanguage(lang: SupportedLang): void {
  if (currentLang === lang) return;
  currentLang = lang;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Modo privado / sin localStorage: ignorar
    }
    document.documentElement.lang = lang;
  }
  listeners.forEach((l) => l());
}

const DICTS: Record<SupportedLang, TranslationDict> = { es, en };

interface I18nContextValue {
  lang: SupportedLang;
  setLang: (lang: SupportedLang) => void;
  t: TranslationDict;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'es',
  setLang: setAppLanguage,
  t: es,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'es') {
        if (saved !== currentLang) {
          setAppLanguage(saved);
        } else {
          document.documentElement.lang = saved;
        }
      } else {
        document.documentElement.lang = currentLang;
      }
    } catch {
      // Sin almacenamiento disponible
    }
  }, []);

  const value: I18nContextValue = {
    lang,
    setLang: setAppLanguage,
    t: DICTS[lang],
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  return useContext(I18nContext);
}
