/**
 * 活動預約建立 API 薄層封裝（POST /api/reservations、黑名單檢查）
 * 不改變既有 contract，回傳 { ok, status, data } 供呼叫端處理 409／429／503
 */

import { fetchClient } from '../utils/fetchClient';

/**
 * 建立預約
 * @param {{ eventId: number, studentId: string, studentName: string, studentEmail: string, eventType: string }} payload
 * @returns {Promise<{ ok: boolean, status: number, data: object|null }>}
 */
export async function createReservation(payload) {
  const res = await fetchClient('/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId: payload.eventId,
      studentId: (payload.studentId || '').trim(),
      studentName: (payload.studentName || '').trim(),
      studentEmail: (payload.studentEmail || '').trim(),
      eventType: payload.eventType || 'English Table',
    }),
  });

  let data = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: '無法解析伺服器響應' };
  }

  const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
  return { ok: res.ok, status: res.status, data, requestId };
}

/**
 * 查詢黑名單狀態（預約前檢查）
 * @param {string} studentId
 * @returns {Promise<{ ok: boolean, data: object }>}
 */
export async function checkBlacklist(studentId) {
  const res = await fetchClient(
    `/api/users/blacklist-status?studentId=${encodeURIComponent((studentId || '').trim())}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } }
  );
  let data = {};
  try {
    if (res.ok) data = await res.json();
  } catch {
    // ignore
  }
  const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
  return { ok: res.ok, data, requestId };
}
