/**
 * 問卷 Gate 後恢復預約：sessionStorage 為主，URL query 為備援（不含 PII）
 */

import { loadStudentTrio } from './studentTrioStorage';

const PENDING_KEY = 'pendingReservation';
const PENDING_WAITLIST_KEY = 'pendingWaitlist';
const SURVEY_REDIRECT_DELAY_MS = 800;

/** 導向問卷頁前的最短提示時間（讓使用者看見 info 訊息） */
export const SURVEY_GATE_REDIRECT_DELAY_MS = SURVEY_REDIRECT_DELAY_MS;

/**
 * @param {string} surveyKey
 * @param {{ eventId?: string|number, eventType?: string }} opts
 */
export function buildSurveyRedirectPath(surveyKey, { eventId, eventType } = {}) {
  const params = new URLSearchParams();
  params.set('pending', '1');
  if (eventId != null && eventId !== '') params.set('eventId', String(eventId));
  if (surveyKey) params.set('surveyKey', surveyKey);
  if (eventType) params.set('eventType', eventType);
  const qs = params.toString();
  return `/survey/${surveyKey}${qs ? `?${qs}` : ''}`;
}

export function savePendingReservation(payload) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
}

export function savePendingWaitlist(payload) {
  sessionStorage.setItem(PENDING_WAITLIST_KEY, JSON.stringify(payload));
}

/**
 * sessionStorage 遺失時，由 URL query + localStorage trio 重建 pending（不含姓名 email 於 URL）
 */
export function restorePendingReservationFromQuery(searchParams, surveyIdFromRoute) {
  if (sessionStorage.getItem(PENDING_KEY)) return false;

  const pending = searchParams.get('pending');
  if (pending !== '1') return false;

  const eventId = searchParams.get('eventId');
  const surveyKey = searchParams.get('surveyKey') || surveyIdFromRoute;
  const eventType = searchParams.get('eventType') || 'English Table';
  const trio = loadStudentTrio();

  if (!eventId || !trio.studentId?.trim()) return false;

  const redirectPath = buildSurveyRedirectPath(surveyKey, { eventId, eventType });
  savePendingReservation({
    eventId,
    surveyId: surveyKey,
    eventType,
    studentId: trio.studentId.trim(),
    studentName: trio.studentName.trim(),
    studentEmail: trio.studentEmail.trim(),
    redirectUrl: redirectPath,
    eventName: '',
    recoveredFromQuery: true,
  });
  return true;
}

export function buildEventsRecoveredPath(eventId) {
  const params = new URLSearchParams();
  params.set('recovered', '1');
  if (eventId != null && eventId !== '') params.set('eventId', String(eventId));
  return `/events?${params.toString()}`;
}
