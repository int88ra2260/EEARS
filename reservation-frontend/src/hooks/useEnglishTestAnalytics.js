/**
 * 培力英檢數據分析：Q21 從何得知培力英檢統計。
 */
import { useState, useCallback, useEffect } from 'react';
import { fetchInfoSourceStats } from '../services/englishTestApi';

export function useEnglishTestAnalytics({ token, mainTab }) {
  const [infoSourceStats, setInfoSourceStats] = useState({ data: [], total: 0 });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadInfoSourceStats = useCallback(async () => {
    if (mainTab !== 'analytics') return;
    setAnalyticsLoading(true);
    try {
      const json = await fetchInfoSourceStats(token);
      setInfoSourceStats({ data: json.data || [], total: json.total || 0 });
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [mainTab, token]);

  useEffect(() => {
    if (mainTab === 'analytics') loadInfoSourceStats();
  }, [mainTab, loadInfoSourceStats]);

  return {
    infoSourceStats,
    analyticsLoading,
    loadInfoSourceStats
  };
}
