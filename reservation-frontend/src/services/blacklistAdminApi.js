/**
 * 黑名單／違規管理 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';

function adminAuthHeaders(token, userRole) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-User-Role': userRole || 'worker',
  };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

async function throwIfNotOk(res, fallback = '請求失敗') {
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data.message || data.error || fallback);
    err.status = res.status;
    err.data = data;
    err.response = { status: res.status, data };
    throw err;
  }
  return data;
}

function normalizeBlacklistRecords(payload) {
  if (payload?.success && Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export async function fetchBlacklistRecords(token, userRole, { semester = 'all' } = {}) {
  const params = new URLSearchParams();
  if (semester && semester !== 'all') params.append('semester', semester);
  const qs = params.toString();
  const url = qs ? `/api/blacklist?${qs}` : '/api/blacklist';
  const res = await fetchClient(url, { headers: adminAuthHeaders(token, userRole) });
  const data = await throwIfNotOk(res, '載入黑名單紀錄失敗');
  return normalizeBlacklistRecords(data);
}

export async function recordViolation(token, userRole, { studentId, name, reason }) {
  const res = await fetchClient('/api/blacklist/recordViolation', {
    method: 'POST',
    headers: adminAuthHeaders(token, userRole),
    body: JSON.stringify({ studentId, name, reason }),
  });
  return throwIfNotOk(res, '違規登記失敗');
}

export async function deleteViolation(token, userRole, violationId) {
  const res = await fetchClient(`/api/blacklist/${violationId}`, {
    method: 'DELETE',
    headers: adminAuthHeaders(token, userRole),
  });
  return throwIfNotOk(res, '刪除違規紀錄失敗');
}
