/**
 * 活動相關 API 薄層封裝，不改變既有 API contract
 * 供 EventList、AdminHome 或相關元件使用，便於測試與後續抽換
 */

import dayjs from 'dayjs';
import { fetchClient } from '../utils/fetchClient';

const API_EVENTS = '/api/events';
const API_REPORTS = '/api/reports';

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

/**
 * 取得活動列表（僅未來場次，與原 EventList 行為一致）
 * @returns {Promise<Array>} 活動陣列，失敗時 throw
 */
export async function fetchEvents() {
  const response = await fetchClient(API_EVENTS);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error || errorData.message || '載入活動失敗');
    error.response = { status: response.status, data: errorData };
    throw error;
  }
  const data = await response.json();
  const today = dayjs().startOf('day');
  const upcoming = data.filter((evt) =>
    dayjs(evt.date).isSame(today) || dayjs(evt.date).isAfter(today)
  );
  return upcoming;
}

/**
 * 活動總覽報表（AdminHome）
 */
export async function fetchEventSummary(token, {
  semester,
  eventType,
  date,
  dateFrom,
  dateTo,
} = {}) {
  const params = new URLSearchParams();
  if (semester && semester !== 'all') params.append('semester', semester);
  if (eventType && eventType !== 'all') params.append('eventType', eventType);
  const from = dateFrom && String(dateFrom).trim();
  const to = dateTo && String(dateTo).trim();
  if (from || to) {
    if (from) params.append('dateFrom', from);
    if (to) params.append('dateTo', to);
  } else if (date && String(date).trim()) {
    params.append('date', String(date).trim());
  }
  const url = params.toString() ? `${API_REPORTS}/summary?${params}` : `${API_REPORTS}/summary`;
  const res = await fetchClient(url, { headers: authHeaders(token) });
  await throwIfNotOk(res, '載入報表失敗');
  return res.json();
}

export async function createEvent(token, body) {
  const res = await fetchClient(API_EVENTS, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res, '新增活動失敗');
  return res.json();
}

export async function createEventsBatch(token, events) {
  const res = await fetchClient(`${API_EVENTS}/batch`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ events }),
  });
  await throwIfNotOk(res, '批量新增活動失敗');
  return res.json();
}

export async function fetchEventById(token, eventId) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}`, { headers: authHeaders(token) });
  await throwIfNotOk(res, '載入活動失敗');
  return res.json();
}

export async function fetchEventMeta(token, eventId) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}/meta`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || data.message || '載入活動資料失敗');
  }
  return data;
}

export async function updateEvent(token, eventId, body) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res, '修改活動失敗');
  return res.json();
}

export async function deleteEvent(token, eventId) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) throw Object.assign(new Error(data.error || data.message || '刪除活動失敗'), { data, status: res.status });
  return data;
}

export async function forceDeleteEvent(token, eventId, currentPassword) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}/force-delete`, {
    method: 'DELETE',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ currentPassword }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw Object.assign(new Error(data.error || data.message || '刪除活動失敗'), { data, status: res.status });
  return data;
}

export async function exportEventReservations(token, eventId) {
  const res = await fetchClient(`${API_EVENTS}/${eventId}/export`, { headers: authHeaders(token) });
  await throwIfNotOk(res, '匯出失敗');
  return res.blob();
}

export async function exportReportSummary(token, { semester, eventType } = {}) {
  const params = new URLSearchParams();
  if (semester && semester !== 'all') params.append('semester', semester);
  if (eventType && eventType !== 'all') params.append('eventType', eventType);
  const url = params.toString() ? `${API_REPORTS}/export?${params}` : `${API_REPORTS}/export`;
  const res = await fetchClient(url, { headers: authHeaders(token) });
  await throwIfNotOk(res, '匯出失敗');
  return res.blob();
}

export function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
