import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { detectLanguage, Lang, setLanguage, t as rawT, TranslationKey } from './i18n';

const STORAGE_KEY = 'app_language';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: rawT,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const detected = detectLanguage();
    setLanguage(detected);
    return detected;
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'es' || saved === 'en') {
        setLanguage(saved);
        setLangState(saved);
      }
    });
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLanguage(newLang);
    setLangState(newLang);
    AsyncStorage.setItem(STORAGE_KEY, newLang);
  }, []);

  // Stable t reference that re-creates when lang changes, triggering re-renders in consumers
  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => rawT(key, vars),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
