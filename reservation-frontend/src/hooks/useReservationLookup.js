/**
 * 預約查詢與取消流程狀態與 API 封裝
 * 供 MyReservationsPage 與 ReservationSearchModal 共用，保持 API contract 一致
 */
import { useState, useCallback } from 'react';
import dayjs from 'dayjs';
import { validateReservationFields } from '../utils/validators';
import { loadReservationIdentity, saveReservationIdentity } from '../utils/studentIdentityStorage';
import { RESERVATION_CUTOFF_HOURS } from '../constants/reservationRules';
import { searchReservations, cancelReservation } from '../services/reservationService';
import useConfirm from '../components/ui/useConfirm';
import { formatBookingCode } from '../utils/bookingCode';
import { handleAPIError } from '../utils/errorHandler';
import { sortReservationsByEventStartDesc } from '../utils/reservationRecordsSort';
import {
  createSimulatedApiError,
  createSimulatedNetworkError,
  createSimulatedTimeoutError,
  getReliabilityFault,
  makeDevRequestId,
} from '../utils/reliabilityFaults';

/** 活動開始前 2 小時內不可取消 */
export function canCancelReservation(record) {
  const now = dayjs();
  const eventStart = dayjs(`${record.date}T${record.startTime}`);
  const cancellationDeadline = eventStart.subtract(RESERVATION_CUTOFF_HOURS, 'hour');
  return now.isBefore(cancellationDeadline);
}

export default function useReservationLookup({ showToast } = {}) {
  const { confirm } = useConfirm();
  const [studentId, setStudentId] = useState(() => loadReservationIdentity()?.studentId || '');
  const [studentName, setStudentName] = useState(() => loadReservationIdentity()?.studentName || '');
  const [studentEmail, setStudentEmail] = useState(() => loadReservationIdentity()?.studentEmail || '');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [searchError, setSearchError] = useState('');
  const [cancelingReservationId, setCancelingReservationId] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const search = useCallback(async () => {
    const trimmed = {
      studentId: String(studentId || '').trim(),
      studentName: String(studentName || '').trim(),
      studentEmail: String(studentEmail || '').trim(),
    };
    const validationResult = validateReservationFields(trimmed);
    if (!validationResult.isValid) {
      setValidationErrors(validationResult.fieldErrors);
      setSearchError('');
      return { ok: false, reason: 'validation' };
    }
    setValidationErrors({});
    setLoading(true);
    setSearchError('');
    try {
      const fault = getReliabilityFault();
      const devRid = makeDevRequestId('DEV');
      if (fault === 'reservationsApi500') {
        throw createSimulatedApiError({ status: 500, requestId: devRid, message: 'test 500' });
      }
      if (fault === 'reservationsNetworkError') {
        throw createSimulatedNetworkError({ requestId: devRid, message: 'test network error' });
      }
      if (fault === 'reservationsTimeout') {
        throw createSimulatedTimeoutError({ requestId: devRid, message: 'test timeout' });
      }

      const list = await searchReservations(trimmed);
      setRecords(sortReservationsByEventStartDesc(list));
      saveReservationIdentity(trimmed);
      return { ok: true };
    } catch (err) {
      console.error('useReservationLookup search error:', err);
      const errMsg = handleAPIError(err);
      setSearchError(errMsg?.display || errMsg?.zh || err.message || '查詢失敗，請稍後再試');
      setRecords([]);
      return { ok: false, reason: 'api' };
    } finally {
      setLoading(false);
    }
  }, [studentId, studentName, studentEmail]);

  const performCancel = useCallback(async (rid) => {
    const ok = await confirm({
      title: '確認取消預約？',
      description: '此操作無法復原。',
      confirmText: '確認取消',
      cancelText: '返回',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      setCancelingReservationId(rid);
      setCancelLoading(true);
      setCancelError('');
      const targetRecord = records.find((r) => r.id === rid);
      await cancelReservation(rid);
      setRecords((prev) => prev.filter((r) => r.id !== rid));
      setCancelingReservationId(null);
      setCancelLoading(false);

      const bookingCode = formatBookingCode(targetRecord?.bookingCode, targetRecord?.reservationId || targetRecord?.id);
      const bookingCodeText = bookingCode && !bookingCode.includes('未提供') ? bookingCode : '';
      const eventName = targetRecord?.eventName || '';
      if (typeof showToast === 'function') {
        const suffix = eventName ? `：${eventName}` : '';
        showToast(`預約已成功取消${suffix}${bookingCodeText ? `（${bookingCodeText}）` : ''}`, 'success');
      } else {
        try {
          window.dispatchEvent(
            new CustomEvent('eears:toast', { detail: { message: `預約已成功取消${eventName ? `：${eventName}` : ''}`, variant: 'success' } })
          );
        } catch (_) {}
      }
    } catch (err) {
      setCancelLoading(false);
      const requestId = err?.requestId || null;
      const friendlyBase = err?.message || '取消預約失敗，請稍後再試';
      const friendly = requestId ? `${friendlyBase}（錯誤識別碼：${requestId}）` : friendlyBase;
      setCancelError(friendly);
      if (typeof showToast === 'function') {
        showToast(friendly, 'danger');
      } else {
        try {
          window.dispatchEvent(new CustomEvent('eears:toast', { detail: { message: friendly, variant: 'danger' } }));
        } catch (_) {}
      }
    }
  }, [showToast, confirm, records]);

  return {
    form: { studentId, setStudentId, studentName, setStudentName, studentEmail, setStudentEmail },
    records,
    loading,
    validationErrors,
    searchError,
    cancelingReservationId,
    cancelError,
    cancelLoading,
    search,
    performCancel,
  };
}
