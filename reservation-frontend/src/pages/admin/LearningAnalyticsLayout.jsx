import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import { isFinderWorkspace } from '../../constants/adminNavigation';
import '../../components/learningAnalytics/learningAnalytics.css';

/**
 * 頁內分列：上呈、看資源、比較與資料。
 * 找學生只留在左側選單；條件探索、接近 B2、追蹤名單與學號用頁內流程切換。
 */
const NAV_GROUPS = [
  {
    id: 'report',
    title: '上呈',
    items: [
      {
        to: '/admin/learning-analytics/overview',
        label: '總覽',
        hint: '分析快照的能力分布與資料夠不夠',
        end: false,
      },
      {
        to: '/admin/learning-analytics/kpi-report',
        label: 'B2 KPI 報表',
        hint: '上呈：聽讀成對、說寫成對達標',
      },
    ],
  },
  {
    id: 'resource',
    title: '看資源',
    items: [
      {
        to: '/admin/learning-analytics/offerings',
        label: '課／師／活動',
        hint: '參與、樣本、細項資料品質',
      },
      {
        to: '/admin/learning-analytics/resources',
        label: '資源覆蓋',
        hint: '類型參與與可觀察樣本',
      },
    ],
  },
  {
    id: 'compare',
    title: '比較與資料',
    items: [
      {
        to: '/admin/learning-analytics/cohorts',
        label: '系所比較',
        hint: '依系所／入學年看 GSE 差異',
      },
      {
        to: '/admin/learning-analytics/skills',
        label: '技能成長',
        hint: '聽讀說寫 GSE 成長',
      },
      {
        to: '/admin/learning-analytics/raw-data',
        label: '資料匯出',
        hint: '原始資料預覽與下載',
      },
      {
        to: '/admin/learning-analytics/settings',
        label: '分析設定',
        hint: '下拉選項／資源技能／資料版本',
        manageOnly: true,
      },
    ],
  },
];

export default function LearningAnalyticsLayout() {
  const location = useLocation();
  const finderWorkspace = isFinderWorkspace(location.pathname);
  const canManageSettings = useMemo(() => {
    const token = localStorage.getItem('token');
    return hasPermission(buildAccessProfile(token), P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS);
  }, []);

  const groups = useMemo(
    () => NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.manageOnly || canManageSettings),
    })).filter((group) => group.items.length > 0),
    [canManageSettings]
  );

  return (
    <div className="learning-analytics-shell">
      {finderWorkspace ? null : <nav className="la-subnav-rows" aria-label="學習成效分析">
        {groups.map((group) => (
          <div key={group.id} className="la-subnav-row">
            <span className="la-subnav-row-title">{group.title}</span>
            <div className="la-subnav-row-links">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.hint}
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>}
      <Outlet />
    </div>
  );
}
