/**
 * 操作紀錄／日誌 API 薄層（fetchClient，取代 axiosClient）
 */
import { fetchClient } from '../utils/fetchClient';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function buildQuery(params) {
  const out = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') out.append(k, v);
  });
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

async function getJsonOrThrow(url, token) {
  const res = await fetchClient(url, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data.error || data.message || '請求失敗');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchAuditLogs(token, params) {
  return getJsonOrThrow(`/api/admin/logs/audit${buildQuery(params)}`, token);
}

export async function fetchLogsByRequestId(token, requestId) {
  return getJsonOrThrow(`/api/admin/logs/request/${encodeURIComponent(requestId)}`, token);
}

export async function fetchSystemLogs(token, params) {
  return getJsonOrThrow(`/api/admin/logs/system${buildQuery(params)}`, token);
}

export async function fetchEmailLogs(token, params) {
  return getJsonOrThrow(`/api/admin/logs/email${buildQuery(params)}`, token);
}

export async function fetchLogMetricsSummary(token) {
  return getJsonOrThrow('/api/admin/logs/metrics/summary', token);
}
