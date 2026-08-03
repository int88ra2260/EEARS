/**
 * 管理後台產品總覽：KPI、健康檢查、最近活動與違規提醒
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getReliabilityFault, makeDevRequestId } from '../utils/reliabilityFaults';
import { buildAccessProfile, hasPermission } from '../utils/accessControl';
import { P } from '../constants/permissions';
import {
  fetchBlacklistBySemester,
  fetchDashboardEvents,
  fetchDashboardReservations,
  fetchDraftAnnouncementsTotal,
  fetchEnglishTestPendingCount,
  fetchSystemHealth,
} from '../services/adminDashboardApi';

export const KPI_STATUS = {
  LOADING: 'loading',
  SUCCESS: 'success',
  EMPTY: 'empty',
  ERROR: 'error',
};

function getSemesterInfo(date) {
  const eventDate = new Date(date);
  const year = eventDate.getFullYear();
  const month = eventDate.getMonth() + 1;
  if (year === 2025 && month >= 2 && month <= 7) return '113-2';
  if ((year === 2025 && month >= 8) || (year === 2026 && month <= 1)) return '114-1';
  if (year === 2026 && month >= 2 && month <= 7) return '114-2';
  return '113-2';
}

function withinNextDays(dateStr, days) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return d >= start && d <= end;
}

function formatLocalDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!d || Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function emptyKpiState(status = KPI_STATUS.LOADING) {
  return {
    status,
    value: null,
    lastUpdatedAt: null,
    requestId: null,
    errorBrief: null,
  };
}

function kpiErrorState(e) {
  const requestId = e?.requestId || null;
  const isTimeout = e?.name === 'AbortError' || e?.code === 'ECONNABORTED' || e?.errorBrief === '取得超時';
  return {
    status: KPI_STATUS.ERROR,
    value: null,
    lastUpdatedAt: null,
    requestId,
    errorBrief: isTimeout ? '取得超時' : (e?.errorBrief || 'API 請求失敗'),
  };
}

export function useAdminDashboardProduct({ token, userRole, toast }) {
  const accessProfile = useMemo(
    () => buildAccessProfile(token || '', userRole || ''),
    [token, userRole],
  );

  const [recentEvents, setRecentEvents] = useState([]);
  const [violations, setViolations] = useState([]);
  const [healthState, setHealthState] = useState({
    status: KPI_STATUS.LOADING,
    health: null,
    error: null,
    requestId: null,
  });
  const [kpiTodayReservations, setKpiTodayReservations] = useState(emptyKpiState());
  const [kpiRecentEvents, setKpiRecentEvents] = useState(emptyKpiState());
  const [kpiEnglishPending, setKpiEnglishPending] = useState(emptyKpiState());
  const [kpiAnnouncementDraft, setKpiAnnouncementDraft] = useState(emptyKpiState());
  const [eventsSectionStatus, setEventsSectionStatus] = useState(KPI_STATUS.LOADING);
  const [violationsSectionStatus, setViolationsSectionStatus] = useState(KPI_STATUS.LOADING);

  const fetchTodayReservationsKpi = useCallback(async () => {
    if (!token) {
      setKpiTodayReservations({ ...emptyKpiState(KPI_STATUS.ERROR), errorBrief: '尚未登入' });
      return;
    }
    setKpiTodayReservations(emptyKpiState());
    try {
      const data = await fetchDashboardReservations(token, userRole);
      const today = new Date().toISOString().slice(0, 10);
      const count = data.filter((r) => String(r.createdAt || r.timestamp || '').startsWith(today)).length;
      setKpiTodayReservations({
        status: count === 0 ? KPI_STATUS.EMPTY : KPI_STATUS.SUCCESS,
        value: count,
        lastUpdatedAt: formatLocalDateTime(new Date()),
        requestId: null,
        errorBrief: null,
      });
    } catch (e) {
      setKpiTodayReservations(kpiErrorState(e));
    }
  }, [token, userRole]);

  const fetchRecentEventsKpi = useCallback(async () => {
    if (!token) {
      setKpiRecentEvents({ ...emptyKpiState(KPI_STATUS.ERROR), errorBrief: '尚未登入' });
      setEventsSectionStatus(KPI_STATUS.ERROR);
      return;
    }
    setKpiRecentEvents(emptyKpiState());
    setEventsSectionStatus(KPI_STATUS.LOADING);
    try {
      const list = await fetchDashboardEvents(token, userRole);
      const filtered = list.filter((evt) => withinNextDays(evt.date, 7));
      setRecentEvents(filtered.slice(0, 5));
      const count = filtered.length;
      setKpiRecentEvents({
        status: count === 0 ? KPI_STATUS.EMPTY : KPI_STATUS.SUCCESS,
        value: count,
        lastUpdatedAt: formatLocalDateTime(new Date()),
        requestId: null,
        errorBrief: null,
      });
      setEventsSectionStatus(count === 0 ? KPI_STATUS.EMPTY : KPI_STATUS.SUCCESS);
    } catch (e) {
      setRecentEvents([]);
      setKpiRecentEvents(kpiErrorState(e));
      setEventsSectionStatus(KPI_STATUS.ERROR);
    }
  }, [token, userRole]);

  const fetchEnglishPendingKpi = useCallback(async () => {
    if (!token) {
      setKpiEnglishPending({ ...emptyKpiState(KPI_STATUS.ERROR), errorBrief: '尚未登入' });
      return;
    }
    if (!hasPermission(accessProfile, P.CAN_VIEW_ENGLISH_TEST_METRICS)) {
      setKpiEnglishPending({ ...emptyKpiState(KPI_STATUS.EMPTY), value: 0 });
      return;
    }
    setKpiEnglishPending(emptyKpiState());
    try {
      const total = await fetchEnglishTestPendingCount(token, userRole);
      setKpiEnglishPending({
        status: total === 0 ? KPI_STATUS.EMPTY : KPI_STATUS.SUCCESS,
        value: total,
        lastUpdatedAt: formatLocalDateTime(new Date()),
        requestId: null,
        errorBrief: null,
      });
    } catch (e) {
      setKpiEnglishPending(kpiErrorState(e));
    }
  }, [token, userRole, accessProfile]);

  const fetchAnnouncementDraftKpi = useCallback(async () => {
    if (!token) {
      setKpiAnnouncementDraft({ ...emptyKpiState(KPI_STATUS.ERROR), errorBrief: '尚未登入' });
      return;
    }
    if (!hasPermission(accessProfile, P.CAN_MANAGE_ANNOUNCEMENTS)) {
      setKpiAnnouncementDraft({ ...emptyKpiState(KPI_STATUS.EMPTY), value: 0 });
      return;
    }
    setKpiAnnouncementDraft(emptyKpiState());
    try {
      const total = await fetchDraftAnnouncementsTotal(token);
      setKpiAnnouncementDraft({
        status: total === 0 ? KPI_STATUS.EMPTY : KPI_STATUS.SUCCESS,
        value: total,
        lastUpdatedAt: formatLocalDateTime(new Date()),
        requestId: null,
        errorBrief: null,
      });
    } catch (e) {
      setKpiAnnouncementDraft(kpiErrorState(e));
    }
  }, [token, accessProfile]);

  const fetchViolationsSection = useCallback(async () => {
    if (!token) {
      setViolations([]);
      setViolationsSectionStatus(KPI_STATUS.ERROR);
      return;
    }
    setViolationsSectionStatus(KPI_STATUS.LOADING);
    try {
      const semester = getSemesterInfo(new Date().toISOString().slice(0, 10));
      const list = await fetchBlacklistBySemester(token, userRole, semester);
      setViolations(list);
      setViolationsSectionStatus(list.length === 0 ? KPI_STATUS.EMPTY : KPI_STATUS.SUCCESS);
    } catch (_) {
      setViolations([]);
      setViolationsSectionStatus(KPI_STATUS.ERROR);
    }
  }, [token, userRole]);

  useEffect(() => {
    fetchTodayReservationsKpi();
    fetchRecentEventsKpi();
    fetchEnglishPendingKpi();
    fetchAnnouncementDraftKpi();
    fetchViolationsSection();
  }, [
    fetchTodayReservationsKpi,
    fetchRecentEventsKpi,
    fetchEnglishPendingKpi,
    fetchAnnouncementDraftKpi,
    fetchViolationsSection,
  ]);

  const loadHealth = useCallback(async () => {
    setHealthState({ status: KPI_STATUS.LOADING, health: null, error: null, requestId: null });
    try {
      const fault = getReliabilityFault();
      const devRid = makeDevRequestId('DEV');
      if (fault === 'healthFail') {
        const err = new Error('健康檢查失敗（dev fault）');
        err.requestId = devRid;
        throw err;
      }
      if (fault === 'healthSlowDb' || fault === 'healthSlowEmail') {
        const now = new Date();
        const isDbSlow = fault === 'healthSlowDb';
        const health = {
          status: 'ok',
          timestamp: now.toISOString(),
          services: {
            db: { status: 'ok', latencyMs: isDbSlow ? 650 : 35 },
            email: { status: 'ok', latencyMs: isDbSlow ? 260 : 650 },
          },
        };
        setHealthState({ status: KPI_STATUS.SUCCESS, health, error: null, requestId: devRid });
        return;
      }

      const { health, requestId } = await fetchSystemHealth();
      setHealthState({ status: KPI_STATUS.SUCCESS, health, error: null, requestId });
    } catch (e) {
      setHealthState({
        status: KPI_STATUS.ERROR,
        health: null,
        error: e?.message || '健康檢查失敗',
        requestId: e?.requestId || null,
      });
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const kpiAllEmpty =
    kpiTodayReservations.status === KPI_STATUS.EMPTY &&
    kpiRecentEvents.status === KPI_STATUS.EMPTY &&
    kpiEnglishPending.status === KPI_STATUS.EMPTY &&
    kpiAnnouncementDraft.status === KPI_STATUS.EMPTY;

  const recentViolations = useMemo(() => violations.slice(0, 5), [violations]);

  const handleCardRefresh = useCallback(
    async (what) => {
      try {
        if (what === 'reservations') await fetchTodayReservationsKpi();
        if (what === 'events') await fetchRecentEventsKpi();
        if (what === 'english') await fetchEnglishPendingKpi();
        if (what === 'announcements') await fetchAnnouncementDraftKpi();
      } catch (_) {
        toast?.warning?.('總覽資料載入失敗，請稍後重試');
      }
    },
    [fetchAnnouncementDraftKpi, fetchEnglishPendingKpi, fetchRecentEventsKpi, fetchTodayReservationsKpi, toast],
  );

  return {
    recentEvents,
    violations,
    healthState,
    loadHealth,
    kpiTodayReservations,
    kpiRecentEvents,
    kpiEnglishPending,
    kpiAnnouncementDraft,
    eventsSectionStatus,
    violationsSectionStatus,
    kpiAllEmpty,
    recentViolations,
    handleCardRefresh,
    fetchViolationsSection,
  };
}
