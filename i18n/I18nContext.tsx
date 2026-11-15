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

export const DICTS: Record<SupportedLang, TranslationDict> = { es, en };

export function parseLanguageParam(raw: string | null | undefined): SupportedLang | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return normalized === 'es' || normalized === 'en' ? normalized : null;
}

export function getDict(lang: SupportedLang): TranslationDict {
  return DICTS[lang] ?? es;
}

/** Lookup seguro para claves dinámicas con advertencia en desarrollo y fallback limpio. */
export function resolveTranslationKey(
  lang: SupportedLang,
  path: string,
  fallback?: string
): string {
  const readPath = (root: unknown): string | undefined => {
    let cur: unknown = root;
    for (const part of path.split('.')) {
      if (!cur || typeof cur !== 'object' || !(part in cur)) return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === 'string' ? cur : undefined;
  };

  const localized = readPath(DICTS[lang]);
  if (localized !== undefined) return localized;

  const esFallback = readPath(es);
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[i18n] Missing translation key "${path}" for locale "${lang}"`);
  }
  return esFallback ?? fallback ?? path;
}

/** Refleja el idioma activo en `?lang=` sin perder el resto de la query ni el hash. */
function syncLangUrlParam(lang: SupportedLang): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('lang') === lang) return;
    url.searchParams.set('lang', lang);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Entornos sin history/URL: ignorar
  }
}

export function setAppLanguage(lang: SupportedLang): void {
  if (currentLang === lang) {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
    return;
  }
  currentLang = lang;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Modo privado / sin localStorage: ignorar
    }
    document.documentElement.lang = lang;
    syncLangUrlParam(lang);
  }
  listeners.forEach((l) => l());
}

interface I18nContextValue {
  lang: SupportedLang;
  locale: SupportedLang;
  setLang: (lang: SupportedLang) => void;
  t: TranslationDict;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'es',
  locale: 'es',
  setLang: setAppLanguage,
  t: es,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    try {
      const urlParam = parseLanguageParam(
        new URLSearchParams(window.location.search).get('lang')
      );
      if (urlParam) {
        setAppLanguage(urlParam);
        return;
      }
      const saved = parseLanguageParam(window.localStorage.getItem(LANG_STORAGE_KEY));
      if (saved) {
        setAppLanguage(saved);
      } else {
        document.documentElement.lang = currentLang;
      }
    } catch {
      // Sin almacenamiento disponible
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.title = DICTS[lang].common.documentTitle;
    }
  }, [lang]);

  const value: I18nContextValue = {
    lang,
    locale: lang,
    setLang: setAppLanguage,
    t: DICTS[lang],
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  return useContext(I18nContext);
}
