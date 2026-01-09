import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { translations } from './translations';

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key, vars) => key,
});

const STORAGE_KEY = 'mealplanner_lang';

const formatTemplate = (template, vars = {}) => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(vars, token)) {
      return String(vars[token]);
    }
    return match;
  });
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'no' ? 'no' : 'en';
  });

  const t = useCallback(
    (key, vars) => {
      const dictionary = translations[lang] || {};
      const template = dictionary[key] || key;
      return formatTemplate(template, vars);
    },
    [lang]
  );

  const updateLang = useCallback(
    (nextLang) => {
      const normalized = nextLang === 'no' ? 'no' : 'en';
      setLang(normalized);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, normalized);
      }
    },
    []
  );

  const value = useMemo(() => ({ lang, setLang: updateLang, t }), [lang, t, updateLang]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'no' ? 'no' : 'en';
    }
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
