import React from 'react';
import { Link } from 'react-router-dom';
import LaFold from './LaFold';

export default function LearningAnalyticsOverviewGuide() {
  return (
    <LaFold label="如何使用本頁" className="mb-3">
      <ol className="small mb-0 ps-3">
        <li className="mb-1">
          本頁看分析快照的能力分布與資料是否夠用來比較。
        </li>
        <li className="mb-1">
          學期名冊的聽讀成對、說寫成對達標，請到
          {' '}
          <Link to="/admin/learning-analytics/kpi-report">B2 KPI 報表</Link>
          。
        </li>
        <li>
          若下方顯示尚無資料，請先到學習歷程維運執行背景重建。
        </li>
      </ol>
    </LaFold>
  );
}
