import React, { useMemo } from 'react';
import { Button } from 'react-bootstrap';
import { Link, useOutletContext } from 'react-router-dom';
import ImportHubCard from '../../components/admin/import/ImportHubCard';
import ImportTaskCard from '../../components/admin/import/ImportTaskCard';
import { canAccessAdminRoute } from '../../constants/adminRouteAccess';
import {
  getImportCenterMoreSections,
  IMPORT_CENTER_PRIMARY_HUBS,
  IMPORT_CENTER_ROSTER_GUIDE,
} from '../../constants/importCenterCards';
import useScrollReveal from '../../hooks/useScrollReveal';
import { buildAccessProfile } from '../../utils/accessControl';
import '../../styles/import-center.css';

/**
 * 資料匯入中心：只列實際仍在用的匯入／同步入口。
 */
export default function ImportCenterPage() {
  const { token, userRole } = useOutletContext();
  const accessProfile = useMemo(
    () => buildAccessProfile(token || '', userRole || ''),
    [token, userRole],
  );

  const hubs = IMPORT_CENTER_PRIMARY_HUBS;
  const moreSections = getImportCenterMoreSections();
  const canAnyHub = hubs.some((hub) => canAccessAdminRoute(accessProfile, hub.routeAccess));
  const canAnyMore = moreSections.some((section) =>
    section.cards.some((card) => canAccessAdminRoute(accessProfile, card.routeAccess)),
  );

  useScrollReveal('.import-center-reveal');

  return (
    <main className="import-center-page">
      <header className="import-center-page__header import-center-reveal">
        <p className="import-center-page__kicker">管理後台 · 資料維運</p>
        <h1 className="import-center-page__title">資料匯入中心</h1>
        <p className="import-center-page__lede">
          依任務選入口，再到原頁上傳。本頁不直接收檔。
        </p>
      </header>

      <aside
        className="import-center-runs-banner import-center-reveal"
        style={{ '--reveal-delay': '60ms' }}
        aria-label="匯入紀錄快速入口"
      >
        <div className="import-center-runs-banner__copy">
          <span className="import-center-runs-banner__eyebrow">維運查詢</span>
          <p className="import-center-runs-banner__text">
            匯入紀錄中心：跨模組查詢最近匯入與稽核摘要；具權限者可回滾錯誤批次。
          </p>
        </div>
        <Button
          as={Link}
          to="/admin/import-center/runs"
          variant="primary"
          size="sm"
          className="import-center-runs-banner__cta"
        >
          查看匯入紀錄
        </Button>
      </aside>

      <aside
        className="import-center-roster-note import-center-reveal"
        style={{ '--reveal-delay': '80ms' }}
        aria-label="名冊怎麼選"
      >
        <p className="import-center-roster-note__title">三種名冊不要混用</p>
        <ol className="import-center-roster-note__list">
          {IMPORT_CENTER_ROSTER_GUIDE.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </aside>

      {!canAnyHub && !canAnyMore ? (
        <div className="alert alert-info mt-3" role="status">
          <strong>目前無可操作的匯入項目。</strong>
          <p className="mb-0 mt-1 small">
            您的權限尚未涵蓋任何匯入功能。如需使用，請聯絡系統管理員調整您的帳號角色。
          </p>
        </div>
      ) : null}

      <section
        className="import-center-section import-center-reveal"
        style={{ '--reveal-delay': '100ms' }}
        aria-labelledby="import-section-primary"
      >
        <div className="import-center-section__head">
          <h2 id="import-section-primary" className="import-center-section__title">
            常用任務
          </h2>
          <p className="import-center-section__desc">
            同頁可完成的匯入已合併成一個入口；培力成績與報名核對仍分開，避免名冊混淆。
          </p>
        </div>
        <div className="import-center-bento import-center-bento--hubs" role="list">
          {hubs.map((hub, index) => (
            <div
              key={hub.id}
              className="import-center-bento__cell import-center-reveal"
              style={{ '--reveal-delay': `${140 + index * 40}ms` }}
              role="listitem"
            >
              <ImportHubCard hub={hub} accessProfile={accessProfile} />
            </div>
          ))}
        </div>
      </section>

      {moreSections.length ? (
        <details className="import-center-more import-center-reveal" style={{ '--reveal-delay': '280ms' }}>
          <summary className="import-center-more__summary">
            <span className="import-center-more__title">例外與維運</span>
            <span className="import-center-more__hint">班級例外補丁、學習歷程健康檢查</span>
          </summary>
          <div className="import-center-more__body">
            {moreSections.map((section) => (
              <section
                key={section.id}
                className="import-center-section"
                aria-labelledby={`import-section-${section.id}`}
              >
                <div className="import-center-section__head">
                  <h3 id={`import-section-${section.id}`} className="import-center-section__title">
                    {section.title}
                  </h3>
                  <p className="import-center-section__desc">{section.description}</p>
                </div>
                <div
                  className={`import-center-bento import-center-bento--${section.id}`}
                  role="list"
                >
                  {section.cards.map((card) => (
                    <div key={card.id} className="import-center-bento__cell" role="listitem">
                      <ImportTaskCard card={card} accessProfile={accessProfile} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </details>
      ) : null}
    </main>
  );
}
