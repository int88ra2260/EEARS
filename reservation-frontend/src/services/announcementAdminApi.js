/**
 * 後台公告 API（需 Authorization Bearer）
 */
import { parseJsonResponse } from './announcementApi';
import { fetchClient } from '../utils/fetchClient';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function handleErr(res) {
  const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
  const j = await res.json().catch(() => ({}));
  const msg = j?.error || j?.message || `HTTP ${res.status}`;
  const err = new Error(msg);
  err.requestId = requestId;
  err.status = res.status;
  if (requestId) err.message = `${msg}（錯誤識別碼：${requestId}）`;
  throw err;
}

export async function fetchAdminAnnouncements(token, params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const res = await fetchClient(`/api/admin/announcements?${q}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function fetchAdminAnnouncement(token, id) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function createAdminAnnouncement(token, body) {
  const res = await fetchClient('/api/admin/announcements', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function updateAdminAnnouncement(token, id, body) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function deleteAdminAnnouncement(token, id) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await handleErr(res);
  return res.json().catch(() => ({}));
}

/** 相容舊版 PATCH */
export async function patchPublish(token, id, isPublished) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}/publish`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ isPublished }),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function postPublishAnnouncement(token, id, body = {}) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function postUnpublishAnnouncement(token, id) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}/unpublish`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function postArchiveAnnouncement(token, id) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function postDuplicateAnnouncement(token, id) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function postBulkAnnouncementAction(token, payload) {
  const res = await fetchClient('/api/admin/announcements/bulk-action', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function fetchAnnouncementRevisions(token, id) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}/revisions`, {
    headers: authHeaders(token),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function postRestoreAnnouncementRevision(token, announcementId, revisionId) {
  const res = await fetchClient(
    `/api/admin/announcements/${encodeURIComponent(announcementId)}/restore-revision/${encodeURIComponent(revisionId)}`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({}),
    }
  );
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function createAnnouncementPreviewToken(token, id) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}/preview-token`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}

export async function patchPin(token, id, isPinned) {
  const res = await fetchClient(`/api/admin/announcements/${encodeURIComponent(id)}/pin`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ isPinned }),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonResponse(res);
}
