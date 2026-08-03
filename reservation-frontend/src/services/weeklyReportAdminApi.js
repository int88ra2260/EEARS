import { fetchClient } from '../utils/fetchClient';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchAdminWeeklyReports(token, { page = 1, limit = 20, status } = {}) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set('status', status);
  const res = await fetchClient(`/api/admin/weekly-reports?${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('無法載入週報列表');
  return res.json();
}

export async function fetchAdminWeeklyReport(token, id) {
  const res = await fetchClient(`/api/admin/weekly-reports/${id}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('無法載入週報');
  return res.json();
}

export async function createAdminWeeklyReport(token, body) {
  const res = await fetchClient('/api/admin/weekly-reports', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '建立失敗');
  return data;
}

export async function updateAdminWeeklyReport(token, id, body) {
  const res = await fetchClient(`/api/admin/weekly-reports/${id}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '更新失敗');
  return data;
}

export async function deleteAdminWeeklyReport(token, id) {
  const res = await fetchClient(`/api/admin/weekly-reports/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('刪除失敗');
  return res.json();
}

export async function duplicateAdminWeeklyReport(token, id, body = {}) {
  const res = await fetchClient(`/api/admin/weekly-reports/${id}/duplicate`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '複製失敗');
  return data;
}

export async function createWeeklyPreviewToken(token, id, ttlSec) {
  const res = await fetchClient(`/api/admin/weekly-reports/${id}/preview-token`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(ttlSec ? { ttlSec } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '無法產生預覽連結');
  return data;
}

export async function fetchAdminWeeklyAnalytics(token, id) {
  const res = await fetchClient(`/api/admin/weekly-reports/${id}/analytics`, {
    headers: authHeaders(token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '無法載入互動統計');
  return data;
}
