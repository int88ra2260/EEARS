/**
 * 預約查詢／取消 API 薄層封裝，不改變既有 contract
 */

import { fetchClient } from '../utils/fetchClient';
import { withStudentAuth } from '../utils/studentSession';

const API_PUBLIC = '/api/reservations/public';
const API_RESERVATION = '/api/reservations';

/**
 * 查詢預約紀錄（公開，不需登入）
 * @param {{ studentId: string, studentName: string, studentEmail: string }} params
 * @returns {Promise<Array>} 預約紀錄陣列，非 2xx 時 throw
 */
export async function searchReservations(params) {
  const qs = new URLSearchParams({
    studentId: params.studentId || '',
    studentName: params.studentName || '',
    studentEmail: params.studentEmail || '',
  });
  const res = await fetchClient(`${API_PUBLIC}?${qs}`, withStudentAuth());
  const data = await res.json();
  const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
  if (!res.ok) {
    const msg = data?.error || data?.message || '查詢失敗';
    const err = new Error(msg);
    err.requestId = requestId;
    err.status = res.status;
    if (requestId) err.message = `${msg}（錯誤識別碼：${requestId}）`;
    throw err;
  }
  // 後端 genericLookupResponse：{ success, found, message, data: [...] }
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

/**
 * 取消自己的預約。身分以登入 session 為準，不必再帶取消驗證碼。
 * @param {number|string} reservationId
 */
export async function cancelReservation(reservationId) {
  const res = await fetchClient(`${API_RESERVATION}/${reservationId}/cancel-public`, withStudentAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }));
  const data = await res.json().catch(() => ({}));
  const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
  if (!res.ok) {
    const msg = data?.error || data?.message || '取消預約失敗';
    const err = new Error(msg);
    err.requestId = requestId;
    err.status = res.status;
    if (requestId) err.message = `${msg}（錯誤識別碼：${requestId}）`;
    throw err;
  }
  if (!data.found) {
    const msg = '取消未完成。請確認這是你的預約，且仍在該活動的取消期限內。';
    const err = new Error(msg);
    err.requestId = requestId;
    err.status = res.status;
    if (requestId) err.message = `${msg}（錯誤識別碼：${requestId}）`;
    throw err;
  }
  return data;
}
