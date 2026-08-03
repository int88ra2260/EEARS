/**
 * 學習有伴後台 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';
import { downloadBlob } from './englishTestApi';

const BASE = '/api/admin/learning-partner';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

async function throwIfNotOk(res, fallback = '請求失敗') {
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data.error || data.message || fallback);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchLearningPartnerTeams(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`${BASE}/teams?${qs}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入團體列表失敗');
}

export async function fetchLearningPartnerTeamById(token, teamId) {
  const res = await fetchClient(`${BASE}/teams/${teamId}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入團體詳情失敗');
}

export async function exportLearningPartnerTeamsCsv(token) {
  const res = await fetchClient(`${BASE}/export?format=csv`, { headers: authHeaders(token) });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data.error || '匯出失敗');
  }
  return res.blob();
}

export function downloadLearningPartnerExport(blob, fileName) {
  downloadBlob(blob, fileName);
}
