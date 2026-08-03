import React, {
  createContext, useCallback, useContext, useMemo,
} from 'react';

const SiteContentPreviewContext = createContext(null);

export function useSiteContentPreview() {
  return useContext(SiteContentPreviewContext);
}

/**
 * 後台視覺編輯預覽殼層：不可再包一層 Router（會與 App 外層 BrowserRouter 衝突）。
 * 攔截預覽區內的連結導覽，並提供模擬路徑給 Header 等元件顯示 active 狀態。
 */
export default function SiteContentPreviewShell({ previewPath = '/', children }) {
  const value = useMemo(() => ({
    isPreview: true,
    previewPath,
  }), [previewPath]);

  const handleCaptureClick = useCallback((event) => {
    if (event.target.closest('.scm-visual-editable')) {
      return;
    }
    const anchor = event.target.closest('a[href]');
    if (anchor) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  return (
    <SiteContentPreviewContext.Provider value={value}>
      <div
        className="scm-visual-preview-shell"
        onClickCapture={handleCaptureClick}
      >
        {children}
      </div>
    </SiteContentPreviewContext.Provider>
  );
}
