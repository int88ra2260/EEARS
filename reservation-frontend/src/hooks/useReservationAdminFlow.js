// hooks/useReservationAdminFlow.js
// Phase 1：單一活動預約詳情的資料載入與當前活動資訊。
// Phase 2：預約詳情的搜尋 / 排序與衍生列表（reservationList）。
// Phase 3：reservation detail modal 開關（showReservationModal、openReservationDetail、closeReservationDetail）。
// Checkin：單筆簽到 / 補簽到（checkinLoading、handleCheckin）。
// Delete reservation：刪除預約（handleDeleteReservation）。
// canCancelReservation：是否在活動開始前 2 小時外（可顯示取消預約按鈕）。
// Violation flow：違規登記 modal 與提交（showViolationModal、violationData、openViolationModal、handleRecordEventViolation）。
// Auto-check flow：活動結束檢查（autoCheckLoading、handleAutoCheck）。
// Batch no-show flow：批次登記未簽到為預約未到（batchMarkNoShowLoading、handleBatchMarkNoShow）。
// Import excel flow：匯入刷卡機 Excel（showImportModal、importFile、openImportExcelModal、handleImportExcel 等）。

import { useState, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import useConfirm from '../components/ui/useConfirm';
import { RESERVATION_CUTOFF_HOURS } from '../constants/reservationRules';
import {
  batchMarkEventNoShow,
  checkinEventReservation,
  createEventViolation,
  deleteAdminReservation,
  fetchEventReservations,
  fetchEventViolations,
  importEventCardExcel,
  runEventAutoCheck,
} from '../services/eventAdminService';

/**
 * @typedef {Object} CurrentEvent
 * @property {number|string|null} id
 * @property {string} name
 * @property {string} date
 * @property {string} startTime
 * @property {string} eventType
 * @property {boolean} autoCheckCompleted
 */

/**
 * @param {Object} options
 * @param {string} [options.token]
 * @param {function(string)} [options.showSuccessMessage]
 * @param {function(string)} [options.showErrorMessage]
 * @param {(dateStr: string) => boolean} [options.isEventToday] - 是否為當日活動（用於簽到權限與補簽到確認）
 * @param {boolean} [options.hasAdminRights] - 是否有管理員權限（可補簽到）
 * @returns {{
 *   currentEvent: CurrentEvent|null,
 *   reservationData: Array,
 *   eventViolations: Array,
 *   fetchEventReservations: (eventId: number|string) => Promise<Object>,
 *   fetchEventViolations: (eventId: number|string) => Promise<void>,
 *   refreshReservations: (targetEventId?: number|string) => Promise<void>,
 *   viewReservations: (eventId: number|string, eventName: string, eventType?: string, eventStartTime?: string|null) => Promise<void>,
 *   setCurrentEventAutoCheckCompleted: (completed: boolean) => void,
 *   searchTerm: string,
 *   onSearchChange: (value: string) => void,
 *   sortConfig: { field: string, order: string },
 *   onSortChange: (field: string) => void,
 *   reservationList: Array,
 *   resetSearchAndSort: () => void,
 *   showReservationModal: boolean,
 *   openReservationDetail: (eventId: number|string, eventName: string, eventType?: string, eventStartTime?: string|null) => Promise<void>,
 *   closeReservationDetail: () => void,
 *   checkinLoading: Object,
 *   handleCheckin: (reservationId: number|string) => Promise<void>,
 *   handleDeleteReservation: (reservationId: number|string, studentId: string, studentName: string) => Promise<void>,
 *   canCancelReservation: () => boolean,
 *   showViolationModal: boolean,
 *   violationData: { studentId: string, violationType: string, description: string },
 *   onViolationFieldsChange: (next: Object) => void,
 *   violationLoading: boolean,
 *   violationError: string,
 *   openViolationModal: (studentId?: string) => void,
 *   closeViolationModal: () => void,
 *   handleRecordEventViolation: () => Promise<void>,
 *   batchMarkNoShowLoading: boolean,
 *   handleBatchMarkNoShow: () => Promise<void>,
 *   autoCheckLoading: boolean,
 *   handleAutoCheck: () => Promise<void>,
 *   showImportModal: boolean,
 *   importFile: File|null,
 *   importLoading: boolean,
 *   importError: string,
 *   importResult: Object|null,
 *   openImportExcelModal: () => void,
 *   closeImportExcelModal: () => void,
 *   handleImportFileChange: (file: File|null) => void,
 *   handleImportExcel: () => Promise<void>
 * }}
 */
const DEFAULT_SORT_FIELD = 'studentId';
const DEFAULT_SORT_ORDER = 'asc';

const DEFAULT_VIOLATION_FIELDS = {
  studentId: '',
  violationType: '擾亂秩序',
  description: ''
};

export function useReservationAdminFlow({ token, showSuccessMessage, showErrorMessage, isEventToday, hasAdminRights }) {
  const { confirm } = useConfirm();
  const [currentEvent, setCurrentEvent] = useState(/** @type {CurrentEvent|null} */ (null));
  const [reservationData, setReservationData] = useState([]);
  const [eventViolations, setEventViolations] = useState([]);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [autoCheckLoading, setAutoCheckLoading] = useState(false);
  const [batchMarkNoShowLoading, setBatchMarkNoShowLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState(DEFAULT_SORT_FIELD);
  const [sortOrder, setSortOrder] = useState(DEFAULT_SORT_ORDER);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationData, setViolationData] = useState(DEFAULT_VIOLATION_FIELDS);
  const [violationLoading, setViolationLoading] = useState(false);
  const [violationError, setViolationError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(/** @type {File|null} */ (null));
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(/** @type {Object|null} */ (null));

  const loadEventReservations = useCallback(async (eventId) => {
    return fetchEventReservations(token, eventId);
  }, [token]);

  const loadEventViolations = useCallback(async (eventId) => {
    try {
      const rows = await fetchEventViolations(token, eventId);
      setEventViolations(rows);
    } catch (error) {
      console.error('載入違規記錄錯誤:', error);
    }
  }, [token]);

  const refreshReservations = useCallback(async (targetEventId) => {
    const id = targetEventId ?? currentEvent?.id;
    if (!id) return;
    try {
      const data = await loadEventReservations(id);
      const list = data.reservations || data || [];
      setReservationData(list);
      setCurrentEvent(prev => {
        if (!prev || prev.id !== id) return prev;
        return {
          ...prev,
          date: data.eventDate ?? prev.date,
          startTime: data.eventStartTime ?? prev.startTime,
          autoCheckCompleted: data.autoCheckCompleted ?? prev.autoCheckCompleted
        };
      });
    } catch (error) {
      console.error('刷新預約資料失敗:', error);
      if (showErrorMessage) showErrorMessage('刷新預約資料失敗：' + error.message);
    }
  }, [currentEvent?.id, loadEventReservations, showErrorMessage]);

  const viewReservations = useCallback(async (eventId, eventName, eventType, eventStartTime = null) => {
    const data = await loadEventReservations(eventId);
    const list = data.reservations || data || [];
    setReservationData(list);
    setCurrentEvent({
      id: eventId,
      name: eventName,
      date: data.eventDate || '',
      startTime: data.eventStartTime || eventStartTime || '',
      eventType: eventType || 'English Table',
      autoCheckCompleted: data.autoCheckCompleted || false
    });
    await loadEventViolations(eventId);
  }, [loadEventReservations, loadEventViolations]);

  const viewReservationsWithError = useCallback(async (eventId, eventName, eventType, eventStartTime = null) => {
    try {
      await viewReservations(eventId, eventName, eventType, eventStartTime);
    } catch (error) {
      if (showErrorMessage) showErrorMessage('載入預約資料失敗：' + error.message);
      throw error;
    }
  }, [viewReservations, showErrorMessage]);

  const setCurrentEventAutoCheckCompleted = useCallback((completed) => {
    setCurrentEvent(prev => prev ? { ...prev, autoCheckCompleted: !!completed } : null);
  }, []);

  // Phase 2：排序
  const sortedData = useMemo(() => {
    return [...reservationData].sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'studentId') {
        aVal = a.studentId;
        bVal = b.studentId;
      } else if (sortField === 'name') {
        aVal = a.studentName || a.name;
        bVal = b.studentName || b.name;
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }
      if (sortField === 'checkinStatus') {
        const statusOrder = { '已簽到': 1, '未簽到': 2, '已登記違規': 3 };
        aVal = statusOrder[aVal] || 4;
        bVal = statusOrder[bVal] || 4;
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal != null && typeof bVal === 'string') ? bVal.toLowerCase() : bVal;
      }
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });
  }, [reservationData, sortField, sortOrder]);

  // Phase 2：篩選（學號 / 姓名）
  const reservationList = useMemo(() => {
    if (!searchTerm.trim()) return sortedData;
    const term = searchTerm.toLowerCase();
    return sortedData.filter(r => {
      const studentId = r.studentId;
      const studentName = r.studentName || r.name;
      return (
        studentId?.toLowerCase().includes(term) ||
        studentName?.toLowerCase().includes(term)
      );
    });
  }, [sortedData, searchTerm]);

  const onSortChange = useCallback((field) => {
    setSortField(prev => {
      if (prev === field) {
        setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder(DEFAULT_SORT_ORDER);
      return field;
    });
  }, []);

  const resetSearchAndSort = useCallback(() => {
    setSearchTerm('');
    setSortField(DEFAULT_SORT_FIELD);
    setSortOrder(DEFAULT_SORT_ORDER);
  }, []);

  // Phase 3：開啟預約詳情（載入資料 + 顯示 modal）
  const openReservationDetail = useCallback(async (eventId, eventName, eventType, eventStartTime = null) => {
    try {
      await viewReservationsWithError(eventId, eventName, eventType, eventStartTime);
      setShowReservationModal(true);
    } catch (error) {
      // viewReservationsWithError 已顯示錯誤訊息
    }
  }, [viewReservationsWithError]);

  // Phase 3：關閉預約詳情（重置 search/sort、autoCheckCompleted）
  const closeReservationDetail = useCallback(() => {
    setShowReservationModal(false);
    setCurrentEventAutoCheckCompleted(false);
    resetSearchAndSort();
  }, [setCurrentEventAutoCheckCompleted, resetSearchAndSort]);

  // Checkin：單筆簽到 / 補簽到
  const handleCheckin = useCallback(async (reservationId) => {
    const eventDate = currentEvent?.date;
    const eventId = currentEvent?.id;
    const isToday = typeof isEventToday === 'function' ? isEventToday(eventDate) : false;
    const adminRights = !!hasAdminRights;

    if (!isToday && !adminRights) {
      if (showErrorMessage) showErrorMessage('只能對當天的活動進行簽到');
      return;
    }
    if (!isToday && adminRights) {
      const ok = await confirm({
        title: '確認補簽到？',
        description: `此活動日期為 ${eventDate}，確定要進行補簽到嗎？`,
        confirmText: '確認補簽到',
        cancelText: '取消',
        variant: 'warning',
      });
      if (!ok) {
        return;
      }
    }
    if (!eventId) {
      if (showErrorMessage) showErrorMessage('目前沒有選定的活動');
      return;
    }

    setCheckinLoading(prev => ({ ...prev, [reservationId]: true }));
    try {
      const data = await checkinEventReservation(token, eventId, reservationId);
      if (showSuccessMessage) showSuccessMessage('簽到成功！');
      setReservationData((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, checkinStatus: '已簽到', checkinTime: data.checkinTime }
            : r
        )
      );
    } catch (error) {
      console.error('簽到錯誤:', error);
      if (showErrorMessage) showErrorMessage('簽到失敗');
    } finally {
      setCheckinLoading(prev => ({ ...prev, [reservationId]: false }));
    }
  }, [token, currentEvent?.id, currentEvent?.date, isEventToday, hasAdminRights, showSuccessMessage, showErrorMessage]);

  // 刪除預約（管理員功能）
  const handleDeleteReservation = useCallback(async (reservationId, studentId, studentName) => {
    if (!hasAdminRights) {
      if (showErrorMessage) showErrorMessage('只有管理員可以刪除預約紀錄');
      return;
    }
    const ok = await confirm({
      title: '確認刪除預約紀錄？',
      description: `確認要刪除學生 ${studentId} (${studentName}) 的預約紀錄嗎？此操作無法復原。`,
      confirmText: '刪除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    try {
      await deleteAdminReservation(token, reservationId);
      if (showSuccessMessage) showSuccessMessage('已成功刪除預約紀錄');
      await refreshReservations();
    } catch (error) {
      console.error('刪除預約錯誤:', error);
      if (showErrorMessage) showErrorMessage('刪除預約失敗：' + error.message);
    }
  }, [token, hasAdminRights, showSuccessMessage, showErrorMessage, refreshReservations]);

  // 是否在活動開始前 2 小時之前（可取消預約）
  const canCancelReservation = useCallback(() => {
    if (!currentEvent?.date || !currentEvent?.startTime) return false;
    const now = dayjs();
    const eventStart = dayjs(`${currentEvent.date}T${currentEvent.startTime}`);
    if (!eventStart.isValid()) return false;
    const twoHoursBefore = eventStart.subtract(RESERVATION_CUTOFF_HOURS, 'hour');
    return now.isBefore(twoHoursBefore);
  }, [currentEvent?.date, currentEvent?.startTime]);

  // Violation flow：開啟違規登記 modal
  const openViolationModal = useCallback((studentId = '') => {
    setViolationData({
      studentId: String(studentId),
      violationType: '擾亂秩序',
      description: ''
    });
    setViolationError('');
    setShowViolationModal(true);
  }, []);

  const closeViolationModal = useCallback(() => {
    setShowViolationModal(false);
    setViolationError('');
  }, []);

  // 登記違規
  const handleRecordEventViolation = useCallback(async () => {
    const eventId = currentEvent?.id;
    if (!eventId) {
      setViolationError('目前沒有選定的活動，請重新開啟預約詳情');
      return;
    }
    if (!violationData.studentId.trim()) {
      setViolationError('請輸入學號');
      return;
    }
    setViolationError('');
    setViolationLoading(true);
    try {
      await createEventViolation(token, eventId, violationData);
      if (showSuccessMessage) showSuccessMessage('違規記錄已建立！');
      setShowViolationModal(false);
      setViolationData(DEFAULT_VIOLATION_FIELDS);
      setViolationError('');
      try {
        await Promise.all([
          loadEventViolations(eventId),
          refreshReservations(eventId),
        ]);
      } catch (refreshError) {
        console.error('更新預約詳情失敗:', refreshError);
      }
    } catch (error) {
      console.error('登記違規錯誤:', error);
      setViolationError('登記違規失敗');
    } finally {
      setViolationLoading(false);
    }
  }, [token, currentEvent?.id, violationData, showSuccessMessage, loadEventViolations, refreshReservations]);

  // 批次登記所有未簽到學生為「預約未到」
  const handleBatchMarkNoShow = useCallback(async () => {
    const eventId = currentEvent?.id;
    if (!eventId) {
      if (showErrorMessage) showErrorMessage('目前沒有選定的活動，請重新開啟預約詳情');
      return;
    }
    const noShowCount = reservationData.filter(r => r.checkinStatus === '未簽到').length;
    if (noShowCount === 0) {
      if (showErrorMessage) showErrorMessage('目前沒有未簽到的學生');
      return;
    }
    const ok = await confirm({
      title: '確認批次登記預約未到？',
      description: `確定要將 ${noShowCount} 位未簽到的學生登記為「預約未到」嗎？`,
      confirmText: '確認登記',
      cancelText: '取消',
      variant: 'warning',
    });
    if (!ok) {
      return;
    }
    setBatchMarkNoShowLoading(true);
    try {
      const data = await batchMarkEventNoShow(token, eventId);
      if (showSuccessMessage) showSuccessMessage(data.message || `成功登記 ${data.successCount} 位學生為預約未到`);
      await Promise.all([
        loadEventViolations(eventId),
        refreshReservations(eventId),
      ]);
    } catch (error) {
      console.error('批次登記未簽到學生錯誤:', error);
      if (showErrorMessage) showErrorMessage('批次登記失敗');
    } finally {
      setBatchMarkNoShowLoading(false);
    }
  }, [token, currentEvent?.id, reservationData, showSuccessMessage, showErrorMessage, loadEventViolations, refreshReservations, confirm]);

  // 活動結束檢查：將違規記錄同步至黑名單並處理未簽到學生
  const handleAutoCheck = useCallback(async () => {
    const eventId = currentEvent?.id;
    if (!eventId) {
      if (showErrorMessage) showErrorMessage('目前沒有選定的活動，請重新開啟預約詳情');
      return;
    }

    const ok = await confirm({
      title: '確認執行活動結束檢查？',
      description: '活動結束檢查會將活動期間違規與未簽到學生同步到黑名單。',
      confirmText: '執行',
      cancelText: '取消',
      variant: 'warning',
    });
    if (!ok) {
      return;
    }

    setAutoCheckLoading(true);
    try {
      const data = await runEventAutoCheck(token, eventId);
      const stats = data.results || {};
      const summaryMessage = data.message ||
        `處理完成：總筆數 ${stats.processedCount || 0}，違規記錄 ${stats.violationRecords || 0}，預約未到 ${stats.noShowRecords || 0}`;
      if (showSuccessMessage) showSuccessMessage(summaryMessage);
      setCurrentEventAutoCheckCompleted(true);
      await Promise.all([
        loadEventViolations(eventId),
        refreshReservations(eventId),
      ]);
    } catch (error) {
      console.error('活動結束檢查錯誤:', error);
      if (error.data?.alreadyCompleted) {
        setCurrentEventAutoCheckCompleted(true);
      }
      if (showErrorMessage) showErrorMessage(error.message || '活動結束檢查失敗');
    } finally {
      setAutoCheckLoading(false);
    }
  }, [token, currentEvent?.id, loadEventViolations, refreshReservations, setCurrentEventAutoCheckCompleted, showSuccessMessage, showErrorMessage, confirm]);

  // Import excel flow
  const openImportExcelModal = useCallback(() => {
    if (!currentEvent?.id) {
      if (showErrorMessage) showErrorMessage('請先開啟預約詳情');
      return;
    }
    setImportFile(null);
    setImportError('');
    setImportResult(null);
    setShowImportModal(true);
  }, [currentEvent?.id, showErrorMessage]);

  const closeImportExcelModal = useCallback(() => {
    if (importLoading) return;
    setShowImportModal(false);
    setImportFile(null);
    setImportError('');
    setImportResult(null);
  }, [importLoading]);

  const handleImportFileChange = useCallback((file) => {
    setImportFile(file);
    setImportError('');
  }, []);

  const handleImportExcel = useCallback(async () => {
    const eventId = currentEvent?.id;
    if (!eventId) {
      setImportError('目前沒有選定的活動，請重新開啟預約詳情');
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
      const data = await importEventCardExcel(token, eventId, importFile);
      setImportResult(data);
      if (showSuccessMessage) showSuccessMessage(data.message || '匯入完成');
      await refreshReservations(eventId);
    } catch (error) {
      console.error('匯入刷卡機 Excel 失敗:', error);
      const message = error.message || '匯入失敗，請稍後再試';
      setImportError(message);
      if (showErrorMessage) showErrorMessage(message);
    } finally {
      setImportLoading(false);
    }
  }, [token, currentEvent?.id, importFile, showSuccessMessage, showErrorMessage, refreshReservations]);

  return {
    currentEvent,
    reservationData,
    eventViolations,
    fetchEventReservations: loadEventReservations,
    fetchEventViolations: loadEventViolations,
    refreshReservations,
    viewReservations: viewReservationsWithError,
    setCurrentEventAutoCheckCompleted,
    searchTerm,
    onSearchChange: setSearchTerm,
    sortConfig: { field: sortField, order: sortOrder },
    onSortChange,
    reservationList,
    resetSearchAndSort,
    showReservationModal,
    openReservationDetail,
    closeReservationDetail,
    checkinLoading,
    autoCheckLoading,
    handleCheckin,
    handleDeleteReservation,
    canCancelReservation,
    showViolationModal,
    violationData,
    onViolationFieldsChange: setViolationData,
    violationLoading,
    violationError,
    openViolationModal,
    closeViolationModal,
    handleRecordEventViolation,
    batchMarkNoShowLoading,
    handleBatchMarkNoShow,
    handleAutoCheck,
    showImportModal,
    importFile,
    importLoading,
    importError,
    importResult,
    openImportExcelModal,
    closeImportExcelModal,
    handleImportFileChange,
    handleImportExcel
  };
}
