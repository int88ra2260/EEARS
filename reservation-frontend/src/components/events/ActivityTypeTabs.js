/**
 * 活動類型切換 Tab（依後台啟用中的 event-types）
 */
import React, { useMemo } from 'react';
import useSessionShuffled from '../../hooks/useSessionShuffled';
import useBookableActivityCatalog from '../../hooks/useBookableActivityCatalog';

export default function ActivityTypeTabs({ activeTab, onTabChange, t }) {
  const { bookableCards } = useBookableActivityCatalog();
  const tabDefs = useMemo(
    () => bookableCards.map((card) => ({
      id: card.slug,
      labelKey: card.titleKey || null,
      displayName: card.displayName || card.slug,
    })),
    [bookableCards]
  );
  const tabs = useSessionShuffled(tabDefs, 'activity-intro-tabs');

  return (
    <ul className="nav nav-tabs mb-3" id="activityTabs" role="tablist">
      {tabs.map((tab) => (
        <li key={tab.id} className="nav-item" role="presentation">
          <button
            type="button"
            className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.labelKey ? t(tab.labelKey) : tab.displayName}
          </button>
        </li>
      ))}
    </ul>
  );
}
