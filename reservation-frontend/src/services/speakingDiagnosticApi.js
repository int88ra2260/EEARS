import { fetchClient } from '../utils/fetchClient';

const TASKS_URL = '/api/speaking-diagnostic/tasks';
const ATTEMPTS_URL = '/api/speaking-diagnostic/attempts';
const ADAPTIVE_SESSIONS_URL = '/api/speaking-diagnostic/adaptive-sessions';
const ADMIN_ATTEMPTS_URL = '/api/admin/speaking-diagnostic/attempts';

async function parseEnvelope(res, fallbackMessage) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const err = new Error(json.message || json.error || fallbackMessage || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  return json.data != null ? json.data : json;
}

export async function fetchSpeakingTasks(params = {}, options = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const query = qs.toString();
  const res = await fetchClient(`${TASKS_URL}${query ? `?${query}` : ''}`, {
    signal: options.signal,
  });
  return parseEnvelope(res, '載入口說題目失敗');
}

export async function fetchNextSpeakingTask(params = {}, options = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const query = qs.toString();
  const res = await fetchClient(`/api/speaking-diagnostic/next-task${query ? `?${query}` : ''}`, {
    signal: options.signal,
  });
  return parseEnvelope(res, '取得下一題推薦失敗');
}

export async function createSpeakingAdaptiveSession(payload = {}, options = {}) {
  const res = await fetchClient(ADAPTIVE_SESSIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  return parseEnvelope(res, '建立適應性口說測驗失敗');
}

export async function fetchSpeakingAdaptiveSession(sessionUid, params = {}, options = {}) {
  const res = await fetchClient(`${ADAPTIVE_SESSIONS_URL}/${encodeURIComponent(sessionUid)}${buildQuery(params)}`, {
    signal: options.signal,
  });
  return parseEnvelope(res, '載入適應性口說測驗失敗');
}

export async function fetchSpeakingAdaptiveNextTask(sessionUid, options = {}) {
  const res = await fetchClient(`${ADAPTIVE_SESSIONS_URL}/${encodeURIComponent(sessionUid)}/next-task`, {
    signal: options.signal,
  });
  return parseEnvelope(res, '取得適應性下一題失敗');
}

export async function submitSpeakingAttempt(payload) {
  const form = new FormData();
  form.set('taskKey', payload.taskKey);
  form.set('clientSessionId', payload.clientSessionId);
  if (payload.adaptiveSessionUid) form.set('adaptiveSessionUid', payload.adaptiveSessionUid);
  if (payload.studentId) form.set('studentId', payload.studentId);
  if (payload.durationMs != null) form.set('durationMs', String(payload.durationMs));
  if (payload.transcript) form.set('transcript', payload.transcript);
  if (payload.clientFeatures) form.set('clientFeatures', JSON.stringify(payload.clientFeatures));
  form.set('audio', payload.audioBlob, payload.audioFileName || 'speaking-attempt.webm');

  const res = await fetchClient(ATTEMPTS_URL, {
    method: 'POST',
    body: form,
  });
  return parseEnvelope(res, '送出口說錄音失敗');
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const query = qs.toString();
  return query ? `?${query}` : '';
}

export async function fetchSpeakingDiagnosticAttempts(token, params = {}, options = {}) {
  const res = await fetchClient(`${ADMIN_ATTEMPTS_URL}${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res, '載入口說診斷紀錄失敗');
}

export async function fetchSpeakingDiagnosticResearchSummary(token, params = {}, options = {}) {
  const res = await fetchClient(`/api/admin/speaking-diagnostic/research-summary${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res, '載入口說研究摘要失敗');
}

export async function fetchSpeakingDiagnosticEcosystemSummary(token, params = {}, options = {}) {
  const res = await fetchClient(`/api/admin/speaking-diagnostic/ecosystem-summary${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res, '載入口說生態系摘要失敗');
}

export async function fetchSpeakingDiagnosticAdminTasks(token, params = {}, options = {}) {
  const res = await fetchClient(`/api/admin/speaking-diagnostic/tasks${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res, '載入 ESAP 口說題庫失敗');
}

export async function createSpeakingDiagnosticAdminTask(token, payload, options = {}) {
  const res = await fetchClient('/api/admin/speaking-diagnostic/tasks', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  return parseEnvelope(res, '建立 ESAP 口說題目失敗');
}

export async function updateSpeakingDiagnosticAdminTask(token, taskKey, payload, options = {}) {
  const res = await fetchClient(`/api/admin/speaking-diagnostic/tasks/${encodeURIComponent(taskKey)}`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  return parseEnvelope(res, '更新 ESAP 口說題目失敗');
}

export async function downloadSpeakingDiagnosticResearchCsv(token, params = {}, options = {}) {
  const res = await fetchClient(`/api/admin/speaking-diagnostic/research-export.csv${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  if (!res.ok) {
    await parseEnvelope(res, '下載口說研究資料失敗');
  }
  return res.blob();
}

export async function saveSpeakingDiagnosticRating(token, attemptUid, rating, options = {}) {
  const res = await fetchClient(`${ADMIN_ATTEMPTS_URL}/${encodeURIComponent(attemptUid)}/ratings`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(rating),
    signal: options.signal,
  });
  return parseEnvelope(res, '儲存口說評分失敗');
}

export async function recomputeSpeakingDiagnosticAlignment(token, attemptUid, options = {}) {
  const res = await fetchClient(`${ADMIN_ATTEMPTS_URL}/${encodeURIComponent(attemptUid)}/alignment/recompute`, {
    method: 'POST',
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res, '重新計算 forced alignment 失敗');
}

export async function recomputeSpeakingDiagnosticAlignmentBatch(token, payload = {}, options = {}) {
  const res = await fetchClient(`${ADMIN_ATTEMPTS_URL}/alignment/recompute-batch`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  return parseEnvelope(res, '批次重新計算 forced alignment 失敗');
}

