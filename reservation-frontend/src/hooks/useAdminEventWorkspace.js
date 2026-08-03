/**
 * 活動明細頁：組合 useEventMeta / useEventReservations / useEventViolations（lazy by tab）
 */
import { useMemo, useCallback, useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { showErrorMessage, showSuccessMessage } from '../utils/errorHandler';
import useConfirm from '../components/ui/useConfirm';
import { useEventMeta } from './useEventMeta';
import { useEventReservations } from './useEventReservations';
import { useEventViolations } from './useEventViolations';
import { debugEventDetail } from '../utils/eventDetailDebug';
import { buildAccessProfile, canAccessEventType, hasPermission } from '../utils/accessControl';
import { P } from '../constants/permissions';
import { RESERVATION_CUTOFF_HOURS } from '../constants/reservationRules';
import {
  batchMarkEventNoShow,
  checkinEventReservation,
  createEventViolation,
  deleteAdminReservation,
  fetchEventWaitlist,
  importEventCardExcel,
  runEventAutoCheck,
} from '../services/eventAdminService';
import { downloadBlob, exportEventReservations } from '../services/eventService';
import { exportEventEtGrouping, downloadEtBlob } from '../services/etGroupingApi';

export default function useAdminEventWorkspace({ token, userRole, accessProfile: ctxProfile, eventId, activeTab = 'reservations' }) {
  const { confirm } = useConfirm();
  const accessProfile = ctxProfile || buildAccessProfile(token || '', userRole || '');

  const [checkinLoading, setCheckinLoading] = useState({});
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(null);

  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationData, setViolationData] = useState({
    studentId: '',
    violationType: '擾亂秩序',
    description: '',
  });

  const [batchMarkNoShowLoading, setBatchMarkNoShowLoading] = useState(false);
  const [autoCheckLoading, setAutoCheckLoading] = useState(false);

  const [reservationSearchTerm, setReservationSearchTerm] = useState('');
  const [reservationSortField, setReservationSortField] = useState('studentId');
  const [reservationSortOrder, setReservationSortOrder] = useState('asc');

  const meta = useEventMeta({ token, eventId });

  const canViewReservations = hasPermission(accessProfile, P.CAN_VIEW_RESERVATIONS);
  const canExportReservations = hasPermission(accessProfile, P.CAN_EXPORT_RESERVATIONS);
  const canCheckinStudents = hasPermission(accessProfile, P.CAN_CHECKIN_STUDENTS);
  const canManageViolations = hasPermission(accessProfile, P.CAN_MANAGE_VIOLATIONS);
  const canViewBlacklist = hasPermission(accessProfile, P.CAN_VIEW_BLACKLIST);
  const canManageBlacklist = hasPermission(accessProfile, P.CAN_MANAGE_BLACKLIST);
  const canManageEvents = hasPermission(accessProfile, P.CAN_MANAGE_EVENTS);
  const canViewEtGrouping = hasPermission(accessProfile, P.CAN_VIEW_ET_GROUPING);
  const canManageEtGrouping = hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING);
  const canExportEtGrouping = hasPermission(accessProfile, P.CAN_EXPORT_ET_GROUPING);
  const canMarkEtSessionTasks = hasPermission(accessProfile, P.CAN_MARK_ET_SESSION_TASKS);

  const needReservations = canViewReservations && ['reservations', 'checkin', 'violations'].includes(activeTab);
  const needViolations = (canManageViolations || canViewBlacklist) && activeTab === 'violations';

  const resv = useEventReservations({
    token,
    eventId: meta.eventId,
    enabled: Boolean(meta.ready && needReservations),
  });

  const vio = useEventViolations({
    token,
    eventId: meta.eventId,
    enabled: Boolean(meta.ready && needViolations),
  });

  useEffect(() => {
    debugEventDetail('tab:active', {
      activeTab,
      meta: { loading: meta.loading, ready: meta.ready, error: meta.error || null },
      reservations: { loading: resv.loading, loaded: resv.loaded, error: resv.error || null },
      violations: { loading: vio.loading, loaded: vio.loaded, error: vio.error || null },
    });
  }, [activeTab, meta.loading, meta.ready, meta.error, resv.loading, resv.loaded, resv.error, vio.loading, vio.loaded, vio.error]);

  const hasAdminRights = Boolean(accessProfile.hasAdminRights);
  const isAdmin = Boolean(accessProfile.isAdmin);
  const canImportExcel = canCheckinStudents && canManageEvents;

  const currentEventId = meta.eventId;
  const [waitlistItems, setWaitlistItems] = useState([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');

  const currentEventName = resv.loaded && resv.eventName ? resv.eventName : meta.name;
  const currentEventDate = resv.loaded && resv.eventDate ? resv.eventDate : meta.date;
  const currentEventStartTime = resv.loaded && resv.eventStartTime ? resv.eventStartTime : meta.startTime;
  const currentEventType = resv.loaded && resv.eventType ? resv.eventType : meta.eventType;
  const canAccessCurrentEvent = canAccessEventType(accessProfile, currentEventType);
  const currentEventAutoCheckCompleted = resv.loaded ? resv.autoCheckCompleted : meta.autoCheckCompleted;

  const fetchWaitlist = useCallback(async () => {
    if (!currentEventId || !canViewReservations || !canAccessCurrentEvent || !token) return;
    setWaitlistLoading(true);
    setWaitlistError('');
    try {
      const items = await fetchEventWaitlist(token, currentEventId);
      setWaitlistItems(items);
    } catch (e) {
      setWaitlistError(e.message || '載入候補名單失敗');
      setWaitlistItems([]);
    } finally {
      setWaitlistLoading(false);
    }
  }, [currentEventId, token, canViewReservations, canAccessCurrentEvent]);

  const reservationData = resv.reservations;

  const eventMeta = useMemo(
    () => ({
      endTime: meta.endTime || '',
      location: meta.location || '',
      maxCapacity: meta.maxCapacity,
    }),
    [meta.endTime, meta.location, meta.maxCapacity]
  );

  const isEventToday = useCallback((dateStr) => {
    if (!dateStr) return false;
    return dayjs().format('YYYY-MM-DD') === dateStr;
  }, []);

  useEffect(() => {
    if (activeTab !== 'reservations') return;
    if (!meta.ready || !canViewReservations || !canAccessCurrentEvent || !currentEventId) return;
    fetchWaitlist();
  }, [activeTab, meta.ready, canViewReservations, canAccessCurrentEvent, currentEventId, fetchWaitlist, resv.loaded]);

  const handleCheckin = useCallback(async (reservationId) => {
    if (!currentEventId) return;
    if (!canCheckinStudents || !canAccessCurrentEvent) {
      showErrorMessage('您沒有簽到權限');
      return;
    }
    if (!isEventToday(currentEventDate) && !canManageEvents) {
      showErrorMessage('只能對當天的活動進行簽到');
      return;
    }
    if (!isEventToday(currentEventDate) && canManageEvents) {
      const ok = await confirm({
        title: '確認補簽到？',
        description: `此活動日期為 ${currentEventDate}，確定要進行補簽到嗎？`,
        confirmText: '確認補簽到',
        cancelText: '取消',
        variant: 'warning',
      });
      if (!ok) return;
    }

    setCheckinLoading((prev) => ({ ...prev, [reservationId]: true }));
    try {
      const data = await checkinEventReservation(token, currentEventId, reservationId);
      showSuccessMessage('簽到成功');
      resv.setPayload((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          reservations: (prev.reservations || []).map((r) =>
            r.id === reservationId ? { ...r, checkinStatus: '已簽到', checkinTime: data.checkinTime } : r
          ),
        };
      });
    } catch (error) {
      console.error('簽到錯誤:', error);
      showErrorMessage(error.message || '簽到失敗');
    } finally {
      setCheckinLoading((prev) => ({ ...prev, [reservationId]: false }));
    }
  }, [
    canAccessCurrentEvent,
    canCheckinStudents,
    canManageEvents,
    confirm,
    currentEventDate,
    currentEventId,
    isEventToday,
    resv,
    token,
  ]);

  const canCancelReservation = () => {
    if (!currentEventDate || !currentEventStartTime) return false;
    const now = dayjs();
    const eventStart = dayjs(`${currentEventDate}T${currentEventStartTime}`);
    if (!eventStart.isValid()) return false;
    const twoHoursBefore = eventStart.subtract(RESERVATION_CUTOFF_HOURS, 'hour');
    return now.isBefore(twoHoursBefore);
  };

  const handleDeleteReservation = useCallback(async (reservationId, studentId, studentName, verificationCode) => {
    if (!canManageEvents || !canAccessCurrentEvent) {
      showErrorMessage('您沒有刪除預約權限');
      return false;
    }
    const code = String(verificationCode || '').trim();
    if (!code) {
      showErrorMessage('請輸入該筆預約的取消驗證碼');
      return false;
    }

    try {
      await deleteAdminReservation(token, reservationId, { verificationCode: code });
      showSuccessMessage('已成功刪除預約紀錄');
      await resv.refresh();
      await meta.reload();
      await fetchWaitlist();
      return true;
    } catch (error) {
      console.error('刪除預約錯誤:', error);
      showErrorMessage(error.message || '刪除預約失敗');
      return false;
    }
  }, [canAccessCurrentEvent, canManageEvents, fetchWaitlist, meta, resv, token]);

  const handleImportFileChange = useCallback((event) => {
    const file = event?.target?.files?.[0] || null;
    setImportFile(file);
    setImportError('');
  }, []);

  const handleImportExcel = useCallback(async (event) => {
    if (!canImportExcel || !canAccessCurrentEvent) {
      setImportError('您沒有匯入簽到權限');
      return;
    }
    event.preventDefault();
    if (!currentEventId) {
      setImportError('目前沒有選定的活動');
      return;
    }
    if (!importFile) {
      setImportError('請選擇要匯入的 Excel 檔案');
      return;
    }
    setImportLoading(true);
    setImportError('');
    setImportResult(null);
    try {
      const data = await importEventCardExcel(token, currentEventId, importFile);
      setImportResult(data);
      showSuccessMessage(data.message || '匯入完成');
      await resv.refresh();
      await meta.reload();
    } catch (error) {
      const message = error.message || '匯入失敗，請稍後再試';
      setImportError(message);
      showErrorMessage(message);
    } finally {
      setImportLoading(false);
    }
  }, [canAccessCurrentEvent, canImportExcel, currentEventId, importFile, meta, resv, token]);

  const openViolationModal = useCallback((studentId = '') => {
    setViolationData({
      studentId: studentId || '',
      violationType: '擾亂秩序',
      description: '',
    });
    setShowViolationModal(true);
  }, []);

  const handleRecordEventViolation = useCallback(async () => {
    if (!canManageViolations || !canAccessCurrentEvent) {
      showErrorMessage('您沒有違規處置權限');
      return;
    }
    if (!currentEventId) {
      showErrorMessage('目前沒有選定的活動');
      return;
    }
    if (!violationData.studentId.trim()) {
      showErrorMessage('請輸入學號');
      return;
    }
    try {
      const data = await createEventViolation(token, currentEventId, violationData);
      showSuccessMessage('違規記錄已建立！');
      setShowViolationModal(false);
      setViolationData({ studentId: '', violationType: '擾亂秩序', description: '' });
      await Promise.all([vio.refresh(), resv.refresh()]);
      await meta.reload();
      if (data.reservation) {
        resv.setPayload((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            reservations: (prev.reservations || []).map((r) =>
              r.id === data.reservation.id ? { ...r, checkinStatus: data.reservation.checkinStatus } : r
            ),
          };
        });
      }
    } catch (error) {
      console.error('登記違規錯誤:', error);
      showErrorMessage(error.message || '登記違規失敗');
    }
  }, [canAccessCurrentEvent, canManageViolations, currentEventId, meta, resv, token, violationData, vio]);

  const handleBatchMarkNoShow = useCallback(async () => {
    if (!currentEventId) return;
    if (!canManageViolations || !canAccessCurrentEvent) {
      showErrorMessage('您沒有違規處置權限');
      return;
    }
    const noShowCount = reservationData.filter((r) => r.checkinStatus === '未簽到').length;
    if (noShowCount === 0) {
      showErrorMessage('目前沒有未簽到的學生');
      return;
    }
    const ok = await confirm({
      title: '確認批次登記預約未到？',
      description: `確定要將 ${noShowCount} 位未簽到的學生登記為「預約未到」嗎？`,
      confirmText: '確認登記',
      cancelText: '取消',
      variant: 'warning',
    });
    if (!ok) return;
    setBatchMarkNoShowLoading(true);
    try {
      const data = await batchMarkEventNoShow(token, currentEventId);
      showSuccessMessage(data.message || `成功登記 ${data.successCount} 位學生為預約未到`);
      await Promise.all([vio.refresh(), resv.refresh()]);
      await meta.reload();
    } catch (error) {
      console.error('批次登記未簽到學生錯誤:', error);
      showErrorMessage(error.message || '批次登記失敗');
    } finally {
      setBatchMarkNoShowLoading(false);
    }
  }, [
    canAccessCurrentEvent,
    canManageViolations,
    confirm,
    currentEventId,
    meta,
    reservationData,
    resv,
    token,
    vio,
  ]);

  const handleAutoCheck = useCallback(async () => {
    if (!currentEventId) return;
    if (!canManageBlacklist || !canAccessCurrentEvent) {
      showErrorMessage('您沒有執行活動結束檢查權限');
      return;
    }
    const ok = await confirm({
      title: '確認執行活動結束檢查？',
      description: '活動結束檢查會將活動期間違規與未簽到學生同步到黑名單。',
      confirmText: '執行',
      cancelText: '取消',
      variant: 'warning',
    });
    if (!ok) return;
    setAutoCheckLoading(true);
    try {
      const data = await runEventAutoCheck(token, currentEventId);
      const stats = data.results || {};
      const summaryMessage =
        data.message ||
        `處理完成：總筆數 ${stats.processedCount || 0}，違規記錄 ${stats.violationRecords || 0}，預約未到 ${stats.noShowRecords || 0}`;
      showSuccessMessage(summaryMessage);
      await Promise.all([vio.refresh(), resv.refresh()]);
      await meta.reload();
    } catch (error) {
      console.error('活動結束檢查錯誤:', error);
      if (error.data?.alreadyCompleted) {
        resv.setPayload((prev) => (prev ? { ...prev, autoCheckCompleted: true } : prev));
        await meta.reload();
      }
      showErrorMessage(error.message || '活動結束檢查失敗');
    } finally {
      setAutoCheckLoading(false);
    }
  }, [canAccessCurrentEvent, canManageBlacklist, confirm, currentEventId, meta, resv, token, vio]);

  const handleExport = useCallback(async () => {
    if (!currentEventId) return;
    if (!canExportReservations || !canAccessCurrentEvent) {
      showErrorMessage('您沒有匯出權限');
      return;
    }
    try {
      const blob = await exportEventReservations(token, currentEventId);
      downloadBlob(blob, `活動預約清單_${currentEventId}.xlsx`);
    } catch (error) {
      showErrorMessage('匯出失敗：' + error.message);
    }
  }, [canAccessCurrentEvent, canExportReservations, currentEventId, token]);

  const handleExportEtGrouping = useCallback(async () => {
    if (!currentEventId) return;
    if (!canExportEtGrouping || !canAccessCurrentEvent) {
      showErrorMessage('您沒有 ET 分組匯出權限');
      return;
    }
    try {
      const { blob, filename } = await exportEventEtGrouping(token, currentEventId);
      downloadEtBlob(blob, filename);
      showSuccessMessage('ET 分組報表已下載');
    } catch (error) {
      showErrorMessage('匯出失敗：' + error.message);
    }
  }, [canAccessCurrentEvent, canExportEtGrouping, currentEventId, token]);

  const handleReservationSort = useCallback((field) => {
    if (reservationSortField === field) {
      setReservationSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setReservationSortField(field);
      setReservationSortOrder('asc');
    }
  }, [reservationSortField]);

  const sortedReservationData = useMemo(() => {
    return [...reservationData].sort((a, b) => {
      let aVal;
      let bVal;
      if (reservationSortField === 'studentId') {
        aVal = a.studentId;
        bVal = b.studentId;
      } else if (reservationSortField === 'name') {
        aVal = a.studentName || a.name;
        bVal = b.studentName || b.name;
      } else {
        aVal = a[reservationSortField];
        bVal = b[reservationSortField];
      }
      if (reservationSortField === 'checkinStatus') {
        const statusOrder = { 已簽到: 1, 未簽到: 2, 已登記違規: 3 };
        aVal = statusOrder[aVal] || 4;
        bVal = statusOrder[bVal] || 4;
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (reservationSortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });
  }, [reservationData, reservationSortField, reservationSortOrder]);

  const filteredReservationData = useMemo(() => {
    return sortedReservationData.filter((reservation) => {
      if (!reservationSearchTerm) return true;
      const searchTerm = reservationSearchTerm.toLowerCase();
      const studentId = reservation.studentId;
      const studentName = reservation.studentName || reservation.name;
      return (
        studentId?.toLowerCase().includes(searchTerm) || studentName?.toLowerCase().includes(searchTerm)
      );
    });
  }, [sortedReservationData, reservationSearchTerm]);

  const pendingCheckinRows = useMemo(
    () => filteredReservationData.filter((r) => r.checkinStatus === '未簽到'),
    [filteredReservationData]
  );

  const noShowReservationCount = useMemo(() => {
    if (resv.loaded) return reservationData.filter((r) => r.checkinStatus === '未簽到').length;
    if (meta.uncheckedCount != null) return meta.uncheckedCount;
    return 0;
  }, [resv.loaded, reservationData, meta.uncheckedCount]);

  const checkedInCount = useMemo(() => {
    if (resv.loaded) return reservationData.filter((r) => r.checkinStatus === '已簽到').length;
    if (meta.checkedInCount != null) return meta.checkedInCount;
    return 0;
  }, [resv.loaded, reservationData, meta.checkedInCount]);

  const violationRegisteredCount = useMemo(() => {
    if (resv.loaded) return reservationData.filter((r) => r.checkinStatus === '已登記違規').length;
    if (meta.violationRegisteredCount != null) return meta.violationRegisteredCount;
    return 0;
  }, [resv.loaded, reservationData, meta.violationRegisteredCount]);

  const enrolledCount = useMemo(() => {
    if (resv.loaded) return reservationData.length;
    if (meta.reservedCount != null) return meta.reservedCount;
    return 0;
  }, [resv.loaded, reservationData.length, meta.reservedCount]);

  const eventEnded = useMemo(() => {
    if (!currentEventDate) return false;
    if (eventMeta.endTime) {
      const end = dayjs(`${currentEventDate}T${eventMeta.endTime}`);
      return end.isValid() && dayjs().isAfter(end);
    }
    const d = dayjs(currentEventDate).endOf('day');
    return dayjs().isAfter(d);
  }, [currentEventDate, eventMeta.endTime]);

  const checkinOpenHint = useMemo(() => {
    if (!currentEventDate) return false;
    return isEventToday(currentEventDate);
  }, [currentEventDate, isEventToday]);

  const reload = useCallback(async () => {
    debugEventDetail('workspace:reload:start', { activeTab });
    await meta.reload();
    resv.invalidateCache();
    vio.invalidateCache();
    if (['reservations', 'checkin', 'violations'].includes(activeTab)) {
      await resv.load(true);
    }
    if (activeTab === 'violations') {
      await vio.load(true);
    }
    if (activeTab === 'reservations') {
      await fetchWaitlist();
    }
    debugEventDetail('workspace:reload:done', { activeTab });
  }, [activeTab, meta, resv, vio, fetchWaitlist]);

  const eventViolations = vio.list;

  const resBlocking = resv.loading && !resv.loaded;
  const vioBlocking =
    activeTab === 'violations' &&
    (!resv.loaded || !vio.loaded) &&
    (resv.loading || vio.loading);

  const reservationsTabProps = useMemo(
    () => ({
      resBlocking,
      reservationsError: resv.error,
      reservationSearchTerm,
      setReservationSearchTerm,
      reservationSortField,
      reservationSortOrder,
      handleReservationSort,
      filteredReservationData,
      currentEventType,
      canCheckinStudents,
      canManageViolations,
      canManageEvents,
      canViewReservations,
      checkinLoading,
      handleCheckin,
      isEventToday,
      currentEventDate,
      waitlistItems,
      waitlistLoading,
      waitlistError,
      refreshWaitlist: fetchWaitlist,
      handleDeleteReservation,
    }),
    [
      resBlocking,
      resv.error,
      reservationSearchTerm,
      reservationSortField,
      reservationSortOrder,
      handleReservationSort,
      filteredReservationData,
      currentEventType,
      canCheckinStudents,
      canManageViolations,
      canManageEvents,
      canViewReservations,
      checkinLoading,
      handleCheckin,
      isEventToday,
      currentEventDate,
      waitlistItems,
      waitlistLoading,
      waitlistError,
      fetchWaitlist,
      handleDeleteReservation,
    ],
  );

  const checkinTabProps = useMemo(
    () => ({
      resBlocking,
      reservationsError: resv.error,
      pendingCheckinRows,
      currentEventType,
      currentEventDate,
      canCheckinStudents,
      canManageEvents,
      checkinLoading,
      handleCheckin,
      isEventToday,
    }),
    [
      resBlocking,
      resv.error,
      pendingCheckinRows,
      currentEventType,
      currentEventDate,
      canCheckinStudents,
      canManageEvents,
      checkinLoading,
      handleCheckin,
      isEventToday,
    ],
  );

  const importExportTabProps = useMemo(
    () => ({
      canExportReservations,
      canExportEtGrouping,
      currentEventType,
      handleExport,
      handleExportEtGrouping,
      canImportExcel,
      importFile,
      importLoading,
      importError,
      importResult,
      handleImportFileChange,
      handleImportExcel,
    }),
    [
      canExportReservations,
      canExportEtGrouping,
      currentEventType,
      handleExport,
      handleExportEtGrouping,
      canImportExcel,
      importFile,
      importLoading,
      importError,
      importResult,
      handleImportFileChange,
      handleImportExcel,
    ],
  );

  const groupingTabProps = useMemo(
    () => ({
      visible: canViewEtGrouping && canAccessCurrentEvent && (currentEventType || 'English Table') === 'English Table',
      token,
      eventId: currentEventId,
      eventType: currentEventType,
      canManage: canManageEtGrouping,
      canExport: canExportEtGrouping,
      onExport: handleExportEtGrouping,
      onPublished: () => {
        if (resv.refresh) resv.refresh();
      },
    }),
    [
      canViewEtGrouping,
      canManageEtGrouping,
      canExportEtGrouping,
      handleExportEtGrouping,
      canAccessCurrentEvent,
      currentEventType,
      token,
      currentEventId,
      resv.refresh,
    ],
  );

  const taskMarksTabProps = useMemo(
    () => ({
      visible: (canMarkEtSessionTasks || canManageEtGrouping)
        && canAccessCurrentEvent
        && (currentEventType || 'English Table') === 'English Table',
      token,
      eventId: currentEventId,
      eventType: currentEventType,
      canManage: canManageEtGrouping,
      canMark: canMarkEtSessionTasks || canManageEtGrouping,
    }),
    [
      canMarkEtSessionTasks,
      canManageEtGrouping,
      canAccessCurrentEvent,
      currentEventType,
      token,
      currentEventId,
    ],
  );

  const violationsTabProps = useMemo(
    () => ({
      vioBlocking,
      reservationsError: resv.error,
      violationsError: vio.error,
      canManageViolations,
      canManageBlacklist,
      currentEventId,
      currentEventAutoCheckCompleted,
      noShowReservationCount,
      batchMarkNoShowLoading,
      handleBatchMarkNoShow,
      autoCheckLoading,
      handleAutoCheck,
      openViolationModal,
      eventViolations,
    }),
    [
      vioBlocking,
      resv.error,
      vio.error,
      canManageViolations,
      canManageBlacklist,
      currentEventId,
      currentEventAutoCheckCompleted,
      noShowReservationCount,
      batchMarkNoShowLoading,
      handleBatchMarkNoShow,
      autoCheckLoading,
      handleAutoCheck,
      openViolationModal,
      eventViolations,
    ],
  );

  const violationModalProps = useMemo(
    () => ({
      showViolationModal,
      setShowViolationModal,
      violationData,
      setViolationData,
      handleRecordEventViolation,
      canManageViolations,
    }),
    [
      showViolationModal,
      violationData,
      handleRecordEventViolation,
      canManageViolations,
    ],
  );

  return {
    detailLoading: meta.loading,
    detailError: meta.error,
    reload,

    reservationsLoading: resv.loading,
    reservationsLoaded: resv.loaded,
    reservationsError: resv.error,

    violationsLoading: vio.loading,
    violationsLoaded: vio.loaded,
    violationsError: vio.error,

    waitlistItems,
    waitlistLoading,
    waitlistError,
    refreshWaitlist: fetchWaitlist,

    currentEventName,
    currentEventDate,
    currentEventStartTime,
    currentEventId,
    currentEventType,
    currentEventAutoCheckCompleted,
    reservationSearchTerm,
    setReservationSearchTerm,
    reservationSortField,
    reservationSortOrder,
    handleReservationSort,
    filteredReservationData,
    pendingCheckinRows,
    noShowReservationCount,
    checkedInCount,
    violationRegisteredCount,
    enrolledCount,
    /** 預約名單列層級資料是否已載入（與頁首 aggregate 可並存） */
    countsReady: resv.loaded,
    /** meta 已回傳 aggregate，頁首可顯示數字 */
    headerCountsReady: meta.ready,
    metaReservedCount: meta.reservedCount,
    eventMeta,
    eventEnded,
    checkinOpenHint,
    checkinLoading,
    handleCheckin,
    handleDeleteReservation,
    canCancelReservation,
    isEventToday,
    hasAdminRights,
    isAdmin,
    canViewReservations,
    canExportReservations,
    canCheckinStudents,
    canManageViolations,
    canViewBlacklist,
    canManageBlacklist,
    canManageEvents,
    canAccessCurrentEvent,
    canImportExcel,
    importFile,
    importLoading,
    importError,
    importResult,
    handleImportFileChange,
    handleImportExcel,
    handleExport,
    showViolationModal,
    setShowViolationModal,
    violationData,
    setViolationData,
    eventViolations,
    openViolationModal,
    handleRecordEventViolation,
    batchMarkNoShowLoading,
    handleBatchMarkNoShow,
    autoCheckLoading,
    handleAutoCheck,
    reservationsTabProps,
    checkinTabProps,
    groupingTabProps,
    taskMarksTabProps,
    importExportTabProps,
    violationsTabProps,
    violationModalProps,
  };
}
