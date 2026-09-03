import React from 'react';
import { Link } from 'react-router-dom';
import LaFold from './LaFold';

export default function LearningAnalyticsOverviewGuide() {
  return (
    <LaFold label="如何使用本頁" className="mb-3">
      <ol className="small mb-0 ps-3">
        <li className="mb-1">選好要看的學生群體後按「套用篩選」。</li>
        <li className="mb-1">四張卡片是整體摘要；指標旁的 ⓘ 是定義。</li>
        <li className="mb-1">
          要比系所或入學年度，請到
          {' '}
          <Link to="/admin/learning-analytics/cohorts">群體分析</Link>
          ；要比資源類型與進步的關聯（描述／進階觀察估計），請到
          {' '}
          <Link to="/admin/learning-analytics/resources">資源效益</Link>
          。
        </li>
        <li>若顯示尚無資料，請先到學習歷程維運執行背景重建。</li>
      </ol>
    </LaFold>
  );
}
