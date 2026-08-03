/**
 * 活動類型切換 Tab（English Table / Club / Forum / Job Talk）
 * 僅 UI 切換，不處理資料；實際 Tab 列表由 eventsContentConfig 驅動
 */
import React from 'react';
import { ACTIVITY_TABS } from '../../constants/eventsContentConfig';
import useSessionShuffled from '../../hooks/useSessionShuffled';

export default function ActivityTypeTabs({ activeTab, onTabChange, t }) {
  const tabs = useSessionShuffled(ACTIVITY_TABS, 'activity-intro-tabs');

  return (
    <ul className="nav nav-tabs mb-3" id="activityTabs" role="tablist">
      {tabs.map((tab) => (
        <li key={tab.id} className="nav-item" role="presentation">
          <button
            type="button"
            className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {t(tab.labelKey)}
          </button>
        </li>
      ))}
    </ul>
  );
}
