/**
 * 前台公告 API（與後端 GET /api/announcements 契約一致）
 * 統一處理非 JSON 回應，避免 SPA fallback 回傳 HTML 時 JSON.parse 崩潰。
 */

import { fetchClient } from '../utils/fetchClient';
import { getStudentToken } from '../utils/studentSession';

function publicAnnouncementHeaders() {
  let token = '';
  try {
    token = getStudentToken() || localStorage.getItem('token') || '';
  } catch (error) {
    token = '';
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readBodyPreview(res) {
  const text = await res.text();
  return text.trim().slice(0, 160);
}

export async function parseJsonResponse(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    const preview = await readBodyPreview(res);
    throw new Error(
      preview ? `非 JSON 回應：${preview}` : '伺服器回傳非 JSON（可能為 HTML 或連線錯誤）'
    );
  }
  return res.json();
}

/**
 * @param {{ limit?: number, page?: number, keyword?: string, q?: string, category?: string, tag?: string, pinnedFirst?: boolean|string }} params
 * @returns {Promise<{ items: Array, pagination: object, filters?: object }>}
 */
export async function fetchPublicAnnouncements(params = {}) {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.page != null) q.set('page', String(params.page));
  if (params.keyword) q.set('keyword', params.keyword);
  if (params.q) q.set('q', params.q);
  if (params.category) q.set('category', params.category);
  if (params.tag) q.set('tag', params.tag);
  if (params.pinnedFirst === false || params.pinnedFirst === 'false') q.set('pinnedFirst', 'false');
  const url = `/api/announcements${q.toString() ? `?${q}` : ''}`;
  const res = await fetchClient(url, { headers: publicAnnouncementHeaders() });

  if (!res.ok) {
    const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
    let msg = `HTTP ${res.status}`;
    try {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) {
        const j = await res.json();
        if (j && j.error) msg = j.error;
      } else {
        const preview = await readBodyPreview(res);
        if (preview) msg = preview;
      }
    } catch (_) {
      /* ignore */
    }
    const err = new Error(msg);
    err.requestId = requestId;
    err.status = res.status;
    if (requestId) err.message = `${msg}（錯誤識別碼：${requestId}）`;
    throw err;
  }

  return parseJsonResponse(res);
}

/**
 * 單筆詳情：參數可為數字 id 或 slug（與後端 :idOrSlug 一致）
 * @param {string|number} idOrSlug
 */
export async function fetchPublicAnnouncement(idOrSlug) {
  const res = await fetchClient(`/api/announcements/${encodeURIComponent(idOrSlug)}`, {
    headers: publicAnnouncementHeaders(),
  });

  if (res.status === 404) {
    const err = new Error('Not found');
    err.requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
    err.status = res.status;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (!res.ok) {
    const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
    let msg = `HTTP ${res.status}`;
    try {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) {
        const j = await res.json();
        if (j && j.error) msg = j.error;
      } else {
        const preview = await readBodyPreview(res);
        if (preview) msg = preview;
      }
    } catch (_) {
      /* ignore */
    }
    const err = new Error(msg);
    err.requestId = requestId;
    err.status = res.status;
    if (requestId) err.message = `${msg}（錯誤識別碼：${requestId}）`;
    throw err;
  }

  return parseJsonResponse(res);
}

export async function fetchAnnouncementPreview(token) {
  const res = await fetchClient(`/api/announcements/preview/${encodeURIComponent(token)}`);
  if (res.status === 404) {
    const err = new Error('Not found');
    err.status = res.status;
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return parseJsonResponse(res);
}

/** 舊名相容 */
export const fetchPublicAnnouncementById = fetchPublicAnnouncement;

/** 列表／卡片連結：優先 slug（SEO），無則 id */
export function announcementDetailPath(item) {
  const seg = item && (item.slug != null && item.slug !== '' ? item.slug : item.id);
  if (seg === undefined || seg === null) return '/announcements';
  return `/announcements/${encodeURIComponent(String(seg))}`;
}

/** 首頁預覽摘要字數上限（避免版面被長文撐開） */
export function truncateAnnouncementPreview(text, maxLen = 80) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

/** 將 API 欄位整理成元件慣用欄位（date = 發布日） */
export function normalizeAnnouncementItem(raw) {
  if (!raw) return null;
  const cover = raw.coverImageUrl || raw.coverImage || null;
  return {
    ...raw,
    date: raw.date || raw.publishedAt,
    coverImage: cover,
    coverImageUrl: cover,
  };
}
