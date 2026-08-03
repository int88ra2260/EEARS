import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { LANG_ZH, LANG_EN, getTranslation } from '../constants/translations';
import { fetchSiteContent } from '../services/siteContentApi';
import { formatMessage } from '../utils/formatMessage';

const STORAGE_KEY = 'eears_lang';

export const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [textOverrides, setTextOverrides] = useState({});
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === LANG_EN || saved === LANG_ZH) return saved;
    } catch (e) {}
    return LANG_ZH;
  });

  const setLang = useCallback((newLang) => {
    if (newLang !== LANG_ZH && newLang !== LANG_EN) return;
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch (e) {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchSiteContent({ force: true })
        .then((data) => {
          if (!cancelled && data?.textOverrides) {
            setTextOverrides(data.textOverrides);
          }
        })
        .catch(() => {});
    };
    load();
    window.addEventListener('eears:site-content-updated', load);
    return () => {
      cancelled = true;
      window.removeEventListener('eears:site-content-updated', load);
    };
  }, []);

  const t = useCallback(
    (path, vars) => {
      const override = textOverrides[path];
      let template;
      if (override) {
        const localized = override[lang] ?? override[LANG_ZH] ?? override[LANG_EN];
        if (localized) template = localized;
      }
      if (!template) template = getTranslation(lang, path);
      if (vars && typeof vars === 'object') {
        return formatMessage(template, vars);
      }
      return template;
    },
    [lang, textOverrides]
  );

  const value = useMemo(
    () => ({ lang, setLang, t, isZh: lang === LANG_ZH, isEn: lang === LANG_EN }),
    [lang, setLang, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

export { LANG_ZH, LANG_EN };
