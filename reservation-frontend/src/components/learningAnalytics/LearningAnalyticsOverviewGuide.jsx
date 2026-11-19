import React from 'react';
import { Link } from 'react-router-dom';
import LaFold from './LaFold';

export default function LearningAnalyticsOverviewGuide() {
  return (
    <LaFold label="如何使用本頁" className="mb-3">
      <ol className="small mb-0 ps-3">
        <li className="mb-1">
            本頁多數圖表看分析快照；「各入學年度尚無英檢／B1／B1+」改以選定學期的學期在學名冊為分母。
          </li>
          <li className="mb-1">
            聽讀成對、說寫成對達標，請到
            {' '}
            <Link to="/admin/learning-analytics/kpi-report">B2 KPI 報表</Link>
            （同樣依學期在學名冊）。
          </li>
        <li>
          若下方顯示尚無資料，請先到學習歷程維運執行背景重建。
        </li>
      </ol>
    </LaFold>
  );
}
