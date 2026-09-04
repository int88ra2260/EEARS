import { useState } from 'react';
import dayjs from 'dayjs';
import { safeAPICall, showErrorMessage, showSuccessMessage } from '../utils/errorHandler';
import {
  createEvent,
  createEventsBatch,
  fetchEventById,
  updateEvent,
  deleteEvent,
  forceDeleteEvent,
  exportEventReservations,
  exportReportSummary,
  downloadBlob,
} from '../services/eventService';
import { useAdminEventSummary } from './useAdminEventSummary';
import {
  getDefaultCapacityFields,
  validateCapacityFields,
  buildCapacityRequestPayload,
  mapEventToCapacityFields,
} from '../utils/eventCapacityFields';

export const DEFAULT_EVENT_NOTES = '實踐歷程檔案';

const EMPTY_ADD_FIELDS = {
  name: '',
  eventType: 'English Table',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  notes: DEFAULT_EVENT_NOTES,
  customEventType: '',
  customReservationRule: '',
  ...getDefaultCapacityFields('English Table'),
};

const createEmptyBatchRow = () => ({
  name: '',
  eventType: 'English Table',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  notes: DEFAULT_EVENT_NOTES,
  customEventType: '',
  customReservationRule: '',
  ...getDefaultCapacityFields('English Table'),
});

const EMPTY_EDIT_FIELDS = {
  eventId: '',
  name: '',
  eventType: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  notes: DEFAULT_EVENT_NOTES,
  customEventType: '',
  customReservationRule: '',
};

export function useAdminEventOperations({
  token,
  canViewEventsAdmin,
  canManageEvents,
  canExportReports,
  canExportReservations,
  confirm,
}) {
  const summaryState = useAdminEventSummary({ token, canViewEventsAdmin });
  const {
    selectedSemester,
    selectedEventType,
    fetchSummary,
  } = summaryState;

  const [addFields, setAddFields] = useState(EMPTY_ADD_FIELDS);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const [editModalShow, setEditModalShow] = useState(false);
  const [editFields, setEditFields] = useState(EMPTY_EDIT_FIELDS);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const [deleteConfirmModalShow, setDeleteConfirmModalShow] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState('');
  const [deleteEventName, setDeleteEventName] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [showBatchAddModal, setShowBatchAddModal] = useState(false);
  const [batchEvents, setBatchEvents] = useState(() => [createEmptyBatchRow()]);
  const [batchAddLoading, setBatchAddLoading] = useState(false);
  const [batchAddError, setBatchAddError] = useState('');
  const [batchAddResult, setBatchAddResult] = useState(null);
  const [showBatchDatePicker, setShowBatchDatePicker] = useState(false);
  const [batchSelectedDates, setBatchSelectedDates] = useState([]);

  const refreshSummary = () => {
    fetchSummary(selectedSemester, selectedEventType);
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!canManageEvents) {
      setAddError('您沒有活動管理權限');
      return;
    }

    setAddLoading(true);
    setAddError('');

    let finalEventType = addFields.eventType;
    if (addFields.eventType === '其他') {
      if (!addFields.customEventType.trim()) {
        setAddError('請填寫自定義活動類型名稱');
        setAddLoading(false);
        return;
      }
      if (!addFields.customReservationRule.trim()) {
        setAddError('請填寫自定義活動的預約開始時間規則');
        setAddLoading(false);
        return;
      }
      finalEventType = addFields.customEventType.trim();
    }

    const capacityError = validateCapacityFields(addFields, finalEventType);
    if (capacityError) {
      setAddError(capacityError);
      setAddLoading(false);
      return;
    }

    const requestData = {
      name: addFields.name,
      eventType: finalEventType,
      date: addFields.date,
      startTime: addFields.startTime,
      endTime: addFields.endTime,
      location: addFields.location?.trim() || null,
      notes: addFields.notes?.trim() || DEFAULT_EVENT_NOTES,
      ...buildCapacityRequestPayload(addFields, finalEventType),
    };

    if (addFields.eventType === '其他') {
      requestData.customReservationRule = addFields.customReservationRule;
    }

    const result = await safeAPICall(async () => createEvent(token, requestData));

    if (result.success) {
      setAddFields(EMPTY_ADD_FIELDS);
      refreshSummary();
      showErrorMessage('活動新增成功！');
    } else {
      setAddError(result.error || '新增活動失敗');
    }

    setAddLoading(false);
  };

  const handleBatchAddEvents = async () => {
    if (!canManageEvents) {
      setBatchAddError('您沒有活動管理權限');
      return;
    }

    setBatchAddLoading(true);
    setBatchAddError('');
    setBatchAddResult(null);

    const validEvents = [];
    const errors = [];

    for (let i = 0; i < batchEvents.length; i += 1) {
      const event = {
        ...getDefaultCapacityFields(batchEvents[i]?.eventType || 'English Table'),
        ...batchEvents[i],
      };

      if (!event.name.trim() && !event.date && !event.startTime) {
        continue;
      }

      if (!event.name.trim()) {
        errors.push(`第 ${i + 1} 行：缺少活動名稱`);
        continue;
      }
      if (!event.date) {
        errors.push(`第 ${i + 1} 行：缺少日期`);
        continue;
      }
      if (!event.startTime) {
        errors.push(`第 ${i + 1} 行：缺少開始時間`);
        continue;
      }
      if (!event.endTime) {
        errors.push(`第 ${i + 1} 行：缺少結束時間`);
        continue;
      }

      if (!event.eventType || event.eventType === '其他') {
        errors.push(`第 ${i + 1} 行：請選擇有效的活動類型`);
        continue;
      }

      const capacityError = validateCapacityFields(event, event.eventType);
      if (capacityError) {
        errors.push(`第 ${i + 1} 行：${capacityError}`);
        continue;
      }

      validEvents.push({
        name: event.name.trim(),
        eventType: event.eventType,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location?.trim() || null,
        notes: event.notes?.trim() || DEFAULT_EVENT_NOTES,
        ...buildCapacityRequestPayload(event, event.eventType),
      });
    }

    if (errors.length > 0) {
      setBatchAddError(errors.join('\n'));
      setBatchAddLoading(false);
      return;
    }

    if (validEvents.length === 0) {
      setBatchAddError('請至少填寫一個活動');
      setBatchAddLoading(false);
      return;
    }

    const result = await safeAPICall(async () => createEventsBatch(token, validEvents));

    if (result.success) {
      const data = result.data || result;
      setBatchAddResult(data);
      refreshSummary();

      if (data.successCount > 0) {
        showSuccessMessage(`成功新增 ${data.successCount} 個活動！${data.failureCount > 0 ? `（失敗 ${data.failureCount} 個）` : ''}`);
      } else {
        showErrorMessage('所有活動新增失敗，請檢查錯誤訊息');
      }

      if (data.errors && data.errors.length > 0) {
        setBatchAddError(data.errors.join('\n'));
      }

      if (data.failureCount === 0 && data.successCount > 0) {
        setBatchEvents([createEmptyBatchRow()]);
      }
    } else {
      setBatchAddError(result.error || '批量新增活動失敗');
    }

    setBatchAddLoading(false);
  };

  const openBatchAddModal = () => {
    setBatchEvents([createEmptyBatchRow()]);
    setBatchAddError('');
    setBatchAddResult(null);
    setShowBatchAddModal(true);
  };

  const closeBatchAddModal = () => {
    if (batchAddLoading) return;
    setShowBatchAddModal(false);
    setBatchAddError('');
    setBatchAddResult(null);
    setShowBatchDatePicker(false);
    setBatchSelectedDates([]);
  };

  const cancelBatchAddModal = () => {
    setShowBatchAddModal(false);
    setBatchAddError('');
    setBatchAddResult(null);
  };

  const addBatchEventRow = () => {
    setBatchEvents((current) => [...current, createEmptyBatchRow()]);
  };

  const removeBatchEventRow = (index) => {
    setBatchEvents((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, i) => i !== index);
    });
  };

  const updateBatchEvent = (index, field, value) => {
    setBatchEvents((current) => {
      const updated = [...current];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleBatchDateSelect = () => {
    if (batchEvents.length === 0) {
      showErrorMessage('請先填寫活動基本資訊');
      return;
    }

    const firstEvent = batchEvents[0];
    if (!firstEvent.name.trim() || !firstEvent.startTime || !firstEvent.endTime) {
      showErrorMessage('請先填寫活動名稱、開始時間和結束時間');
      return;
    }

    setShowBatchDatePicker(true);
  };

  const applyBatchDates = () => {
    if (batchSelectedDates.length === 0) {
      showErrorMessage('請至少選擇一個日期');
      return;
    }

    const firstEvent = {
      ...getDefaultCapacityFields(batchEvents[0]?.eventType || 'English Table'),
      ...batchEvents[0],
    };
    const newEvents = batchSelectedDates.map((date) => ({
      name: firstEvent.name,
      eventType: firstEvent.eventType,
      date,
      startTime: firstEvent.startTime,
      endTime: firstEvent.endTime,
      location: firstEvent.location || '',
      notes: firstEvent.notes || DEFAULT_EVENT_NOTES,
      groupCount: firstEvent.groupCount,
      perGroupCapacity: firstEvent.perGroupCapacity,
      maxParticipants: firstEvent.maxParticipants,
      customEventType: '',
      customReservationRule: '',
    }));

    setBatchEvents(newEvents);
    setShowBatchDatePicker(false);
    setBatchSelectedDates([]);
    showSuccessMessage(`已為 ${batchSelectedDates.length} 個日期創建活動`);
  };

  const addDateToBatch = (date) => {
    if (!date) return;
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    setBatchSelectedDates((current) => {
      if (current.includes(dateStr)) return current;
      return [...current, dateStr].sort();
    });
  };

  const removeDateFromBatch = (date) => {
    setBatchSelectedDates((current) => current.filter((d) => d !== date));
  };

  const closeBatchDatePicker = () => {
    setShowBatchDatePicker(false);
    setBatchSelectedDates([]);
  };

  const clearBatchSelectedDates = () => {
    setBatchSelectedDates([]);
  };

  const handleParseBatchDates = (textarea) => {
    if (!textarea || !textarea.value) return;

    const dates = parseDateString(textarea.value);
    if (dates.length > 0) {
      setBatchSelectedDates((current) => [...new Set([...current, ...dates])].sort());
      textarea.value = '';
      showSuccessMessage(`已添加 ${dates.length} 個日期`);
    } else {
      showErrorMessage('無法解析日期，請檢查格式');
    }
  };

  const handleAddSingleBatchDate = (input) => {
    if (!input || !input.value) return;
    addDateToBatch(input.value);
    input.value = '';
  };

  const handleExport = async (eventId) => {
    try {
      if (!canExportReservations) {
        showErrorMessage('您沒有匯出預約名單權限');
        return;
      }
      const blob = await exportEventReservations(token, eventId);
      downloadBlob(blob, `活動預約清單_${eventId}.xlsx`);
    } catch (error) {
      showErrorMessage('匯出失敗：' + error.message);
    }
  };

  const handleEditEvent = (event) => {
    const capacityFields = mapEventToCapacityFields(event);
    setEditFields({
      eventId: event.eventId,
      name: event.name,
      eventType: event.eventType,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location || '',
      notes: event.notes || DEFAULT_EVENT_NOTES,
      ...capacityFields,
      customEventType: event.eventType === '其他' ? event.customEventType || '' : '',
      customReservationRule: event.customReservationRule || '',
    });
    setEditModalShow(true);
    setEditError('');
  };

  const handleEditSubmit = async () => {
    if (!editFields.eventId) return;

    if (!canManageEvents) {
      setEditError('您沒有活動管理權限');
      return;
    }

    setEditLoading(true);
    setEditError('');

    let finalEventType = editFields.eventType;
    if (editFields.eventType === '其他') {
      if (!editFields.customReservationRule?.trim()) {
        setEditError('請填寫自定義活動的預約時間規則說明');
        setEditLoading(false);
        return;
      }
      finalEventType = editFields.customEventType || editFields.name;
    }

    const capacityError = validateCapacityFields(editFields, finalEventType);
    if (capacityError) {
      setEditError(capacityError);
      setEditLoading(false);
      return;
    }

    const result = await safeAPICall(async () => updateEvent(token, editFields.eventId, {
      ...editFields,
      eventType: finalEventType,
      customReservationRule: editFields.eventType === '其他' ? editFields.customReservationRule : null,
      location: editFields.location?.trim() || null,
      notes: editFields.notes?.trim() || null,
      ...buildCapacityRequestPayload(editFields, finalEventType),
    }));

    if (result.success) {
      setEditModalShow(false);
      refreshSummary();
      showErrorMessage('活動修改成功！');
    } else {
      setEditError(result.error || '修改活動失敗');
    }

    setEditLoading(false);
  };

  const performDelete = async (eventId) => {
    try {
      await deleteEvent(token, eventId);
      showErrorMessage('活動刪除成功！');
      refreshSummary();
    } catch (err) {
      console.error('刪除活動錯誤:', err);
      showErrorMessage('刪除活動失敗');
    }
  };

  const handleDeleteEvent = async (eventId, eventName) => {
    if (!canManageEvents) {
      showErrorMessage('您沒有活動管理權限');
      return;
    }

    try {
      const eventData = await fetchEventById(token, eventId);

      if (eventData.reserved > 0) {
        setDeleteEventId(eventId);
        setDeleteEventName(eventName);
        setDeletePassword('');
        setDeleteConfirmModalShow(true);
      } else {
        const ok = await confirm({
          title: '確認刪除此活動？',
          description: '此操作無法復原。',
          confirmText: '刪除',
          cancelText: '取消',
          variant: 'danger',
        });
        if (!ok) return;
        await performDelete(eventId);
      }
    } catch (err) {
      console.error('檢查活動錯誤:', err);
      showErrorMessage('檢查活動失敗');
    }
  };

  const handlePasswordConfirmDelete = async () => {
    if (!deletePassword.trim()) {
      showErrorMessage('請輸入管理員密碼');
      return;
    }

    setDeleteLoading(true);
    try {
      await forceDeleteEvent(token, deleteEventId, deletePassword);
      showErrorMessage('活動刪除成功！');
      setDeleteConfirmModalShow(false);
      setDeletePassword('');
      refreshSummary();
    } catch (err) {
      console.error('密碼確認刪除錯誤:', err);
      showErrorMessage('刪除失敗');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExportAll = async () => {
    try {
      if (!canExportReports) {
        showErrorMessage('您沒有匯出總覽報表權限');
        return;
      }
      const blob = await exportReportSummary(token, {
        semester: selectedSemester,
        eventType: selectedEventType,
      });
      downloadBlob(blob, `活動總覽報表_${selectedSemester}_${selectedEventType}.xlsx`);
    } catch (error) {
      showErrorMessage('匯出失敗：' + error.message);
    }
  };

  return {
    ...summaryState,
    addFields,
    setAddFields,
    addLoading,
    addError,
    handleAddEvent,
    editModalShow,
    setEditModalShow,
    editFields,
    setEditFields,
    editLoading,
    editError,
    handleEditEvent,
    handleEditSubmit,
    deleteConfirmModalShow,
    setDeleteConfirmModalShow,
    deleteEventId,
    deleteEventName,
    deletePassword,
    setDeletePassword,
    deleteLoading,
    handleDeleteEvent,
    performDelete,
    handlePasswordConfirmDelete,
    showBatchAddModal,
    setShowBatchAddModal,
    batchEvents,
    setBatchEvents,
    batchAddLoading,
    batchAddError,
    setBatchAddError,
    batchAddResult,
    setBatchAddResult,
    showBatchDatePicker,
    setShowBatchDatePicker,
    batchSelectedDates,
    setBatchSelectedDates,
    handleBatchAddEvents,
    addBatchEventRow,
    removeBatchEventRow,
    updateBatchEvent,
    handleBatchDateSelect,
    applyBatchDates,
    addDateToBatch,
    removeDateFromBatch,
    closeBatchDatePicker,
    clearBatchSelectedDates,
    handleParseBatchDates,
    handleAddSingleBatchDate,
    openBatchAddModal,
    closeBatchAddModal,
    cancelBatchAddModal,
    handleExport,
    handleExportAll,
    parseDateString,
    isEventToday,
  };
}

export function parseDateString(dateString) {
  if (!dateString.trim()) return [];

  const dates = [];
  const parts = dateString.split(/[,\n;]/).map((s) => s.trim()).filter((s) => s);

  for (const part of parts) {
    const rangeMatch = part.match(/(\d{4}-\d{2}-\d{2})\s*(?:到|-|~)\s*(\d{4}-\d{2}-\d{2})/);
    if (rangeMatch) {
      const start = dayjs(rangeMatch[1]);
      const end = dayjs(rangeMatch[2]);
      if ((start.isValid() && end.isValid() && start.isBefore(end)) || start.isSame(end)) {
        let current = start;
        while (current.isBefore(end) || current.isSame(end)) {
          dates.push(current.format('YYYY-MM-DD'));
          current = current.add(1, 'day');
        }
      }
    } else {
      const date = dayjs(part);
      if (date.isValid()) {
        dates.push(date.format('YYYY-MM-DD'));
      }
    }
  }

  return [...new Set(dates)].sort();
}

export function isEventToday(dateStr) {
  if (!dateStr) return false;
  return dayjs().format('YYYY-MM-DD') === dateStr;
}
