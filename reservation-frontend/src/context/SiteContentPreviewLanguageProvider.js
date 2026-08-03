import React, {
  useCallback, useContext, useMemo,
} from 'react';
import { LanguageContext, LANG_EN, LANG_ZH } from './LanguageContext';

/**
 * 文案管理「所見即所得」預覽：合併 API 覆寫與編輯中的草稿，並可切換預覽語言。
 */
export default function SiteContentPreviewLanguageProvider({
  extraOverrides = {},
  previewLang,
  children,
}) {
  const parent = useContext(LanguageContext);
  if (!parent) {
    throw new Error('SiteContentPreviewLanguageProvider must be inside LanguageProvider');
  }

  const lang = previewLang ?? parent.lang;

  const t = useCallback((path) => {
    const extra = extraOverrides[path];
    if (extra) {
      const localized = extra[lang] ?? extra[LANG_ZH] ?? extra[LANG_EN];
      if (localized) return localized;
    }
    return parent.t(path);
  }, [extraOverrides, lang, parent]);

  const value = useMemo(() => ({
    lang,
    setLang: parent.setLang,
    t,
    isZh: lang === LANG_ZH,
    isEn: lang === LANG_EN,
  }), [lang, parent.setLang, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function catalogRowsToOverrides(rows = []) {
  const map = {};
  rows.forEach((row) => {
    if (row.isActive === false) return;
    map[row.contentKey] = {
      [LANG_ZH]: row.valueZh ?? '',
      [LANG_EN]: row.valueEn ?? '',
    };
  });
  return map;
}

export function mergeDraftOverride(overrides, draft) {
  if (!draft?.contentKey) return overrides;
  return {
    ...overrides,
    [draft.contentKey]: {
      [LANG_ZH]: draft.valueZh ?? '',
      [LANG_EN]: draft.valueEn ?? '',
    },
  };
}
