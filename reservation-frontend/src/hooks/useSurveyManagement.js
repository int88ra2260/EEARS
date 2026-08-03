/**
 * 問卷管理（legacy 統計／匯出頁）：統計載入與匯出。
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeAPICall, showErrorMessage } from '../utils/errorHandler';
import { buildAccessProfile, canAccessSurvey, hasPermission } from '../utils/accessControl';
import { P } from '../constants/permissions';
import {
  downloadBlob,
  exportSurveyData,
  fetchSurveyStats as fetchSurveyStatsApi,
} from '../services/surveyAdminApi';

const ALL_SURVEYS = [
  { id: 'english_table_feedback_114_1', name: 'English Table 問卷' },
  { id: 'english_club_feedback_114_1', name: 'English Club 問卷' },
];

export function useSurveyManagement({ token, userRole, accessProfile: ctxProfile }) {
  const accessProfile = ctxProfile || buildAccessProfile(token || '', userRole || '');

  const [selectedSurvey, setSelectedSurvey] = useState('english_table_feedback_114_1');
  const [surveyStats, setSurveyStats] = useState({});
  const [surveyLoading, setSurveyLoading] = useState({});
  const [error, setError] = useState('');

  const canViewAnySurvey = hasPermission(accessProfile, P.CAN_VIEW_SURVEYS);
  const canExportSurveys =
    hasPermission(accessProfile, P.CAN_EXPORT_SURVEY_RESPONSES)
    || hasPermission(accessProfile, P.CAN_EXPORT_SURVEYS);
  const canViewSurvey = canViewAnySurvey || canExportSurveys;

  const availableSurveys = useMemo(
    () => ALL_SURVEYS.filter((s) => canAccessSurvey(accessProfile, s.id)),
    [accessProfile],
  );

  const loadSurveyStats = useCallback(async (surveyId) => {
    setSurveyLoading((prev) => ({ ...prev, [surveyId]: true }));
    const result = await safeAPICall(async () => fetchSurveyStatsApi(token, surveyId));
    if (result.success) {
      setSurveyStats((prev) => ({ ...prev, [surveyId]: result.data }));
      setError('');
    } else {
      setError(result.error || '載入問卷統計失敗');
    }
    setSurveyLoading((prev) => ({ ...prev, [surveyId]: false }));
  }, [token]);

  const handleExportSurvey = useCallback(async (surveyId) => {
    try {
      const blob = await exportSurveyData(token, surveyId);
      downloadBlob(blob, `問卷資料_${surveyId}.xlsx`);
    } catch (err) {
      showErrorMessage(`匯出失敗：${err.message}`);
    }
  }, [token]);

  useEffect(() => {
    if (canViewSurvey) {
      loadSurveyStats(selectedSurvey);
    }
  }, [selectedSurvey, canViewSurvey, loadSurveyStats]);

  useEffect(() => {
    if (!canViewSurvey || availableSurveys.length === 0) return;
    if (!availableSurveys.some((s) => s.id === selectedSurvey)) {
      setSelectedSurvey(availableSurveys[0].id);
    }
  }, [availableSurveys, selectedSurvey, canViewSurvey]);

  return {
    canViewSurvey,
    canExportSurveys,
    availableSurveys,
    selectedSurvey,
    setSelectedSurvey,
    surveyStats,
    surveyLoading,
    error,
    handleExportSurvey,
    loadSurveyStats,
  };
}
