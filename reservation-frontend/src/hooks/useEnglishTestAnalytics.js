/**
 * 培力英檢數據分析：Q21 宣傳來源、系所、年級統計。
 */
import { useState, useCallback, useEffect } from 'react';
import { fetchEnglishTestAnalyticsStats } from '../services/englishTestApi';

const EMPTY_BUCKET = { data: [], total: 0 };

export function useEnglishTestAnalytics({ token, mainTab }) {
  const [infoSourceStats, setInfoSourceStats] = useState(EMPTY_BUCKET);
  const [departmentStats, setDepartmentStats] = useState(EMPTY_BUCKET);
  const [gradeStats, setGradeStats] = useState(EMPTY_BUCKET);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  const loadAnalyticsStats = useCallback(async () => {
    if (mainTab !== 'analytics') return;
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const json = await fetchEnglishTestAnalyticsStats(token);
      setInfoSourceStats(json.infoSource || EMPTY_BUCKET);
      setDepartmentStats(json.department || EMPTY_BUCKET);
      setGradeStats(json.grade || EMPTY_BUCKET);
    } catch (e) {
      console.error(e);
      setInfoSourceStats(EMPTY_BUCKET);
      setDepartmentStats(EMPTY_BUCKET);
      setGradeStats(EMPTY_BUCKET);
      setAnalyticsError(e?.message || '載入統計失敗，請確認後端已重啟並包含數據分析 API');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [mainTab, token]);

  useEffect(() => {
    if (mainTab === 'analytics') loadAnalyticsStats();
  }, [mainTab, loadAnalyticsStats]);

  return {
    infoSourceStats,
    departmentStats,
    gradeStats,
    analyticsLoading,
    analyticsError,
    loadAnalyticsStats,
  };
}
