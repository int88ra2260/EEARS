import { useMemo, useState } from 'react';
import { PHRASEBOOK_ACTIVITY_TABS } from '../data/learningContent/phrasebookItems';

/**
 * @param {string} [initialTabKey]
 */
export default function usePhrasebookFilter(initialTabKey = 'all') {
  const [activeTabKey, setActiveTabKey] = useState(initialTabKey);

  const activeTab = useMemo(
    () => PHRASEBOOK_ACTIVITY_TABS.find((t) => t.key === activeTabKey) || PHRASEBOOK_ACTIVITY_TABS[0],
    [activeTabKey],
  );

  return {
    activeTabKey,
    setActiveTabKey,
    activeTab,
    tabs: PHRASEBOOK_ACTIVITY_TABS,
    activityType: activeTab.activityType,
  };
}
