import React, {
  createContext, useCallback, useContext, useMemo,
} from 'react';
import { TEXT_SECTION_PREFIXES } from '../utils/siteContentCatalog';

const SiteContentVisualEditContext = createContext(null);

export function SiteContentVisualEditProvider({
  section,
  activeKey,
  onSelectKey,
  children,
}) {
  const isEditable = useCallback((key) => {
    const prefixes = TEXT_SECTION_PREFIXES[section] || [];
    return prefixes.some((prefix) => key.startsWith(prefix));
  }, [section]);

  const value = useMemo(() => ({
    section,
    activeKey,
    selectKey: onSelectKey,
    isEditable,
    enabled: true,
  }), [section, activeKey, onSelectKey, isEditable]);

  return (
    <SiteContentVisualEditContext.Provider value={value}>
      {children}
    </SiteContentVisualEditContext.Provider>
  );
}

export function useSiteContentVisualEdit() {
  return useContext(SiteContentVisualEditContext);
}
