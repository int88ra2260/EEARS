import React, { useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import '../../components/learningAnalytics/learningAnalytics.css';

const TABS = [
  { to: '/admin/learning-analytics/overview', label: '中心總覽', end: false },
  { to: '/admin/learning-analytics/cohorts', label: '群體分析' },
  { to: '/admin/learning-analytics/offerings', label: '細項分析' },
  { to: '/admin/learning-analytics/resources', label: '資源效益' },
  { to: '/admin/learning-analytics/skills', label: '技能成長' },
  { to: '/admin/learning-analytics/students', label: '學習軌跡' },
  { to: '/admin/learning-analytics/raw-data', label: '原始資料' },
  { to: '/admin/learning-analytics/insights', label: '進階分析' },
  { to: '/admin/learning-analytics/model-runs', label: '分析紀錄' },
  { to: '/admin/learning-analytics/settings', label: '模組設定', manageOnly: true },
];

export default function LearningAnalyticsLayout() {
  const canManageSettings = useMemo(() => {
    const token = localStorage.getItem('token');
    return hasPermission(buildAccessProfile(token), P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS);
  }, []);

  const tabs = TABS.filter((tab) => !tab.manageOnly || canManageSettings);

  return (
    <div className="learning-analytics-shell">
      <header className="la-page-header">
        <p className="la-page-subtitle mb-0">
          看程度分布、進步幅度，以及課程／活動與進步的關聯。數字用來比較趨勢，不是保證參加就進步。
        </p>
      </header>
      <nav className="la-subnav" aria-label="學習成效分析子頁">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
