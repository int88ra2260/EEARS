/**
 * 培力英檢數據分析：Q21 宣傳來源、系所、年級統計（可依學期篩選）。
 * 預設為目前學期（以後端 activeSemester / 無 query 預設為準）。
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchEnglishTestAnalyticsStats } from '../services/englishTestApi';
import { getCurrentSemester } from '../utils/semesterUtils';

const EMPTY_BUCKET = { data: [], total: 0 };

export function useEnglishTestAnalytics({ token, mainTab }) {
  const [semester, setSemester] = useState(() => getCurrentSemester() || '');
  const [availableSemesters, setAvailableSemesters] = useState([]);
  const [semesterCounts, setSemesterCounts] = useState({});
  const [activeSemester, setActiveSemester] = useState('');
  const [infoSourceStats, setInfoSourceStats] = useState(EMPTY_BUCKET);
  const [departmentStats, setDepartmentStats] = useState(EMPTY_BUCKET);
  const [gradeStats, setGradeStats] = useState(EMPTY_BUCKET);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const hydratedRef = useRef(false);

  const loadAnalyticsStats = useCallback(async (semesterParam) => {
    if (mainTab !== 'analytics') return;
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      // 空字串不帶 query，讓後端依「目前學期」決定預設
      const param = String(semesterParam ?? '').trim();
      const json = await fetchEnglishTestAnalyticsStats(token, {
        semester: param || undefined,
      });
      setInfoSourceStats(json.infoSource || EMPTY_BUCKET);
      setDepartmentStats(json.department || EMPTY_BUCKET);
      setGradeStats(json.grade || EMPTY_BUCKET);
      setAvailableSemesters(json.availableSemesters || []);
      setSemesterCounts(json.semesterCounts || {});
      setActiveSemester(json.activeSemester || '');
      if (!hydratedRef.current) {
        hydratedRef.current = true;
        const resolved =
          json.semester
          || json.activeSemester
          || getCurrentSemester()
          || 'all';
        if (resolved !== param) {
          setSemester(resolved);
        }
      }
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
    if (mainTab !== 'analytics') return;
    loadAnalyticsStats(semester);
  }, [mainTab, semester, loadAnalyticsStats]);

  return {
    semester,
    setSemester,
    availableSemesters,
    semesterCounts,
    activeSemester,
    infoSourceStats,
    departmentStats,
    gradeStats,
    analyticsLoading,
    analyticsError,
    loadAnalyticsStats,
  };
}
