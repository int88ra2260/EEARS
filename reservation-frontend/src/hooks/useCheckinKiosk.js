import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import useConfirm from '../components/ui/useConfirm';
import { P } from '../constants/permissions';
import {
  checkinEventReservation,
  fetchEventReservations,
} from '../services/eventAdminService';
import { hasPermission, canAccessEventType } from '../utils/accessControl';
import { matchCheckinQuery } from '../utils/checkinKioskMatch';
import { showErrorMessage, showSuccessMessage } from '../utils/errorHandler';

function isEventToday(dateStr) {
  if (!dateStr) return false;
  return dayjs().format('YYYY-MM-DD') === dateStr;
}

function applyPassportToast(data) {
  const grant = data?.passportGrant;
  if (grant?.status === 'granted') {
    showSuccessMessage(grant.message || '簽到成功，已累計護照點數');
  } else if (grant?.status === 'pending') {
    showSuccessMessage(grant.message || '簽到成功；護照點數已暫存待補發');
  } else if (grant?.status === 'blocked_limit') {
    showErrorMessage(grant.message || '簽到成功，但護照此類別已達上限（12 次／60 點）');
  } else if (grant?.requested && grant?.status === 'failed') {
    showErrorMessage(grant.message || '簽到成功，但護照入點失敗');
  } else {
    showSuccessMessage('簽到成功');
  }
}

/**
 * 現場簽到 Kiosk：載入名單、比對、簽到（沿用既有 checkin API）
 */
export function useCheckinKiosk({ token, accessProfile, eventId }) {
  const confirm = useConfirm();
  const inputRef = useRef(null);

  const canCheckinStudents = hasPermission(accessProfile, P.CAN_CHECKIN_STUDENTS);
  const canManageEvents = hasPermission(accessProfile, P.CAN_MANAGE_EVENTS);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | pick | confirm | feedback
  const [selected, setSelected] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [countsTowardPassport, setCountsTowardPassport] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [scanMode, setScanMode] = useState(true);
  const [quickCheckin, setQuickCheckin] = useState(false);

  const reservations = useMemo(
    () => payload?.reservations ?? [],
    [payload],
  );
  const eventDate = payload?.eventDate ?? '';
  const eventName = payload?.eventName ?? '';
  const eventType = payload?.eventType ?? '';
  const eventStartTime = payload?.eventStartTime ?? '';

  const canAccessCurrentEvent = canAccessEventType(accessProfile, eventType);
  const todayEvent = isEventToday(eventDate);
  const canCheckinNow = canCheckinStudents && canAccessCurrentEvent && (todayEvent || canManageEvents);

  const pendingCount = useMemo(
    () => reservations.filter((r) => r.checkinStatus === '未簽到').length,
    [reservations],
  );
  const checkedInCount = useMemo(
    () => reservations.filter((r) => r.checkinStatus === '已簽到').length,
    [reservations],
  );
  const pendingRows = useMemo(
    () => reservations
      .filter((r) => r.checkinStatus === '未簽到')
      .slice()
      .sort((a, b) => String(a.studentId || '').localeCompare(String(b.studentId || ''), 'en')),
    [reservations],
  );

  const focusInput = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus?.(), 50);
  }, []);

  const load = useCallback(async () => {
    if (!token || !eventId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchEventReservations(token, eventId);
      setPayload(data);
    } catch (e) {
      setError(e.message || '載入預約資料失敗');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && !error) focusInput();
  }, [loading, error, focusInput]);

  const resetToIdle = useCallback(() => {
    setQuery('');
    setPhase('idle');
    setSelected(null);
    setMatchResult(null);
    setCountsTowardPassport(false);
    setFeedback(null);
    focusInput();
  }, [focusInput]);

  const goConfirm = useCallback((reservation) => {
    setSelected(reservation);
    setCountsTowardPassport(false);
    setPhase('confirm');
  }, []);

  const performCheckin = useCallback(async (reservation, { passport = false } = {}) => {
    if (!reservation || !eventId) return false;
    if (!canCheckinStudents || !canAccessCurrentEvent) {
      showErrorMessage('您沒有簽到權限');
      return false;
    }
    if (!todayEvent && !canManageEvents) {
      showErrorMessage('只能對當天的活動進行簽到');
      return false;
    }
    if (!todayEvent && canManageEvents) {
      const ok = await confirm({
        title: '確認補簽到？',
        description: `此活動日期為 ${eventDate}，確定要進行補簽到嗎？`,
        confirmText: '確認補簽到',
        cancelText: '取消',
        variant: 'warning',
      });
      if (!ok) return false;
    }

    setCheckinBusy(true);
    try {
      const data = await checkinEventReservation(token, eventId, reservation.id, {
        countsTowardPassport: !!passport,
      });
      applyPassportToast(data);
      setPayload((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          reservations: (prev.reservations || []).map((r) =>
            r.id === reservation.id
              ? {
                ...r,
                checkinStatus: '已簽到',
                checkinTime: data.checkinTime,
                countsTowardPassport: !!data.countsTowardPassport,
                passportPointsStatus: data.passportPointsStatus || null,
              }
              : r),
        };
      });
      setPhase('feedback');
      setFeedback({
        tone: 'success',
        title: '簽到成功',
        detail: `${reservation.studentId} ${reservation.studentName || reservation.name || ''}`,
      });
      setSelected(null);
      setQuery('');
      setCountsTowardPassport(false);
      window.setTimeout(() => {
        setFeedback(null);
        setPhase('idle');
        focusInput();
      }, 1600);
      return true;
    } catch (e) {
      showErrorMessage(e.message || '簽到失敗');
      return false;
    } finally {
      setCheckinBusy(false);
    }
  }, [
    eventId,
    canCheckinStudents,
    canAccessCurrentEvent,
    todayEvent,
    canManageEvents,
    confirm,
    eventDate,
    token,
    focusInput,
  ]);

  const runSearch = useCallback(async () => {
    setFeedback(null);
    const result = matchCheckinQuery(reservations, query);
    setMatchResult(result);

    if (result.kind === 'empty_query') {
      setPhase('idle');
      return;
    }
    if (result.kind === 'none') {
      setPhase('feedback');
      setFeedback({ tone: 'warn', title: '找不到預約', detail: `沒有符合「${query.trim()}」的名單。` });
      if (scanMode) focusInput();
      return;
    }
    if (result.kind === 'exact_pending') {
      const row = result.pending[0];
      if (scanMode && quickCheckin && canCheckinNow) {
        await performCheckin(row, { passport: false });
        return;
      }
      goConfirm(row);
      return;
    }
    if (result.kind === 'exact_done') {
      const row = result.done[0];
      setPhase('feedback');
      setFeedback({
        tone: 'info',
        title: '已簽到',
        detail: `${row.studentId} ${row.studentName || row.name || ''} 已完成簽到。`,
      });
      if (scanMode) focusInput();
      return;
    }
    if (result.kind === 'exact_violation') {
      const row = result.violations[0];
      setPhase('feedback');
      setFeedback({
        tone: 'danger',
        title: '已登記違規',
        detail: `${row.studentId} ${row.studentName || row.name || ''} 已登記違規，無法在此簽到。`,
      });
      if (scanMode) focusInput();
      return;
    }
    setPhase('pick');
  }, [
    goConfirm,
    query,
    reservations,
    scanMode,
    quickCheckin,
    canCheckinNow,
    performCheckin,
    focusInput,
  ]);

  const handleCheckin = useCallback(async () => {
    if (!selected) return;
    await performCheckin(selected, { passport: countsTowardPassport });
  }, [selected, performCheckin, countsTowardPassport]);

  return {
    inputRef,
    loading,
    error,
    reload: load,
    query,
    setQuery,
    phase,
    matchResult,
    selected,
    countsTowardPassport,
    setCountsTowardPassport,
    checkinBusy,
    feedback,
    eventName,
    eventDate,
    eventType,
    eventStartTime,
    pendingCount,
    checkedInCount,
    pendingRows,
    scanMode,
    setScanMode,
    quickCheckin,
    setQuickCheckin,
    canCheckinStudents,
    canAccessCurrentEvent,
    canCheckinNow,
    todayEvent,
    canManageEvents,
    runSearch,
    goConfirm,
    handleCheckin,
    resetToIdle,
    focusInput,
  };
}

export default useCheckinKiosk;
