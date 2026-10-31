import React, { useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import '../../components/learningAnalytics/learningAnalytics.css';

/**
 * 頁內依四件事分列：上呈、找人、看資源、比較與資料。
 * 滑過頁名可看這頁在回答什麼。左側選單分組與這裡相同。
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
    id: 'people',
    title: '找人',
    items: [
      {
        to: '/admin/learning-analytics/b1-plus',
        label: '接近 B2',
        hint: 'GSE 51–58：前測、修課、活動',
      },
      {
        to: '/admin/learning-analytics/explore',
        label: '學生探索',
        hint: '左側篩選，右側看名單',
      },
      {
        to: '/admin/learning-analytics/tracking-cohorts',
        label: '追蹤名單',
        hint: '固定一批學生，之後回來看變化',
      },
      {
        to: '/admin/learning-analytics/students',
        label: '個人軌跡',
        hint: '從名單點進輔導摘要',
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
      <nav className="la-subnav-rows" aria-label="學習成效分析">
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
      </nav>
      <Outlet />
    </div>
  );
}
