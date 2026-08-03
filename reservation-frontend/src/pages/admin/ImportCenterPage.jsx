import React, { useMemo } from 'react';
import { Button } from 'react-bootstrap';
import StatusBadge from '../../components/ui/StatusBadge';
import { bootstrapBgToStatusVariant } from '../../utils/statusBadgeUtils';
import { Link, useOutletContext } from 'react-router-dom';
import ImportTaskCard from '../../components/admin/import/ImportTaskCard';
import { getImportCenterSections } from '../../constants/importCenterCards';
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
    label: '集中入口',
    text: '匯入、同步與匯出功能由此一次找到，不必在各模組間來回搜尋。',
  },
  {
    label: '原頁操作',
    text: '實際上傳、預覽與寫入仍在各功能頁完成；本頁僅提供導覽與說明。',
  },
  {
    label: '流程不變',
    text: '未重構後端 API，既有匯入邏輯與權限檢查維持原樣。',
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
          <h1 className="import-center-page__title">資料匯入中心</h1>
          <StatusLegend />
        </div>
        <p className="import-center-page__lede">
          行政人員的匯入與同步起點。選擇下方項目後，將導向既有功能頁完成操作。
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
