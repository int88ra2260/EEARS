import React, { useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import { scopeSearchPath } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';
import '../../components/learningAnalytics/learningAnalytics.css';

/**
 * 學習成效各頁共用的頁名列。文字與到達後的頁名相同。
 * 找學生留在左側選單。同一頁的兩種看法由各頁自己的模式切換。
 */
const PAGE_LINKS = [
  {
    id: 'overview',
    to: '/admin/learning-analytics/overview',
    label: '學習成效概況',
  },
  {
    id: 'kpi',
    to: '/admin/learning-analytics/kpi-report',
    label: '學期 B2 KPI',
  },
  {
    id: 'resources',
    to: '/admin/learning-analytics/resources',
    label: '資源與開課分析',
    match: ['/admin/learning-analytics/resources', '/admin/learning-analytics/offerings'],
  },
  {
    id: 'comparison',
    to: '/admin/learning-analytics/cohorts',
    label: '群體與技能比較',
    match: ['/admin/learning-analytics/cohorts', '/admin/learning-analytics/skills'],
  },
  {
    id: 'raw',
    to: '/admin/learning-analytics/raw-data',
    label: '資料匯出',
  },
  {
    id: 'settings',
    to: '/admin/learning-analytics/settings',
    label: '分析設定',
    manageOnly: true,
  },
];

function isPageCurrent(pathname, item) {
  const targets = item.match || [item.to];
  return targets.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function LearningAnalyticsLayout() {
  const location = useLocation();
  const canManageSettings = useMemo(() => {
    const token = localStorage.getItem('token');
    return hasPermission(buildAccessProfile(token), P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS);
  }, []);
  const links = PAGE_LINKS.filter((item) => !item.manageOnly || canManageSettings);

  return (
    <div className="learning-analytics-shell">
      <nav className="la-subnav la-page-nav" aria-label="學習成效頁面">
        {links.map((item) => {
          const current = isPageCurrent(location.pathname, item);
          return (
            <Link
              key={item.id}
              to={scopeSearchPath(item.to, location.search)}
              className={current ? 'active' : undefined}
              aria-current={current ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
