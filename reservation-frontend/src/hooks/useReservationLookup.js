/**
 * 預約查詢與取消流程狀態與 API 封裝
 * 供 MyReservationsPage 與 ReservationSearchModal 共用，保持 API contract 一致
 */
import { useEffect, useState, useCallback } from 'react';
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
  const [cancellationCode, setCancellationCode] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    // 使用者輸入新驗證碼時，清掉先前錯誤訊息
    if (cancelingReservationId && cancellationCode) setCancelError('');
  }, [cancellationCode, cancelingReservationId]);

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

  const startCancel = useCallback((rid) => {
    setCancelingReservationId(rid);
    setCancellationCode('');
    setCancelError('');
  }, []);

  const cancelCancel = useCallback(() => {
    setCancelingReservationId(null);
    setCancellationCode('');
    setCancelError('');
    setCancelLoading(false);
  }, []);

  const mapCancellationErrorToFriendly = (rawMessage) => {
    const msg = String(rawMessage || '');

    if (msg.includes('驗證碼錯誤') || msg.toLowerCase().includes('invalid verification code')) {
      return '驗證碼錯誤，請確認是否使用最新一封 Email 中的取消驗證碼。';
    }
    if (msg.includes('請提供驗證碼') || msg.toLowerCase().includes('please provide the verification code')) {
      return '缺少驗證碼，請輸入 Email 中收到的取消驗證碼後再嘗試。';
    }
    if (msg.includes('活動開始前2小時內不可取消') || msg.toLowerCase().includes('cannot cancel reservation within 2 hours')) {
      return msg; // 保留後端已經具體描述的文字
    }
    return msg || '取消預約失敗，請稍後再試';
  };

  const performCancel = useCallback(async (rid) => {
    if (!cancellationCode || !cancellationCode.trim()) {
      setCancelError('缺少驗證碼，請輸入 Email 中收到的取消驗證碼後再嘗試。');
      if (typeof showToast === 'function') {
        showToast('請輸入驗證碼 (Please enter the verification code)', 'warning');
      } else {
        // fallback：若未傳入 showToast，仍透過統一 toast
        try {
          window.dispatchEvent(new CustomEvent('eears:toast', { detail: { message: '請輸入驗證碼 (Please enter the verification code)', variant: 'warning' } }));
        } catch (_) {}
      }
      return;
    }
    const ok = await confirm({
      title: '確認取消預約？',
      description: '此操作無法復原。',
      confirmText: '確認取消',
      cancelText: '返回',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      setCancelLoading(true);
      setCancelError('');
      const targetRecord = records.find((r) => r.id === rid);
      await cancelReservation(rid, cancellationCode, {
        studentId,
        studentName,
        studentEmail,
      });
      setRecords((prev) => prev.filter((r) => r.id !== rid));
      setCancelingReservationId(null);
      setCancellationCode('');
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
      const rid = err?.requestId || null;
      const friendlyBase = mapCancellationErrorToFriendly(err?.message || err);
      const friendly = rid ? `${friendlyBase}（錯誤識別碼：${rid}）` : friendlyBase;
      setCancelError(friendly);
      if (typeof showToast === 'function') {
        showToast(friendly, 'danger');
      } else {
        try {
          window.dispatchEvent(new CustomEvent('eears:toast', { detail: { message: friendly, variant: 'danger' } }));
        } catch (_) {}
      }
    }
  }, [cancellationCode, showToast, confirm, records, studentId, studentName, studentEmail]);

  return {
    form: { studentId, setStudentId, studentName, setStudentName, studentEmail, setStudentEmail },
    records,
    loading,
    validationErrors,
    searchError,
    cancelingReservationId,
    cancellationCode,
    setCancellationCode,
    cancelError,
    cancelLoading,
    search,
    startCancel,
    cancelCancel,
    performCancel,
  };
}
