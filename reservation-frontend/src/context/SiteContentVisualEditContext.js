import React, {
  createContext, useCallback, useContext, useMemo,
} from 'react';
import { isTextKeyInSection } from '../utils/siteContentCatalog';

const SiteContentVisualEditContext = createContext(null);

export function SiteContentVisualEditProvider({
  section,
  activeKey,
  onSelectKey,
  children,
}) {
  const isEditable = useCallback((key) => isTextKeyInSection(section, key), [section]);

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
