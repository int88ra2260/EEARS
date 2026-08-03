import { fetchClient } from '../utils/fetchClient';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchWeeklyMedia(token, { page = 1, limit = 40, kind } = {}) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (kind) qs.set('kind', kind);
  const res = await fetchClient(`/api/admin/weekly-media?${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('無法載入媒體庫');
  return res.json();
}

export async function uploadWeeklyMedia(token, file, alt = '') {
  const form = new FormData();
  form.append('file', file);
  if (alt) form.append('alt', alt);
  const res = await fetchClient('/api/admin/weekly-media', {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '上傳失敗');
  return data;
}

export async function deleteWeeklyMedia(token, id) {
  const res = await fetchClient(`/api/admin/weekly-media/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('刪除失敗');
  return res.json();
}
