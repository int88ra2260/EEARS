/**
 * 活動後台：預約名單、簽到、違規、匯入等管理端 API
 */
import { fetchClient } from '../utils/fetchClient';

const API_EVENTS = '/api/events';
const API_ADMIN_EVENTS = '/api/admin/events';
const API_ADMIN_RESERVATIONS = '/api/admin/reservations';
const API_RESERVATIONS = '/api/reservations';

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

async function throwIfNotOk(res, fallback = '請求失敗') {
  if (res.ok) return;
  const data = await parseJson(res);
  const err = new Error(data.error || data.message || fallback);
  err.status = res.status;
  err.data = data;
  throw err;
}

export async function fetchEventReservations(token, eventId) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}/reservations`, {
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || data.message || '載入預約資料失敗');
  }
  return data;
}

export async function fetchEventViolations(token, eventId) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}/violations`, {
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || data.message || '載入違規紀錄失敗');
  }
  return Array.isArray(data) ? data : [];
}

export async function fetchEventWaitlist(token, eventId) {
  const res = await fetchClient(`${API_ADMIN_EVENTS}/${eventId}/waitlist`, {
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  await throwIfNotOk(res, '載入候補名單失敗');
  return Array.isArray(data.items) ? data.items : [];
}

export async function checkinEventReservation(token, eventId, reservationId) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}/checkin`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ reservationId }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || data.message || '簽到失敗');
  }
  return data;
}

export async function deleteAdminReservation(token, reservationId, { verificationCode } = {}) {
  const body = verificationCode != null && String(verificationCode).trim()
    ? { verificationCode: String(verificationCode).trim() }
    : undefined;
  const res = await fetchClient(`${API_ADMIN_RESERVATIONS}/${reservationId}`, {
    method: 'DELETE',
    headers: authHeaders(token, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || data.message || '刪除預約失敗');
  }
  return data;
}

export async function importEventCardExcel(token, eventId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchClient(`${API_RESERVATIONS}/${eventId}/import-card-excel`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || data.message || '匯入失敗，請稍後再試');
  }
  return data;
}

export async function createEventViolation(token, eventId, body) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}/violations`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || data.message || '登記違規失敗');
  }
  return data;
}

export async function batchMarkEventNoShow(token, eventId) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}/violations/batch-mark-no-show`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || data.message || '批次登記失敗');
  }
  return data;
}

export async function runEventAutoCheck(token, eventId) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}/auto-check`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data.error || data.message || '活動結束檢查失敗');
    err.data = data;
    throw err;
  }
  return data;
}
