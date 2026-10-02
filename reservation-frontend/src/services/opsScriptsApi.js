/**
 * 管理員維運腳本 API（備份健康／觸發）
 */
import { fetchClientThrow } from '../utils/fetchClient';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token || ''}`,
    'Content-Type': 'application/json',
  };
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data?.code;
    err.data = data;
    throw err;
  }
  return data?.data !== undefined ? data.data : data;
}

export async function fetchBackupOpsStatus(token) {
  const res = await fetchClientThrow('/api/admin/ops-scripts/backup/health', {
    headers: authHeaders(token),
  });
  return parseJson(res);
}

export async function fetchBackupJob(token) {
  const res = await fetchClientThrow('/api/admin/ops-scripts/backup/job', {
    headers: authHeaders(token),
  });
  return parseJson(res);
}

export async function runBackupJob(token) {
  const res = await fetchClientThrow('/api/admin/ops-scripts/backup/run', {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseJson(res);
}

export async function fetchGitHubOpsStatus(token, { refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  const res = await fetchClientThrow(`/api/admin/ops-scripts/github${query}`, {
    headers: authHeaders(token),
  });
  return parseJson(res);
}

export async function fetchMigrationOpsStatus(token) {
  const res = await fetchClientThrow('/api/admin/ops-scripts/migrations', {
    headers: authHeaders(token),
  });
  return parseJson(res);
}

export async function runMigrationJob(token) {
  const res = await fetchClientThrow('/api/admin/ops-scripts/migrations/run', {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseJson(res);
}
