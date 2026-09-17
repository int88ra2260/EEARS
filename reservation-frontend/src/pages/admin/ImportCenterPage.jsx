import React, { useMemo } from 'react';
import { Button } from 'react-bootstrap';
import StatusBadge from '../../components/ui/StatusBadge';
import { bootstrapBgToStatusVariant } from '../../utils/statusBadgeUtils';
import { Link, useOutletContext } from 'react-router-dom';
import ImportTaskCard from '../../components/admin/import/ImportTaskCard';
import { canAccessAdminRoute } from '../../constants/adminRouteAccess';
import {
  getImportCenterSections,
  IMPORT_CENTER_TASK_GUIDES,
} from '../../constants/importCenterCards';
import {
  IMPORT_STATUS_BADGE,
  IMPORT_STATUS_LABEL,
  IMPORT_STATUS_TIER,
} from '../../constants/importCenterStatus';
import useScrollReveal from '../../hooks/useScrollReveal';
import { buildAccessProfile } from '../../utils/accessControl';
import '../../styles/import-center.css';

const STATUS_LEGEND_ORDER = [
  IMPORT_STATUS_TIER.ENABLED,
  IMPORT_STATUS_TIER.EXPORT_ONLY,
  IMPORT_STATUS_TIER.PENDING,
  IMPORT_STATUS_TIER.DISABLED,
];

const GUIDE_POINTS = [
  {
    label: '先對照資料',
    text: '每張卡片都標示「匯入什麼」：要準備哪種 Excel／來源，以及是否需選學期。',
  },
  {
    label: '再確認影響',
    text: '「會影響什麼」說明寫入後哪些報表、名單或統計會變；避免選錯入口。',
  },
  {
    label: '再到原頁上傳',
    text: '本頁只做導覽；實際上傳、預覽與寫入仍在各功能頁完成。',
  },
];

function StatusLegend() {
  return (
    <div className="import-center-legend" role="list" aria-label="狀態說明">
      <span className="import-center-legend__label">狀態</span>
      {STATUS_LEGEND_ORDER.map((tier) => {
        const meta = IMPORT_STATUS_BADGE[tier];
        return (
          <StatusBadge
            key={tier}
            variant={bootstrapBgToStatusVariant(meta.bg)}
            size="sm"
            className={`import-center-legend__badge ${meta.textClass || ''}`.trim()}
            role="listitem"
          >
            {IMPORT_STATUS_LABEL[tier]}
          </StatusBadge>
        );
      })}
    </div>
  );
}

/**
 * 資料匯入中心（P11 入口；P14-2 UI 分區）
 */
export default function ImportCenterPage() {
  const { token, userRole } = useOutletContext();
  const accessProfile = useMemo(
    () => buildAccessProfile(token || '', userRole || ''),
    [token, userRole],
  );

  const sections = getImportCenterSections();
  useScrollReveal('.import-center-reveal');

  return (
    <main className="import-center-page">
      <header className="import-center-page__header import-center-reveal">
        <p className="import-center-page__kicker">管理後台 · 資料維運</p>
        <div className="import-center-page__title-row">
          <StatusLegend />
        </div>
        <p className="import-center-page__lede">
          先確認要匯入哪種資料、會影響哪些報表，再進入對應頁上傳。本頁不直接收檔。
        </p>
      </header>

      <div className="import-center-guide import-center-reveal" style={{ '--reveal-delay': '60ms' }}>
        {GUIDE_POINTS.map((point) => (
          <div key={point.label} className="import-center-guide__item">
            <span className="import-center-guide__label">{point.label}</span>
            <p className="import-center-guide__text">{point.text}</p>
          </div>
        ))}
      </div>

      <aside
        className="import-center-task-guide import-center-reveal"
        style={{ '--reveal-delay': '90ms' }}
        aria-label="常見任務導引"
      >
        <div className="import-center-task-guide__head">
          <span className="import-center-task-guide__eyebrow">常見任務</span>
          <p className="import-center-task-guide__intro">
            不確定該點哪張卡片時，可先對照目標再選入口。
          </p>
        </div>
        <ul className="import-center-task-guide__list">
          {IMPORT_CENTER_TASK_GUIDES.map((task) => (
            <li key={task.id} className="import-center-task-guide__item">
              <p className="import-center-task-guide__goal">{task.goal}</p>
              <ol className="import-center-task-guide__steps">
                {task.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </aside>

      <aside
        className="import-center-runs-banner import-center-reveal"
        style={{ '--reveal-delay': '120ms' }}
        aria-label="匯入紀錄快速入口"
      >
        <div className="import-center-runs-banner__copy">
          <span className="import-center-runs-banner__eyebrow">維運查詢</span>
          <p className="import-center-runs-banner__text">
            匯入紀錄中心：跨模組查詢最近匯入、同步與稽核摘要；具權限者可刪除並回滾錯誤匯入批次。
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

      {sections.every((section) =>
        section.cards.every((card) => !canAccessAdminRoute(accessProfile, card.routeAccess))
      ) ? (
        <div className="alert alert-info mt-3" role="status">
          <strong>目前無可操作的匯入項目。</strong>
          <p className="mb-0 mt-1 small">
            您的權限尚未涵蓋任何匯入功能。如需使用，請聯絡系統管理員調整您的帳號角色。
          </p>
        </div>
      ) : null}

      {sections.map((section, sectionIndex) => (
        <section
          key={section.id}
          className="import-center-section import-center-reveal"
          style={{ '--reveal-delay': `${180 + sectionIndex * 80}ms` }}
          aria-labelledby={`import-section-${section.id}`}
        >
          <div className="import-center-section__head">
            <h2 id={`import-section-${section.id}`} className="import-center-section__title">
              {section.title}
            </h2>
            <p className="import-center-section__desc">{section.description}</p>
          </div>
          <div
            className={`import-center-bento import-center-bento--${section.id}`}
            role="list"
          >
            {section.cards.map((card, cardIndex) => (
              <div
                key={card.id}
                className="import-center-bento__cell import-center-reveal"
                style={{ '--reveal-delay': `${240 + sectionIndex * 80 + cardIndex * 50}ms` }}
                role="listitem"
              >
                <ImportTaskCard card={card} accessProfile={accessProfile} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
