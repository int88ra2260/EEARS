/**
 * 培力英檢報名 API 薄層：統一 token、fetchClient、錯誤處理。
 */
import { fetchClient } from '../utils/fetchClient';

const BASE = '/api/english-test/registrations';
const SETTINGS_INDIVIDUAL = '/api/settings/english-test-registration-enabled';
const SETTINGS_GROUP = '/api/settings/english-test-registration-group-enabled';

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

/**
 * @param {string} token
 * @param {URLSearchParams|Record<string, string>} params
 */
export async function fetchRegistrations(token, params) {
  const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  const res = await fetchClient(`${BASE}?${qs}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data.error || data.message || `載入報名列表失敗 (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function fetchRegistrationById(token, id) {
  const res = await fetchClient(`${BASE}/${id}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入詳細資料失敗');
  return data;
}

export async function updateRegistration(token, id, body) {
  const res = await fetchClient(`${BASE}/${id}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '更新失敗');
  return data;
}

export async function deleteRegistration(token, id) {
  const res = await fetchClient(`${BASE}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data.error || '刪除失敗');
  }
}

export async function uploadRegistrationFiles(token, id, formData) {
  const res = await fetchClient(`${BASE}/${id}/files`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: formData,
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '檔案上傳失敗');
  return data;
}

export async function bulkUpdateRegistrations(token, body) {
  const res = await fetchClient(`${BASE}/bulk-update`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '批量更新失敗');
  return data;
}

export async function adjustRegistrationSequence(token, id, body) {
  const res = await fetchClient(`${BASE}/${id}/adjust-sequence`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '調整順序失敗');
  return data;
}

export async function exportRegistrationsExcel(token, params) {
  const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  const url = qs ? `${BASE}/export/excel?${qs}` : `${BASE}/export/excel`;
  const res = await fetchClient(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('匯出失敗');
  return res.blob();
}

export async function exportRegistrationPhotos(token, status) {
  const res = await fetchClient(`${BASE}/export/photos?status=${status}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data.error || '匯出證件照失敗');
  }
  return res.blob();
}

export async function sendStatusEmails(token, status) {
  const res = await fetchClient(`${BASE}/send-status-emails`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const message =
      data.error ||
      data.message ||
      (res.status === 500 ? 'Gmail 暫時鎖定，請稍後再試' : '發信失敗');
    const err = new Error(message);
    err.isGmailLocked = typeof message === 'string' && message.includes('Gmail 暫時鎖定');
    throw err;
  }
  return data;
}

export async function fetchInfoSourceStats(token) {
  const res = await fetchClient(`${BASE}/stats/info-source`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入統計失敗');
  return data;
}

/** 數據分析：Q21 宣傳來源、系所、年級 */
export async function fetchEnglishTestAnalyticsStats(token) {
  const res = await fetchClient(`${BASE}/stats/analytics`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入統計失敗');
  return {
    infoSource: data.infoSource || { data: [], total: 0 },
    department: data.department || { data: [], total: 0 },
    grade: data.grade || { data: [], total: 0 },
  };
}

export async function fetchClassBestepLink(token, registrationId) {
  const res = await fetchClient(`${BASE}/${registrationId}/class-bestep-link`, {
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '查詢失敗');
  return data;
}

export async function fetchIndividualRegistrationEnabled(token) {
  const res = await fetchClient(SETTINGS_INDIVIDUAL, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入設定失敗');
  return data.enabled !== false;
}

export async function fetchGroupRegistrationEnabled(token) {
  const res = await fetchClient(SETTINGS_GROUP, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入設定失敗');
  return data.enabled !== false;
}

export async function updateIndividualRegistrationEnabled(token, enabled) {
  const res = await fetchClient(SETTINGS_INDIVIDUAL, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ enabled }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '更新設定失敗');
  return enabled;
}

export async function updateGroupRegistrationEnabled(token, enabled) {
  const res = await fetchClient(SETTINGS_GROUP, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ enabled }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '更新設定失敗');
  return enabled;
}

export async function fetchExemptionReviewList(token, params) {
  const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  const res = await fetchClient(`${BASE}/exemption-review?${qs}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入失敗');
  return data;
}

export async function updateExemptionReview(token, registrationId, body) {
  const res = await fetchClient(`${BASE}/${registrationId}/exemption-review`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '更新失敗');
  return data;
}

/** 觸發瀏覽器下載 blob */
export function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
