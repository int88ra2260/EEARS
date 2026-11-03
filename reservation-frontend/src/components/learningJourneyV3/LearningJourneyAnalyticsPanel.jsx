import React from 'react';
import { Link } from 'react-router-dom';

function buildAnalyticsOverviewHref(semesterId) {
  const sem = String(semesterId || '').trim();
  const qs = sem ? `?semester=${encodeURIComponent(sem)}` : '';
  return `/admin/learning-analytics/overview${qs}`;
}

/**
 * 名冊頁只說明成效分析在另一個資料範圍，不把全域快照人數畫在這裡。
 */
export default function LearningJourneyAnalyticsPanel({ semesterId }) {
  const overviewHref = buildAnalyticsOverviewHref(semesterId);
  const resourcesHref = semesterId
    ? `/admin/learning-analytics/resources?semester=${encodeURIComponent(semesterId)}`
    : '/admin/learning-analytics/resources';

  return (
    <div>
      <p className="mb-2">
        <strong>資料範圍：學期名冊</strong>
      </p>
      <p className="small text-muted mb-3">
        本頁的單技能 B2、年級與系所分項、學生清單都來自選定學期的名冊。
        能力分布與可比較樣本在學習成效快照，學期成對達標在 KPI 報表。三處人數不能相加，也不能互相代替。
      </p>
      <div className="d-flex flex-wrap gap-2">
        <Link className="btn btn-primary btn-sm" to={overviewHref}>
          查看學習成效分析
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" to={resourcesHref}>
          資源覆蓋
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" to="/admin/learning-journey/operations">
          學習歷程維運
        </Link>
      </div>
    </div>
  );
}
