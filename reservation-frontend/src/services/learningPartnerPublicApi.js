/**
 * 學習有伴學生端 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';

const BASE = '/api/learning-partner';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export async function fetchLearningPartnerQuota() {
  const res = await fetchClient(`${BASE}/quota`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入名額失敗');
  return data;
}

export async function createLearningPartnerTeam(body) {
  const res = await fetchClient(`${BASE}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data.error || '報名失敗');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function prepareLearningPartnerApproval(token) {
  const res = await fetchClient(`${BASE}/approve/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function confirmLearningPartnerApproval(token) {
  const res = await fetchClient(`${BASE}/approve/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data.error || '確認同意失敗');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchLearningPartnerTeamStatus(teamId) {
  const res = await fetchClient(`${BASE}/teams/${teamId}`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入團體狀態失敗');
  return data;
}

export async function resendLearningPartnerInvite(teamId, memberId) {
  const res = await fetchClient(`${BASE}/teams/${teamId}/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '重新發送失敗');
  return data;
}
