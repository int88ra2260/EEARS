import React from 'react';
import { Link } from 'react-router-dom';
import LaFold from './LaFold';

export default function LearningAnalyticsOverviewGuide() {
  return (
    <LaFold label="如何使用本頁" className="mb-3">
      <ol className="small mb-0 ps-3">
        <li className="mb-1">
          本頁分為兩區：
          {' '}
          <strong>A 學期營運</strong>
          （名冊分母 KPI／缺口）與
          {' '}
          <strong>B 能力觀察</strong>
          （分析快照累積）。請勿把 B 區的累積 B2 當學期 KPI。
        </li>
        <li className="mb-1">
          要看學期達標與匯出未達標／缺重測名單：選好學期後看 A 區，或到
          {' '}
          <Link to="/admin/learning-analytics/kpi-report">B2 KPI 報表</Link>
          。
        </li>
        <li className="mb-1">
          要比系所或入學年度，請到
          {' '}
          <Link to="/admin/learning-analytics/cohorts">群體分析</Link>
          ；要比資源與進步的關聯，請到
          {' '}
          <Link to="/admin/learning-analytics/resources">資源效益</Link>
          。
        </li>
        <li>若 B 區顯示尚無資料，請先到學習歷程維運執行背景重建。</li>
      </ol>
    </LaFold>
  );
}
