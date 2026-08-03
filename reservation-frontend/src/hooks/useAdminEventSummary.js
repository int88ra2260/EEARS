/**
 * 活動後台總覽報表：學期/類型/日期（單日或區間）篩選與載入。
 * 供 AdminHome 使用，API 走 eventService.fetchEventSummary。
 */
import { useState, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import { fetchEventSummary } from '../services/eventService';
import { getSemesterByDate } from '../utils/semesterUtils';
import { safeAPICall } from '../utils/errorHandler';
import { buildEventSummaryDateParams, resolveDateFilterPreset, filterSummaryByDateParams } from '../utils/adminEventSummaryDateFilter';

function getDefaultSemesterFilter() {
  const now = new Date();
  return getSemesterByDate(now.toISOString().split('T')[0]) || 'other';
}

function todayYmd() {
  return dayjs().format('YYYY-MM-DD');
}

/**
 * @param {Object} options
 * @param {string} options.token
 * @param {boolean} options.canViewEventsAdmin
 */
export function useAdminEventSummary({ token, canViewEventsAdmin }) {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(getDefaultSemesterFilter);
  const [selectedEventType, setSelectedEventType] = useState('all');
  /** @type {'single' | 'range'} */
  const [dateFilterMode, setDateFilterMode] = useState('single');
  const [filterDate, setFilterDate] = useState(todayYmd);
  const [filterDateFrom, setFilterDateFrom] = useState(todayYmd);
  const [filterDateTo, setFilterDateTo] = useState(todayYmd);

  const buildDateParams = useCallback((mode = dateFilterMode, single = filterDate, from = filterDateFrom, to = filterDateTo) => (
    buildEventSummaryDateParams({
      mode,
      date: single,
      dateFrom: from,
      dateTo: to,
    })
  ), [dateFilterMode, filterDate, filterDateFrom, filterDateTo]);

  const fetchSummary = useCallback(async (
    semester = selectedSemester,
    eventType = selectedEventType,
    dateParams = buildDateParams()
  ) => {
    if (!canViewEventsAdmin) {
      setSummary([]);
      setError('您沒有活動後台檢視權限');
      setLoading(false);
      return;
    }
    setLoading(true);

    const result = await safeAPICall(async () => {
      return fetchEventSummary(token, { semester, eventType, ...dateParams });
    });

    if (result.success) {
      const rows = filterSummaryByDateParams(result.data || [], dateParams);
      setSummary(rows);
      setError('');
    } else {
      setError(result.error || '載入報表失敗');
    }

    setLoading(false);
  }, [token, canViewEventsAdmin, selectedSemester, selectedEventType, buildDateParams]);

  const handleSemesterChange = useCallback((semester) => {
    setSelectedSemester(semester);
    fetchSummary(semester, selectedEventType, buildDateParams());
  }, [fetchSummary, selectedEventType, buildDateParams]);

  const handleEventTypeChange = useCallback((eventType) => {
    setSelectedEventType(eventType);
    fetchSummary(selectedSemester, eventType, buildDateParams());
  }, [fetchSummary, selectedSemester, buildDateParams]);

  const handleDateFilterModeChange = useCallback((mode) => {
    const nextMode = mode === 'range' ? 'range' : 'single';
    setDateFilterMode(nextMode);
    if (nextMode === 'range') {
      const seed = filterDate || todayYmd();
      const from = filterDateFrom || seed;
      const to = filterDateTo || seed;
      setFilterDateFrom(from);
      setFilterDateTo(to);
      fetchSummary(selectedSemester, selectedEventType, buildEventSummaryDateParams({
        mode: 'range',
        dateFrom: from,
        dateTo: to,
      }));
      return;
    }
    const single = filterDate || filterDateFrom || todayYmd();
    setFilterDate(single);
    fetchSummary(selectedSemester, selectedEventType, { date: single || undefined });
  }, [
    fetchSummary,
    selectedSemester,
    selectedEventType,
    filterDate,
    filterDateFrom,
    filterDateTo,
  ]);

  const handleFilterDateChange = useCallback((value) => {
    setFilterDate(value);
    fetchSummary(selectedSemester, selectedEventType, { date: value || undefined });
  }, [fetchSummary, selectedSemester, selectedEventType]);

  const handleFilterDateFromChange = useCallback((value) => {
    setFilterDateFrom(value);
    let nextTo = filterDateTo;
    if (value && filterDateTo && value > filterDateTo) {
      nextTo = value;
      setFilterDateTo(value);
    }
    fetchSummary(selectedSemester, selectedEventType, {
      dateFrom: value || undefined,
      dateTo: nextTo || undefined,
    });
  }, [fetchSummary, selectedSemester, selectedEventType, filterDateTo]);

  const handleFilterDateToChange = useCallback((value) => {
    setFilterDateTo(value);
    let nextFrom = filterDateFrom;
    if (value && filterDateFrom && value < filterDateFrom) {
      nextFrom = value;
      setFilterDateFrom(value);
    }
    fetchSummary(selectedSemester, selectedEventType, {
      dateFrom: nextFrom || undefined,
      dateTo: value || undefined,
    });
  }, [fetchSummary, selectedSemester, selectedEventType, filterDateFrom]);

  const applyDatePreset = useCallback((preset) => {
    const resolved = resolveDateFilterPreset(preset, todayYmd());
    if (!resolved) return;

    if (resolved.mode) {
      setDateFilterMode(resolved.mode);
    }
    setFilterDate(resolved.filterDate);
    setFilterDateFrom(resolved.filterDateFrom);
    setFilterDateTo(resolved.filterDateTo);
    fetchSummary(selectedSemester, selectedEventType, resolved.dateParams);
  }, [fetchSummary, selectedSemester, selectedEventType]);

  const clearFilterDate = useCallback(() => {
    applyDatePreset('clear');
  }, [applyDatePreset]);

  useEffect(() => {
    fetchSummary();
    // 僅掛載時以預設學期/篩選載入一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    summary,
    loading,
    error,
    selectedSemester,
    selectedEventType,
    dateFilterMode,
    filterDate,
    filterDateFrom,
    filterDateTo,
    fetchSummary,
    handleSemesterChange,
    handleEventTypeChange,
    handleDateFilterModeChange,
    handleFilterDateChange,
    handleFilterDateFromChange,
    handleFilterDateToChange,
    applyDatePreset,
    clearFilterDate,
    setSelectedSemester,
    setSelectedEventType,
    setFilterDate,
  };
}
