import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getLearningJourneyDataFreshness,
  getLearningJourneyImportHistories,
  getLearningJourneyProfile,
  getLearningJourneyReadiness,
  getLearningJourneyReadModelStatus,
  getLearningJourneyRiskStudents,
  getLearningJourneySemesterOverview,
  getLearningJourneySemesters,
  getLearningJourneySemesterStudents,
  postLearningJourneyRebuildFinal,
} from '../services/learningJourneyApi';
import {
  getReadableError,
  HISTORY_KEY,
  pickDefaultSemesterId,
  TAB_IDS,
} from '../utils/learningJourneyHubFormatters';
import { parseJwtPayload } from '../utils/jwtPayload';

export default function useLearningJourneyHub() {
  const token = localStorage.getItem('token') || '';
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const tokenPayload = parseJwtPayload(token) || {};
  const teacherLevel = String(tokenPayload.teacherLevel || '').toLowerCase();
  const canViewDiagnostics = role === 'admin' || teacherLevel === 'executive' || teacherLevel === 'et_manager';
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = TAB_IDS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'student';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [studentInput, setStudentInput] = useState(searchParams.get('studentId') || '');
  const [semesterInput, setSemesterInput] = useState(searchParams.get('semesterId') || '114-1');
  const [semesters, setSemesters] = useState([]);
  const [profileState, setProfileState] = useState({ status: 'idle', data: null, error: '', requestId: '' });
  const [overviewState, setOverviewState] = useState({
    status: 'idle',
    dashboard: null,
    summary: null,
    departmentStats: null,
    cefrDistribution: null,
    quality: null,
    importHistories: [],
    risk: null,
    error: '',
    requestId: '',
  });
  const [historyRecords, setHistoryRecords] = useState([]);
  const [studentFilters, setStudentFilters] = useState({ keyword: '', grade: '', department: '', skill: '', b2Plus: '', limit: 50, offset: 0 });
  const [studentsState, setStudentsState] = useState({ loading: false, error: '', requestId: '', rows: [], pagination: {}, semesterId: semesterInput, dataSource: '' });
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState(null);
  const [rebuildError, setRebuildError] = useState('');
  const [diagnostics, setDiagnostics] = useState({
    status: { loading: false, data: null, error: '', requestId: '' },
    readiness: { loading: false, data: null, error: '', requestId: '' },
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await getLearningJourneySemesters(token);
        if (!mounted) return;
        setSemesters(Array.isArray(list) ? list : []);
        setSemesterInput((prev) => prev || pickDefaultSemesterId(list));
      } catch (_) {
        // 學期清單失敗時仍保留手動輸入。
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      setHistoryRecords(Array.isArray(parsed) ? parsed : []);
    } catch (_) {
      setHistoryRecords([]);
    }
  }, []);

  const syncQuery = useCallback((tab, extra = {}) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (semesterInput) next.set('semesterId', semesterInput);
    if (studentInput.trim()) next.set('studentId', studentInput.trim());
    Object.entries(extra).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, semesterInput, studentInput, setSearchParams]);

  const selectTab = useCallback((tab) => {
    setActiveTab(tab);
    syncQuery(tab);
  }, [syncQuery]);

  const loadProfile = useCallback(async () => {
    const sid = studentInput.trim();
    if (!sid) {
      setProfileState({ status: 'error', data: null, error: '請先輸入學生學號。', requestId: '' });
      return;
    }
    setActiveTab('student');
    syncQuery('student');
    setProfileState({ status: 'loading', data: null, error: '', requestId: '' });
    try {
      const data = await getLearningJourneyProfile(token, sid);
      const dataQuality = Array.isArray(data?.dataQuality) ? data.dataQuality : [];
      const noStudent = dataQuality.some((q) => q?.code === 'NO_STUDENT_AGGREGATE');
      setProfileState({ status: noStudent ? 'empty' : 'success', data, error: '', requestId: '' });
    } catch (error) {
      setProfileState({ status: 'error', data: null, error: getReadableError(error, '學生學習歷程取得失敗。'), requestId: error.requestId || '' });
    }
  }, [studentInput, syncQuery, token]);

  const loadOverview = useCallback(async () => {
    const semesterId = semesterInput.trim();
    if (!semesterId) {
      setOverviewState({ status: 'error', dashboard: null, risk: null, error: '請先選擇或輸入學期。', requestId: '' });
      return;
    }
    setActiveTab('overview');
    syncQuery('overview');
    setOverviewState((prev) => ({ ...prev, status: 'loading', error: '', requestId: '' }));
    try {
      const [overview, importHistoryData, risk, freshness] = await Promise.all([
        getLearningJourneySemesterOverview(token, semesterId).catch(() => null),
        getLearningJourneyImportHistories(token, semesterId, { limit: 200 }).catch(() => null),
        getLearningJourneyRiskStudents(token, semesterId).catch(() => null),
        getLearningJourneyDataFreshness(token, semesterId).catch(() => null),
      ]);
      if (!overview && !risk) {
        setOverviewState((prev) => ({
          ...prev,
          status: 'error',
          error: '目前無法取得此學期總覽資料，請稍後再試或確認學期代碼。',
          requestId: '',
        }));
        return;
      }

      const importHistories = Array.isArray(importHistoryData?.items) ? importHistoryData.items : [];
      const snapshotSummary = overview || null;
      if (snapshotSummary) {
        try {
          const fingerprint = [
            semesterId,
            snapshotSummary.denominator,
            snapshotSummary.skills?.listening?.b2PlusCount,
            snapshotSummary.skills?.reading?.b2PlusCount,
            snapshotSummary.skills?.speaking?.b2PlusCount,
            snapshotSummary.skills?.writing?.b2PlusCount,
          ].join('|');
          const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
          const arr = Array.isArray(existing) ? existing : [];
          const next = arr[0]?.fingerprint === fingerprint
            ? arr
            : [{ id: `auto-${Date.now()}`, fingerprint, createdAt: new Date().toISOString(), semesterId, summary: snapshotSummary }, ...arr].slice(0, 50);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
          setHistoryRecords(next);
        } catch (_) {
          // 本機快照失敗不影響總覽查詢。
        }
      }

      setOverviewState({
        status: 'success',
        dashboard: null,
        summary: overview ? { ...overview, freshness } : null,
        departmentStats: null,
        cefrDistribution: null,
        quality: overview ? { kpis: { rosterStudentCount: overview.denominator }, warnings: overview.warnings } : null,
        importHistories,
        risk,
        error: '',
        requestId: '',
      });
    } catch (error) {
      setOverviewState((prev) => ({ ...prev, status: 'error', error: getReadableError(error, '學期總覽取得失敗。'), requestId: error.requestId || '' }));
    }
  }, [semesterInput, syncQuery, token]);

  const loadStudents = useCallback(async (patch = {}) => {
    const semesterId = semesterInput.trim();
    if (!semesterId) {
      setStudentsState((prev) => ({ ...prev, error: '請先選擇或輸入學期。', requestId: '' }));
      return;
    }
    const filters = { ...studentFilters, ...patch };
    setActiveTab('students');
    syncQuery('students');
    setStudentsState((prev) => ({ ...prev, loading: true, error: '', requestId: '', semesterId }));
    try {
      const data = await getLearningJourneySemesterStudents(token, semesterId, filters);
      setStudentsState({
        loading: false,
        error: '',
        requestId: '',
        rows: Array.isArray(data?.items) ? data.items : [],
        pagination: data?.pagination || { limit: filters.limit, offset: filters.offset, returned: Array.isArray(data?.items) ? data.items.length : 0 },
        semesterId,
        dataSource: String(data?.source || ''),
      });
      setStudentFilters(filters);
    } catch (error) {
      setStudentsState({ loading: false, error: getReadableError(error, '學生名單取得失敗。'), requestId: error.requestId || '', rows: [], pagination: {}, semesterId, dataSource: '' });
    }
  }, [semesterInput, studentFilters, syncQuery, token]);

  const setDiagnosticState = useCallback((key, patch) => {
    setDiagnostics((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  const loadDiagnostic = useCallback(async (key, loader) => {
    setDiagnosticState(key, { loading: true, error: '', requestId: '' });
    try {
      const data = await loader();
      setDiagnosticState(key, { loading: false, data, error: '', requestId: '' });
    } catch (error) {
      setDiagnosticState(key, { loading: false, data: null, error: getReadableError(error, '檢查失敗。'), requestId: error.requestId || '' });
    }
  }, [setDiagnosticState]);

  const loadDiagnosticStatus = useCallback(() => (
    loadDiagnostic('status', () => getLearningJourneyReadModelStatus(token))
  ), [loadDiagnostic, token]);

  const loadDiagnosticReadiness = useCallback(() => (
    loadDiagnostic('readiness', () => getLearningJourneyReadiness(token, semesterInput.trim()))
  ), [loadDiagnostic, semesterInput, token]);

  const rebuildBestSkills = useCallback(async () => {
    const semesterId = semesterInput.trim();
    if (!semesterId) {
      setRebuildError('請先選擇或輸入學期。');
      return;
    }
    const ok = window.confirm('將重新計算此學期所有學生的最佳成績快取，是否繼續？');
    if (!ok) return;
    setRebuilding(true);
    setRebuildError('');
    setRebuildResult(null);
    try {
      const result = await postLearningJourneyRebuildFinal(token, semesterId);
      setRebuildResult(result);
      await loadOverview();
    } catch (error) {
      setRebuildError(getReadableError(error, '重新計算最佳成績失敗。'));
    } finally {
      setRebuilding(false);
    }
  }, [loadOverview, semesterInput, token]);

  const tabItems = useMemo(() => [
    { id: 'student', label: '學生查詢' },
    { id: 'overview', label: '學期總覽' },
    { id: 'students', label: '學生名單' },
    ...(canViewDiagnostics ? [{ id: 'diagnostics', label: '資料來源與診斷' }] : []),
  ], [canViewDiagnostics]);

  return {
    activeTab,
    canViewDiagnostics,
    diagnostics,
    historyRecords,
    loadDiagnostic,
    loadDiagnosticReadiness,
    loadDiagnosticStatus,
    loadOverview,
    loadProfile,
    loadStudents,
    overviewState,
    profileState,
    rebuild: rebuildBestSkills,
    rebuildError,
    rebuildResult,
    rebuilding,
    selectTab,
    semesterInput,
    semesters,
    setSemesterInput,
    setStudentFilters,
    setStudentInput,
    studentFilters,
    studentInput,
    studentsState,
    syncQuery,
    tabItems,
  };
}
