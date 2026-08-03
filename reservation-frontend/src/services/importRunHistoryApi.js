/**
 * Import Run History API（P13 只讀列表）
 */
import { fetchClient } from '../utils/fetchClient';

const NON_JSON_MESSAGE = '匯入紀錄 API 回傳非 JSON，請檢查 API 路由或 proxy 設定。';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

function isJsonResponse(res) {
  return (res.headers.get('content-type') || '').toLowerCase().includes('application/json');
}

async function readBodyPreview(res) {
  const text = await res.text();
  return text.trim().slice(0, 200);
}

async function parseJsonBody(res) {
  if (!isJsonResponse(res)) {
    const preview = await readBodyPreview(res);
    const err = new Error(
      preview ? `${NON_JSON_MESSAGE}（回應預覽：${preview}）` : NON_JSON_MESSAGE,
    );
    throw err;
  }
  return res.json();
}

async function handleErr(res) {
  const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
  let msg = `HTTP ${res.status}`;
  if (isJsonResponse(res)) {
    const j = await res.json().catch(() => ({}));
    msg = j?.error || j?.message || msg;
  } else {
    const preview = await readBodyPreview(res);
    msg = preview ? `${NON_JSON_MESSAGE}（回應預覽：${preview}）` : NON_JSON_MESSAGE;
  }
  const err = new Error(msg);
  err.requestId = requestId;
  err.status = res.status;
  if (requestId) err.message = `${msg}（錯誤識別碼：${requestId}）`;
  throw err;
}

/**
 * @param {string} token
 * @param {Record<string, string|number|undefined|null>} params
 */
export async function fetchImportRuns(token, params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const query = q.toString();
  const url = query ? `/api/admin/import-runs?${query}` : '/api/admin/import-runs';
  const res = await fetchClient(url, {
    headers: authHeaders(token),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonBody(res);
}

export async function fetchImportRunDetail(token, source, sourceId) {
  const src = encodeURIComponent(String(source || '').trim());
  const sid = encodeURIComponent(String(sourceId || '').trim());
  const res = await fetchClient(`/api/admin/import-runs/${src}/${sid}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonBody(res);
}

export async function deleteImportRun(token, source, sourceId) {
  const src = encodeURIComponent(String(source || '').trim());
  const sid = encodeURIComponent(String(sourceId || '').trim());
  const res = await fetchClient(`/api/admin/import-runs/${src}/${sid}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) await handleErr(res);
  return parseJsonBody(res);
}
