import React, { useEffect, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import SiteContentManagementPage from './SiteContentManagementPage';
import PageContentManagementPage from './PageContentManagementPage';
import MediaLibraryPanel from '../../components/media/MediaLibraryPanel';
import { STUDENT_CONTENT_AREAS, getStudentContentArea } from './studentContentAreas';
import './StudentContentHubPage.css';

/**
 * 學生端內容中心 — 單一入口，依任務區嵌入既有編輯器
 */
export default function StudentContentHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const areaId = searchParams.get('area');
  const area = useMemo(() => getStudentContentArea(areaId), [areaId]);

  useEffect(() => {
    document.title = area
      ? `${area.shortLabel} · 學生端內容 | EEARS`
      : '學生端內容 | EEARS';
  }, [area]);

  const setArea = (id) => {
    if (!id) {
      setSearchParams({}, { replace: false });
      return;
    }
    setSearchParams({ area: id }, { replace: false });
  };

  // 防呆：未知 area
  if (areaId && !area) {
    return <Navigate to="/admin/student-content" replace />;
  }

  return (
    <div className="sch-hub admin-page">
      <header className="sch-hub__header">
        <div className="sch-hub__header-copy">
          <p className="sch-hub__kicker">學生在網站上看到的內容</p>
          <p className="sch-hub__lead">
            這裡修改學生在網站上看得到的文字、連結、PDF、修課說明與圖片。存檔後前台會更新；不確定時可先開預覽確認。
          </p>
        </div>
        {area ? (
          <div className="sch-hub__header-actions">
            <button type="button" className="sch-hub__back" onClick={() => setArea(null)}>
              ← 回任務總覽
            </button>
            {area.kind !== 'media-library' ? (
              <button
                type="button"
                className="sch-hub__open-front"
                onClick={() => window.open(area.previewPath, '_blank', 'noopener,noreferrer')}
              >
                開前台頁 · {area.previewLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {!area ? (
        <div className="sch-hub__landing">
          <h2 className="sch-hub__section-title">你想做什麼？</h2>
          <p className="sch-hub__section-lead">選一個任務開始。每個任務只改一類內容，比較不容易改錯。</p>

          <div className="sch-hub__grid">
            {STUDENT_CONTENT_AREAS.filter((a) => !a.advanced).map((a) => (
              <button
                key={a.id}
                type="button"
                className="sch-hub__card"
                onClick={() => setArea(a.id)}
              >
                <div className="sch-hub__card-title">{a.label}</div>
                <p className="sch-hub__card-desc">{a.description}</p>
                <p className="sch-hub__card-how">{a.howTo}</p>
                <span className="sch-hub__card-cta">開始編輯</span>
              </button>
            ))}
          </div>

          <div className="sch-hub__advanced">
            <h3 className="sch-hub__advanced-title">進階（選用）</h3>
            {STUDENT_CONTENT_AREAS.filter((a) => a.advanced).map((a) => (
              <button
                key={a.id}
                type="button"
                className="sch-hub__card sch-hub__card--advanced"
                onClick={() => setArea(a.id)}
              >
                <div className="sch-hub__card-title">{a.label}</div>
                <p className="sch-hub__card-desc">{a.description}</p>
                <span className="sch-hub__card-cta">開啟</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="sch-hub__workspace">
          <aside className="sch-hub__nav" aria-label="內容任務">
            <div className="sch-hub__nav-label">任務</div>
            {STUDENT_CONTENT_AREAS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`sch-hub__nav-item${a.id === area.id ? ' is-active' : ''}${a.advanced ? ' is-advanced' : ''}`}
                onClick={() => setArea(a.id)}
              >
                <span className="sch-hub__nav-item-title">{a.shortLabel}</span>
                {a.advanced ? <span className="sch-hub__nav-pill">進階</span> : null}
              </button>
            ))}
          </aside>

          <div className="sch-hub__main">
            <div className="sch-hub__area-banner">
              <div>
                <h2 className="sch-hub__area-title">{area.label}</h2>
                <p className="sch-hub__area-lead">{area.howTo}</p>
              </div>
            </div>

            {area.kind === 'site-content' ? (
              <SiteContentManagementPage embedded />
            ) : area.kind === 'media-library' ? (
              <MediaLibraryPanel />
            ) : (
              <PageContentManagementPage embedded forcedTab={area.pageTab} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
