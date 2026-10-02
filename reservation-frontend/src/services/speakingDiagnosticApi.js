import { fetchClient } from '../utils/fetchClient';

const TASKS_URL = '/api/speaking-diagnostic/tasks';
const ATTEMPTS_URL = '/api/speaking-diagnostic/attempts';

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

export async function submitSpeakingAttempt(payload) {
  const form = new FormData();
  form.set('taskKey', payload.taskKey);
  form.set('clientSessionId', payload.clientSessionId);
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

