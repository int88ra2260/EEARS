import { fetchClient } from '../utils/fetchClient';
import {
  DEFAULT_EVENT_TYPES,
  getEventTypeDisplayName as fallbackDisplayName,
} from '../constants/eventTypeCatalog';

const API = '/api';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleErr(res, fallback) {
  let message = fallback;
  try {
    const body = await res.json();
    message = body.error || body.message || fallback;
  } catch (_) {
    // ignore
  }
  const err = new Error(message);
  err.status = res.status;
  throw err;
}

/** @type {{ list: object[], at: number } | null} */
let publicCache = null;
const TTL = 30_000;

export function invalidateEventTypeClientCache() {
  publicCache = null;
}

/** 同步讀取公開目錄快取（可能為 null） */
export function getCachedPublicEventTypes() {
  return publicCache?.list || null;
}

export async function fetchPublicEventTypes({ force = false } = {}) {
  if (!force && publicCache && Date.now() - publicCache.at < TTL) {
    return publicCache.list;
  }
  try {
    const res = await fetchClient(`${API}/event-types`);
    if (!res.ok) throw new Error('load failed');
    const body = await res.json();
    const list = Array.isArray(body.data) ? body.data : [];
    publicCache = { list, at: Date.now() };
    return list;
  } catch (_) {
    const fallback = DEFAULT_EVENT_TYPES.filter((r) => r.isActive).map((r) => ({ ...r }));
    if (!publicCache) publicCache = { list: fallback, at: Date.now() };
    return fallback;
  }
}

export async function fetchAdminEventTypes(token) {
  const res = await fetchClient(`${API}/admin/event-types`, {
    headers: authHeaders(token),
  });
  if (!res.ok) await handleErr(res, '載入活動類型失敗');
  const body = await res.json();
  return Array.isArray(body.data) ? body.data : [];
}

export async function createAdminEventType(token, payload) {
  const res = await fetchClient(`${API}/admin/event-types`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await handleErr(res, '新增活動類型失敗');
  invalidateEventTypeClientCache();
  const body = await res.json();
  return body.data;
}

export async function updateAdminEventType(token, code, payload) {
  const res = await fetchClient(`${API}/admin/event-types/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await handleErr(res, '更新活動類型失敗');
  invalidateEventTypeClientCache();
  const body = await res.json();
  return body.data;
}

export async function setAdminEventTypeActive(token, code, isActive) {
  const res = await fetchClient(`${API}/admin/event-types/${encodeURIComponent(code)}/active`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) await handleErr(res, '更新啟用狀態失敗');
  invalidateEventTypeClientCache();
  const body = await res.json();
  return body.data;
}

export async function deleteAdminEventType(token, code) {
  const res = await fetchClient(`${API}/admin/event-types/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) await handleErr(res, '刪除活動類型失敗');
  invalidateEventTypeClientCache();
  const body = await res.json();
  return body.data;
}

export function resolveTypeConfigFromList(list, raw) {
  const key = String(raw || '').trim();
  if (!key) return null;
  const lower = key.toLowerCase();
  const rows = Array.isArray(list) ? list : [];
  return (
    rows.find((r) => r.code === key)
    || rows.find((r) => String(r.displayName).toLowerCase() === lower)
    || rows.find((r) => String(r.slug).toLowerCase() === lower)
    || rows.find((r) => String(r.abbreviation || '').toLowerCase() === lower)
    || rows.find((r) => (r.legacyAliases || []).some((a) => String(a).toLowerCase() === lower))
    || null
  );
}

/** 優先 API 快取／傳入清單，再退回 seed 顯示名 */
export function resolveEventTypeDisplayName(raw, list) {
  const catalog = list || getCachedPublicEventTypes() || [];
  const hit = resolveTypeConfigFromList(catalog, raw);
  if (hit?.displayName) return hit.displayName;
  return fallbackDisplayName(raw);
}

export function resolveEventTypeCode(raw, list) {
  const catalog = list || getCachedPublicEventTypes() || [];
  const hit = resolveTypeConfigFromList(catalog, raw);
  if (hit?.code) return hit.code;
  const key = String(raw || '').trim();
  return key || null;
}

export function eventTypesEqual(a, b, list) {
  const ca = resolveEventTypeCode(a, list);
  const cb = resolveEventTypeCode(b, list);
  if (!ca || !cb) return false;
  return ca === cb;
}

/**
 * 表單／篩選用選項：以 API 目錄為準（啟用中）。
 * @param {Array<{ code: string, displayName: string, isActive?: boolean }>} list
 */
export function buildEventTypeSelectOptions(list = [], {
  includeOther = false,
  activeOnly = true,
  includeAll = false,
} = {}) {
  const rows = Array.isArray(list) ? list : [];
  const filtered = activeOnly ? rows.filter((r) => r && r.isActive !== false) : rows;
  const opts = filtered
    .slice()
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    .map((r) => ({
      value: r.code,
      label: r.displayName || r.code,
      slug: r.slug,
    }));
  if (includeAll) opts.unshift({ value: 'all', label: '全部類型' });
  if (includeOther) opts.push({ value: '其他', label: '其他' });
  return opts;
}
