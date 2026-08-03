/**
 * 管理後台總覽儀表板 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';
import { fetchAdminAnnouncements } from './announcementAdminApi';
import { fetchBlacklistRecords } from './blacklistAdminApi';

function adminAuthHeaders(token, userRole) {
  return {
    Authorization: `Bearer ${token}`,
    'X-User-Role': userRole || 'worker',
  };
}

function getRequestId(res) {
  return res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
}

async function fetchJsonOrThrow(url, options, fallback = 'API 請求失敗') {
  const res = await fetchClient(url, options);
  const requestId = getRequestId(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(fallback);
    err.requestId = requestId;
    err.errorBrief = fallback;
    err.status = res.status;
    throw err;
  }
  return { data, requestId };
}

export async function fetchDashboardReservations(token, userRole) {
  const { data } = await fetchJsonOrThrow('/api/reservations', {
    headers: adminAuthHeaders(token, userRole),
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchDashboardEvents(token, userRole) {
  const { data } = await fetchJsonOrThrow('/api/events', {
    headers: adminAuthHeaders(token, userRole),
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchEnglishTestPendingCount(token, userRole) {
  const { data } = await fetchJsonOrThrow(
    '/api/english-test/registrations/metrics/pending-count',
    { headers: adminAuthHeaders(token, userRole) },
  );
  return typeof data?.count === 'number' ? data.count : 0;
}

export async function fetchDraftAnnouncementsTotal(token) {
  const j = await fetchAdminAnnouncements(token, { page: 1, limit: 1, status: 'draft' });
  return (
    (typeof j?.pagination?.total === 'number' ? j.pagination.total : null) ??
    (typeof j?.total === 'number' ? j.total : null) ??
    (Array.isArray(j?.items) ? j.items.length : 0)
  );
}

export async function fetchBlacklistBySemester(token, userRole, semester) {
  return fetchBlacklistRecords(token, userRole, { semester });
}

export async function fetchSystemHealth() {
  const res = await fetchClient('/api/health');
  const requestId = getRequestId(res);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error || json?.message || '健康檢查失敗');
    err.requestId = requestId;
    err.status = res.status;
    throw err;
  }
  return { health: json, requestId };
}

/** AdminDashboard.jsx legacy：列表端點取 pending 總數 */
export async function fetchLegacyEnglishPendingCount(token, userRole) {
  const { data } = await fetchJsonOrThrow(
    '/api/english-test/registrations?page=1&limit=1&status=pending',
    { headers: adminAuthHeaders(token, userRole) },
  );
  if (typeof data?.total === 'number') return data.total;
  if (Array.isArray(data?.data)) return data.data.length;
  return null;
}

/** AdminDashboard.jsx legacy：草稿列表筆數（limit=20） */
export async function fetchLegacyDraftAnnouncementCount(token) {
  const j = await fetchAdminAnnouncements(token, { page: 1, limit: 20, status: 'draft' });
  return Array.isArray(j?.items) ? j.items.length : null;
}

/** AdminDashboard.jsx legacy：黑名單（無學期篩選） */
export async function fetchBlacklistAll(token, userRole) {
  return fetchBlacklistRecords(token, userRole, { semester: 'all' });
}
