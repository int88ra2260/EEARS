import React, { useEffect, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import SiteContentManagementPage from './SiteContentManagementPage';
import PageContentManagementPage from './PageContentManagementPage';
import MediaLibraryPanel from '../../components/media/MediaLibraryPanel';
import { STUDENT_CONTENT_AREAS, getStudentContentArea } from './studentContentAreas';
import './StudentContentHubPage.css';

/**
 * 學生端內容中心 — 單一入口，依任務區嵌入既有編輯器
 * 主任務順序對齊前台 Header 探索導覽。
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

  // 舊連結 area=copy → home
  useEffect(() => {
    if (areaId === 'copy') {
      setSearchParams({ area: 'home' }, { replace: true });
    }
  }, [areaId, setSearchParams]);

  const setArea = (id) => {
    if (!id) {
      setSearchParams({}, { replace: false });
      return;
    }
    setSearchParams({ area: id }, { replace: false });
  };

  if (areaId && areaId !== 'copy' && !area) {
    return <Navigate to="/admin/student-content" replace />;
  }

  const headerAreas = STUDENT_CONTENT_AREAS.filter((a) => a.headerMatch);
  const otherAreas = STUDENT_CONTENT_AREAS.filter((a) => !a.headerMatch && !a.advanced);
  const advancedAreas = STUDENT_CONTENT_AREAS.filter((a) => a.advanced);

  const renderCard = (a, { cta = '開始編輯', advanced = false } = {}) => (
    <button
      key={a.id}
      type="button"
      className={`sch-hub__card${advanced ? ' sch-hub__card--advanced' : ''}`}
      onClick={() => setArea(a.id)}
    >
      <div className="sch-hub__card-title">{a.label}</div>
      <p className="sch-hub__card-desc">{a.description}</p>
      {a.howTo ? <p className="sch-hub__card-how">{a.howTo}</p> : null}
      <span className="sch-hub__card-cta">{cta}</span>
    </button>
  );

  return (
    <div className="sch-hub admin-page">
      <header className="sch-hub__header">
        <div className="sch-hub__header-copy">
          <p className="sch-hub__kicker">學生在網站上看到的內容</p>
          <p className="sch-hub__lead">
            上方任務對應網站 Header 的探索選單（活動介紹、學習資源、修課說明、法規表單、關於我們）。
            存檔後前台會更新；不確定時可先開預覽確認。
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
          <h2 className="sch-hub__section-title">網站導覽頁（對應 Header）</h2>
          <p className="sch-hub__section-lead">
            與學生端選單相同：活動介紹 → 學習資源 → 修課說明 → 法規表單 → 關於我們。選一個開始編輯。
          </p>

          <div className="sch-hub__grid">
            {headerAreas.map((a) => renderCard(a))}
          </div>

          <div className="sch-hub__advanced">
            <h3 className="sch-hub__advanced-title">其他固定頁與工具</h3>
            <p className="sch-hub__section-lead sch-hub__section-lead--compact">
              首頁文案、常見問題、媒體庫等不在 Header 主選單，但仍可在此修改。
            </p>
            <div className="sch-hub__grid">
              {otherAreas.map((a) => renderCard(a))}
            </div>
          </div>

          {advancedAreas.length ? (
            <div className="sch-hub__advanced">
              <h3 className="sch-hub__advanced-title">進階（選用）</h3>
              {advancedAreas.map((a) => renderCard(a, { cta: '開啟', advanced: true }))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="sch-hub__workspace">
          <aside className="sch-hub__nav" aria-label="內容任務">
            <div className="sch-hub__nav-label">網站導覽</div>
            {headerAreas.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`sch-hub__nav-item${a.id === area.id ? ' is-active' : ''}`}
                onClick={() => setArea(a.id)}
              >
                <span className="sch-hub__nav-item-title">{a.shortLabel}</span>
              </button>
            ))}
            <div className="sch-hub__nav-label sch-hub__nav-label--spaced">其他</div>
            {[...otherAreas, ...advancedAreas].map((a) => (
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
              <SiteContentManagementPage
                embedded
                forcedSections={area.siteSections || null}
              />
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
