import React, { useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import '../../components/learningAnalytics/learningAnalytics.css';

/**
 * 導覽分組：先對齊「要回答什麼問題」，再進子頁。
 * 路徑不變，只改標籤與分組呈現。
 */
const NAV_GROUPS = [
  {
    id: 'report',
    title: '上呈與總覽',
    items: [
      {
        to: '/admin/learning-analytics/overview',
        label: '總覽',
        hint: '學期營運 KPI vs 能力觀察',
        end: false,
      },
      {
        to: '/admin/learning-analytics/kpi-report',
        label: 'B2 KPI 報表',
        hint: '正式上呈：聽讀／說寫達標人數',
      },
    ],
  },
  {
    id: 'ability',
    title: '能力觀察',
    items: [
      {
        to: '/admin/learning-analytics/cohorts',
        label: '系所比較',
        hint: '依系所／入學年看差異',
      },
      {
        to: '/admin/learning-analytics/skills',
        label: '技能成長',
        hint: '聽讀說寫 GSE 成長',
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
    title: '資源對照',
    items: [
      {
        to: '/admin/learning-analytics/offerings',
        label: '課／師／活動',
        hint: '哪門課／哪位師值得盯',
      },
      {
        to: '/admin/learning-analytics/resources',
        label: '資源效益',
        hint: '類型參與對照（描述為主）',
      },
    ],
  },
  {
    id: 'ops',
    title: '探索與維運',
    items: [
      {
        to: '/admin/learning-analytics/insights',
        label: '圖表探索',
        hint: '散佈／熱圖（實驗）',
      },
      {
        to: '/admin/learning-analytics/raw-data',
        label: '資料匯出',
        hint: '原始資料預覽與下載',
      },
      {
        to: '/admin/learning-analytics/model-runs',
        label: '分析紀錄',
        hint: '固化當次篩選結果',
      },
      {
        to: '/admin/learning-analytics/settings',
        label: '模組設定',
        hint: '參數／資源技能檔',
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
      <header className="la-page-header">
        <p className="la-page-subtitle mb-0">
          上呈用 B2 KPI；其餘頁面用來觀察能力與資源關聯。數字用來比較趨勢，不是保證參加就進步。
        </p>
      </header>
      <nav className="la-subnav-grouped" aria-label="學習成效分析子頁">
        {groups.map((group) => (
          <div key={group.id} className="la-subnav-group">
            <div className="la-subnav-group-title">{group.title}</div>
            <div className="la-subnav-group-links">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.hint}
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <span className="la-subnav-label">{item.label}</span>
                  {item.hint ? <span className="la-subnav-hint">{item.hint}</span> : null}
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
