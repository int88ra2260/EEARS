import { fetchClient } from '../utils/fetchClient';

const HOST_TOKEN_KEY = 'eears-speaking-host-token';

export function readSpeakingHostToken() {
  try {
    return localStorage.getItem(HOST_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function saveSpeakingHostToken(token) {
  localStorage.setItem(HOST_TOKEN_KEY, token);
}

export function clearSpeakingHostToken() {
  try {
    localStorage.removeItem(HOST_TOKEN_KEY);
  } catch {
    // Private browsing can reject storage writes.
  }
}

async function parseEnvelope(res, fallbackMessage) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const err = new Error(json.message || fallbackMessage || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  return json.data != null ? json.data : json;
}

function hostHeaders() {
  return { Authorization: `Bearer ${readSpeakingHostToken()}` };
}

export async function loginSpeakingHost(payload) {
  const res = await fetchClient('/api/speaking-host/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseEnvelope(res, '登入失敗');
}

export async function fetchSpeakingHostSets() {
  const res = await fetchClient('/api/speaking-host/sets', { headers: hostHeaders() });
  return parseEnvelope(res, '無法載入題組');
}

export async function fetchSpeakingHostSet(setId) {
  const res = await fetchClient(`/api/speaking-host/sets/${setId}`, { headers: hostHeaders() });
  return parseEnvelope(res, '無法載入題組');
}

export async function createSpeakingHostSet(payload) {
  const res = await fetchClient('/api/speaking-host/sets', {
    method: 'POST',
    headers: { ...hostHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseEnvelope(res, '無法建立題組');
}

export async function updateSpeakingHostSet(setId, payload) {
  const res = await fetchClient(`/api/speaking-host/sets/${setId}`, {
    method: 'PUT',
    headers: { ...hostHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseEnvelope(res, '無法儲存題組');
}

export async function publishSpeakingHostSet(setId) {
  const res = await fetchClient(`/api/speaking-host/sets/${setId}/publish`, {
    method: 'POST',
    headers: hostHeaders(),
  });
  return parseEnvelope(res, '無法公布題組');
}

export async function closeSpeakingHostSet(setId) {
  const res = await fetchClient(`/api/speaking-host/sets/${setId}/close`, {
    method: 'POST',
    headers: hostHeaders(),
  });
  return parseEnvelope(res, '無法結束題組');
}

export async function fetchSpeakingHostResults(setId) {
  const res = await fetchClient(`/api/speaking-host/sets/${setId}/results`, { headers: hostHeaders() });
  return parseEnvelope(res, '無法載入結果');
}

export async function fetchSpeakingHostAudio(responseId) {
  const res = await fetchClient(`/api/speaking-host/responses/${responseId}/audio`, { headers: hostHeaders() });
  if (!res.ok) {
    const err = new Error('錄音無法播放');
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

export async function saveSpeakingHostRating(responseId, payload) {
  const res = await fetchClient(`/api/speaking-host/responses/${responseId}/rating`, {
    method: 'PUT',
    headers: { ...hostHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseEnvelope(res, '無法儲存評分');
}

export async function joinSpeakingCheck(payload) {
  const res = await fetchClient('/api/speaking-check/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseEnvelope(res, '無法加入題組');
}

export async function fetchSpeakingCheckSession(participantUid) {
  const res = await fetchClient(`/api/speaking-check/sessions/${encodeURIComponent(participantUid)}`);
  return parseEnvelope(res, '無法恢復作答');
}

export async function submitSpeakingCheckResponse(participantUid, payload, audioBlob) {
  const body = new FormData();
  body.append('itemId', String(payload.itemId));
  body.append('transcript', payload.transcript || '');
  body.append('durationMs', payload.durationMs == null ? '' : String(payload.durationMs));
  body.append('clientFeatures', JSON.stringify(payload.clientFeatures || {}));
  if (audioBlob && audioBlob.size > 0) {
    const type = audioBlob.type || 'audio/webm';
    const extension = type.includes('mp4') || type.includes('m4a') ? 'm4a' : 'webm';
    body.append('audio', audioBlob, `response.${extension}`);
  }
  const res = await fetchClient(`/api/speaking-check/sessions/${encodeURIComponent(participantUid)}/responses`, {
    method: 'POST',
    body,
  });
  return parseEnvelope(res, '送出失敗，請再試一次');
}
