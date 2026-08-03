/**
 * 活動預約表單狀態與提交流程，供 EventBookingModal / EventDetail 使用
 * 保留既有驗證、黑名單檢查、POST、409 問卷導向、錯誤處理與成功回調
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateReservationData } from '../utils/validators';
import { handleAPIError } from '../utils/errorHandler';
import { createReservation, checkBlacklist, joinWaitlist } from '../services/eventBookingService';
import { loadStudentTrio, saveStudentTrio } from '../utils/studentTrioStorage';
import {
  buildSurveyRedirectPath,
  savePendingReservation,
  savePendingWaitlist,
  SURVEY_GATE_REDIRECT_DELAY_MS,
} from '../utils/pendingReservationFlow';

const RATE_LIMIT_MS = 5000;
const RATE_LIMIT_MAX = 3;
const SURVEY_ID_MAPPING = {
  survey_1: 'english_table_feedback_114_1',
  survey_2: 'english_club_feedback_114_1',
  english_table_feedback_114_1: 'english_table_feedback_114_1',
  english_club_feedback_114_1: 'english_club_feedback_114_1',
};

export default function useEventBooking() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  useEffect(() => {
    const saved = loadStudentTrio();
    if (saved.studentId) setStudentId((v) => (v.trim() ? v : saved.studentId));
    if (saved.studentName) setStudentName((v) => (v.trim() ? v : saved.studentName));
    if (saved.studentEmail) setStudentEmail((v) => (v.trim() ? v : saved.studentEmail));
  }, []);
  const [msg, setMsg] = useState('');
  const [variant, setVariant] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [showSurvey, setShowSurvey] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [blacklistInfo, setBlacklistInfo] = useState(null);
  const [violationWarning, setViolationWarning] = useState(null);
  const [successMeta, setSuccessMeta] = useState(null);
  const [waitlistSuccessMeta, setWaitlistSuccessMeta] = useState(null);

  const handleJoinWaitlist = useCallback(async (event, onSuccess, { onSurveyRequired } = {}) => {
    if (!event) return;
    if (isSubmitting) return;

    const now = Date.now();
    const timeDiff = now - lastSubmitTime;
    if (timeDiff < RATE_LIMIT_MS && submitCount >= RATE_LIMIT_MAX) {
      setVariant('warning');
      setMsg('提交過於頻繁，請稍後再試');
      return;
    }
    if (timeDiff >= RATE_LIMIT_MS) {
      setSubmitCount(1);
    } else {
      setSubmitCount((prev) => prev + 1);
    }
    setLastSubmitTime(now);

    const validationResult = validateReservationData({
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      studentEmail: studentEmail.trim(),
    });
    if (!validationResult.isValid) {
      setVariant('danger');
      setMsg(validationResult.errors.join(', '));
      return;
    }

    setIsSubmitting(true);
    setMsg('');
    setVariant('');
    setWaitlistSuccessMeta(null);

    saveStudentTrio({
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      studentEmail: studentEmail.trim(),
    });

    try {
      const blacklistRes = await checkBlacklist(studentId);
      if (blacklistRes.ok && blacklistRes.data) {
        const d = blacklistRes.data;
        if (d.isBlacklisted && d.blacklistUntil) {
          const untilDate = new Date(d.blacklistUntil);
          if (untilDate > new Date()) {
            setBlacklistInfo({
              isBlacklisted: true,
              blacklistUntil: d.blacklistUntil,
              violationCount: d.violationCount || 0,
            });
            setShowBlacklistModal(true);
            setIsSubmitting(false);
            return;
          }
        }
        if (d.violationCount === 1) {
          setViolationWarning({
            violationCount: 1,
            message: '您目前已有 1 次違規紀錄，若再累積 1 次違規，將被列入黑名單兩週。',
          });
        }
      }

      const res = await joinWaitlist({
        eventId: event.id,
        studentId: studentId.trim(),
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim(),
      });

      if (!res.ok) {
        const data = res.data || {};
        if (
          res.status === 409 &&
          data.code &&
          (data.code === 'ENGLISH_TABLE_SURVEY_REQUIRED' ||
            data.code === 'ENGLISH_CLUB_SURVEY_REQUIRED' ||
            data.code === 'SURVEY_REQUIRED')
        ) {
          setVariant('info');
          setMsg('此活動需先完成問卷。系統即將帶您前往問卷頁，完成後會自動恢復候補流程。');
          if (typeof onSurveyRequired === 'function') onSurveyRequired();

          let finalSurveyId = data.surveyId;
          if (!finalSurveyId) {
            if (event.eventType === 'English Table') finalSurveyId = 'english_table_feedback_114_1';
            else if (event.eventType === 'English Club') finalSurveyId = 'english_club_feedback_114_1';
          }
          const mappedSurveyId = SURVEY_ID_MAPPING[finalSurveyId] || finalSurveyId;
          const eventType = event.eventType || 'English Table';
          const surveyPath = buildSurveyRedirectPath(mappedSurveyId, {
            eventId: event.id,
            eventType,
          });

          savePendingWaitlist({
            eventId: event.id,
            eventName: event.name,
            eventType,
            eventDate: event.date,
            startTime: event.startTime,
            endTime: event.endTime,
            studentId: studentId.trim(),
            studentName: studentName.trim(),
            studentEmail: studentEmail.trim(),
            redirectUrl: surveyPath,
            surveyId: mappedSurveyId,
          });
          setTimeout(() => navigate(surveyPath), SURVEY_GATE_REDIRECT_DELAY_MS);
          return;
        }
        if (data.errorCode === 'ALREADY_WAITLISTED') {
          setVariant('warning');
          setMsg(
            data.position != null
              ? `你已在候補名單中（目前順位：第 ${data.position} 位）`
              : '你已在候補名單中'
          );
          return;
        }
        try {
          const errorMessage = handleAPIError(null, { status: res.status, data, requestId: res.requestId });
          setVariant('danger');
          setMsg(errorMessage?.display || data?.message || data?.error || '加入候補失敗，請稍後再試');
        } catch {
          setVariant('danger');
          setMsg(data?.message || data?.error || `加入候補失敗 (HTTP ${res.status})`);
        }
        return;
      }

      const pos = res.data?.position;
      setVariant('success');
      setMsg(res.data?.message || '已加入候補名單');
      saveStudentTrio({
        studentId: studentId.trim(),
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim(),
      });
      setWaitlistSuccessMeta({
        position: pos,
        studentEmail: studentEmail.trim(),
      });
      setTimeout(() => {
        if (typeof onSuccess === 'function') onSuccess();
      }, 400);
    } catch (error) {
      const errorMessage = handleAPIError(error);
      setVariant('danger');
      setMsg(errorMessage.display);
    } finally {
      setIsSubmitting(false);
    }
  }, [studentId, studentName, studentEmail, isSubmitting, submitCount, lastSubmitTime, navigate]);

  const handleReserve = useCallback(async (event, onSuccess, { onSurveyRequired } = {}) => {
    if (!event) return;
    if (isSubmitting) return;

    const now = Date.now();
    const timeDiff = now - lastSubmitTime;
    if (timeDiff < RATE_LIMIT_MS && submitCount >= RATE_LIMIT_MAX) {
      setVariant('warning');
      setMsg('提交過於頻繁，請稍後再試');
      return;
    }
    if (timeDiff >= RATE_LIMIT_MS) {
      setSubmitCount(1);
    } else {
      setSubmitCount((prev) => prev + 1);
    }
    setLastSubmitTime(now);

    const validationResult = validateReservationData({
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      studentEmail: studentEmail.trim(),
    });
    if (!validationResult.isValid) {
      setVariant('danger');
      setMsg(validationResult.errors.join(', '));
      return;
    }
    if (studentId.length > 20) {
      setVariant('danger');
      setMsg('學號長度不能超過20個字符 (Student ID too long)');
      return;
    }
    if (studentName.length > 100) {
      setVariant('danger');
      setMsg('姓名長度不能超過100個字符 (Name too long)');
      return;
    }
    if (studentEmail.length > 255) {
      setVariant('danger');
      setMsg('Email長度不能超過255個字符 (Email too long)');
      return;
    }

    setIsSubmitting(true);
    setMsg('');
    setVariant('');

    saveStudentTrio({
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      studentEmail: studentEmail.trim(),
    });

    try {
      const blacklistRes = await checkBlacklist(studentId);
      if (blacklistRes.ok && blacklistRes.data) {
        const d = blacklistRes.data;
        if (d.isBlacklisted && d.blacklistUntil) {
          const untilDate = new Date(d.blacklistUntil);
          if (untilDate > new Date()) {
            setBlacklistInfo({
              isBlacklisted: true,
              blacklistUntil: d.blacklistUntil,
              violationCount: d.violationCount || 0,
            });
            setShowBlacklistModal(true);
            setIsSubmitting(false);
            return;
          }
        }
        if (d.violationCount === 1) {
          setViolationWarning({
            violationCount: 1,
            message: '您目前已有 1 次違規紀錄，若再累積 1 次違規，將被列入黑名單兩週。',
          });
        }
      }

      const res = await createReservation({
        eventId: event.id,
        studentId: studentId.trim(),
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim(),
        eventType: event.eventType || 'English Table',
      });

        if (!res.ok) {
        const data = res.data || {};
        if (
          res.status === 409 &&
          data.code &&
          (data.code === 'ENGLISH_TABLE_SURVEY_REQUIRED' ||
            data.code === 'ENGLISH_CLUB_SURVEY_REQUIRED' ||
            data.code === 'SURVEY_REQUIRED')
        ) {
          // 先讓 UI 能理解「需要問卷」的語意，再執行既有 redirect/pendingReservation 行為
          setVariant('info');
          setMsg('此活動需先完成問卷。系統即將帶您前往問卷頁，完成後會自動恢復原預約流程。');
          if (typeof onSurveyRequired === 'function') onSurveyRequired();

          let finalSurveyId = data.surveyId;
          if (!finalSurveyId) {
            if (event.eventType === 'English Table') finalSurveyId = 'english_table_feedback_114_1';
            else if (event.eventType === 'English Club') finalSurveyId = 'english_club_feedback_114_1';
          }
          const mappedSurveyId = SURVEY_ID_MAPPING[finalSurveyId] || finalSurveyId;
          const eventType = event.eventType || 'English Table';
          const surveyPath = buildSurveyRedirectPath(mappedSurveyId, {
            eventId: event.id,
            eventType,
          });

          savePendingReservation({
            eventId: event.id,
            eventName: event.name,
            eventType,
            eventDate: event.date,
            startTime: event.startTime,
            endTime: event.endTime,
            studentId: studentId.trim(),
            studentName: studentName.trim(),
            studentEmail: studentEmail.trim(),
            redirectUrl: surveyPath,
            surveyId: mappedSurveyId,
          });
          setTimeout(() => navigate(surveyPath), SURVEY_GATE_REDIRECT_DELAY_MS);
          return;
        }
        if (res.status === 429) {
          setVariant('warning');
          setMsg(data.error || '請求過於頻繁，請稍後再試 (Too many requests, please wait)');
          if (data.retryAfter) {
            setTimeout(() => {
              setMsg('');
              setVariant('');
            }, data.retryAfter * 1000);
          }
          return;
        }
        if (res.status === 503) {
          setVariant('warning');
          setMsg('系統繁忙，請稍後再試 (System busy, please try again later)');
          return;
        }
        try {
          const errorMessage = handleAPIError(null, { status: res.status, data: data, requestId: res.requestId });
          setVariant('danger');
          setMsg(errorMessage?.display || data?.error || data?.message || '預約失敗，請稍後再試');
        } catch {
          setVariant('danger');
          setMsg(data?.error || data?.message || `預約失敗 (HTTP ${res.status})`);
        }
        return;
      }

      saveStudentTrio({
        studentId: studentId.trim(),
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim(),
      });
      setVariant('success');
      setMsg('預約成功！(Reservation successful!)');
      setSuccessMeta({
        reservationId: res.data?.reservationId || res.data?.reservation?.id || null,
        bookingCode: res.data?.bookingCode || null,
        studentEmail: res.data?.studentEmail || studentEmail.trim(),
        createdAt: res.data?.createdAt || res.data?.reservation?.createdAt || new Date().toISOString(),
      });
      setTimeout(() => {
        if (typeof onSuccess === 'function') onSuccess();
      }, 1500);
    } catch (error) {
      const errorMessage = handleAPIError(error);
      setVariant('danger');
      setMsg(errorMessage.display);
    } finally {
      setIsSubmitting(false);
    }
  }, [studentId, studentName, studentEmail, isSubmitting, submitCount, lastSubmitTime, navigate]);

  const handleSurveyClose = useCallback((onClose) => {
    setShowSurvey(false);
    if (typeof onClose === 'function') onClose();
  }, []);

  const handleSurveyComplete = useCallback((event, onSuccess) => {
    handleReserve(event, onSuccess);
  }, [handleReserve]);

  const resetBookingModalState = useCallback(() => {
    setSuccessMeta(null);
    setWaitlistSuccessMeta(null);
    setMsg('');
    setVariant('');
  }, []);

  return {
    form: {
      studentId,
      studentName,
      studentEmail,
      setStudentId,
      setStudentName,
      setStudentEmail,
    },
    message: { msg, variant },
    isSubmitting,
    violationWarning,
    blacklist: { showBlacklistModal, setShowBlacklistModal, blacklistInfo },
    survey: { showSurvey, setShowSurvey },
    successMeta,
    waitlistSuccessMeta,
    handleReserve,
    handleJoinWaitlist,
    handleSurveyClose,
    handleSurveyComplete,
    resetBookingModalState,
  };
}
