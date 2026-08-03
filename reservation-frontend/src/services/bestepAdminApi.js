/**
 * BESTEP 後台 API 薄層：匯入、團隊排名
 */
import { fetchClient } from '../utils/fetchClient';

const BASE = '/api/admin/bestep';

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

export async function importBestepAttendance(token, formData) {
  const res = await fetchClient(`${BASE}/attendance/import`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  return throwIfNotOk(res, '匯入出席資料失敗');
}

export async function importBestepScores(token, formData) {
  const res = await fetchClient(`${BASE}/scores/import`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  return throwIfNotOk(res, '匯入成績資料失敗');
}

export async function fetchBestepTeamRanking(token, semester) {
  const res = await fetchClient(`${BASE}/teams/ranking?semester=${encodeURIComponent(semester)}`, {
    headers: authHeaders(token),
  });
  return throwIfNotOk(res, '載入名次失敗');
}

export async function calculateBestepTeamRanking(token, semester) {
  const res = await fetchClient(`${BASE}/teams/calculate-ranking`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ semester }),
  });
  return throwIfNotOk(res, '計算名次失敗');
}
