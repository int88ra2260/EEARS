import { fetchClient } from '../utils/fetchClient';

const BASE_URL = '/api/admin/learning-journey-v3';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function parseEnvelope(res) {
  const json = await res.json().catch(() => ({}));
  const requestId = json.requestId || res.headers.get('x-request-id') || '';
  if (!res.ok || json.success === false) {
    let msg = json.error || json.message || `HTTP ${res.status}`;
    if (res.status === 403 || json.code === 'INSUFFICIENT_PERMISSIONS') {
      msg = '您沒有執行此操作的權限。';
    }
    const err = new Error(msg);
    err.requestId = requestId;
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  const data = json.data != null ? json.data : json;
  if (data && typeof data === 'object' && requestId && !data.requestId) {
    data.requestId = requestId;
  }
  return data;
}

export async function getLearningJourneyV3B2Report(token, semesterId) {
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/b2-report`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyV3Students(token, semesterId, params = {}, options = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/students${query}`,
    { headers: authHeaders(token), signal: options.signal }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyV3Breakdown(token, semesterId, groupBy) {
  const qs = new URLSearchParams();
  qs.set('groupBy', groupBy);
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/breakdown?${qs.toString()}`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyHealth(token, semesterId) {
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/health`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function rebuildLearningJourneySemester(token, semesterId, payload = {}) {
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/rebuild`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyOperationRuns(token, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(`${BASE_URL}/operation-runs${query}`, {
    headers: authHeaders(token)
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyOperationRunDetail(token, id) {
  const res = await fetchClient(`${BASE_URL}/operation-runs/${encodeURIComponent(id)}`, {
    headers: authHeaders(token)
  });
  return parseEnvelope(res);
}

export async function exportLearningJourneyOperationRunsCsv(token, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(`${BASE_URL}/operation-runs/export.csv${query}`, {
    headers: authHeaders(token)
  });
  const requestId = res.headers.get('x-request-id') || '';
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const err = new Error(json.error || json.message || `HTTP ${res.status}`);
    err.requestId = json.requestId || requestId;
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return {
    blob: await res.blob(),
    filename: match?.[1] || 'learning-journey-operation-runs.csv',
    requestId
  };
}

export async function cleanupLearningJourneyOperationRunsDryRun(token, payload = {}) {
  const res = await fetchClient(`${BASE_URL}/operation-runs/cleanup-dry-run`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return parseEnvelope(res);
}

export async function archiveLearningJourneyOperationRuns(token, payload = {}) {
  const res = await fetchClient(`${BASE_URL}/operation-runs/cleanup-archive`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyV3StudentProfile(token, studentId, semesterId) {
  const qs = new URLSearchParams();
  if (semesterId) qs.set('semesterId', semesterId);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/profile${query}`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyV3StudentTrends(token, studentId, semesterId) {
  const qs = new URLSearchParams();
  if (semesterId) qs.set('semesterId', semesterId);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/trends${query}`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function postLearningJourneyV3EnrollmentImport(token, file, semesterId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('semesterId', semesterId);
  const res = await fetchClient(`${BASE_URL}/import/enrollment`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData
  });
  return parseEnvelope(res);
}

export async function postLearningJourneyV3ExamImport(token, file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (options.semesterId) {
    formData.append('semesterId', options.semesterId);
  }
  if (options.replaceMode === true) {
    formData.append('replaceMode', 'true');
  }
  const res = await fetchClient(`${BASE_URL}/import/exam`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData
  });
  return parseEnvelope(res);
}

export async function postLearningJourneyV3BaselineImport(token, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchClient(`${BASE_URL}/import/baseline`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  return parseEnvelope(res);
}

/**
 * EWL ReservationInfo → activity_participations
 * @param {string} token
 * @param {{ startDate?: string, endDate?: string, studentId?: string, dryRun?: boolean, confirm?: boolean }} payload
 */
export async function postLearningJourneyV3EwlSync(token, payload = {}) {
  const res = await fetchClient(`${BASE_URL}/sync/ewl`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyV3ImportHistories(token, semesterId, limit = 20) {
  const qs = new URLSearchParams();
  if (semesterId) qs.set('semesterId', semesterId);
  qs.set('limit', String(limit));
  const res = await fetchClient(`${BASE_URL}/import/histories?${qs.toString()}`, {
    headers: authHeaders(token)
  });
  return parseEnvelope(res);
}

export async function deleteLearningJourneyV3ImportHistory(token, id, options = {}) {
  const qs = new URLSearchParams();
  if (options.type) qs.set('type', options.type);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(`${BASE_URL}/import/histories/${encodeURIComponent(id)}${query}`, {
    method: 'DELETE',
    headers: authHeaders(token)
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyV3StudentTimeline(token, studentId, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/timeline${query}`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyAnalyticsStudents(token, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(`${BASE_URL}/analytics/students${query}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyAnalyticsExams(token, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(`${BASE_URL}/analytics/exams${query}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyAnalyticsSummary(token, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(`${BASE_URL}/analytics/summary${query}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyLvaAnalytics(token, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(`${BASE_URL}/analytics/lva${query}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function listLearningJourneyLvaModelRuns(token, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(`${BASE_URL}/analytics/lva/model-runs${query}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function createLearningJourneyLvaModelRun(token, filters = {}) {
  const res = await fetchClient(`${BASE_URL}/analytics/lva/model-runs`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters }),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyLvaModelRun(token, id) {
  const res = await fetchClient(`${BASE_URL}/analytics/lva/model-runs/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyResearchExport(token, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(`${BASE_URL}/exports/research${query}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return {
      format: 'csv',
      csv: await res.text(),
      snapshotVersion: res.headers.get('X-LJ-Snapshot-Version'),
    };
  }
  return parseEnvelope(res);
}

export async function getLearningJourneyQualityAssertions(token, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(`${BASE_URL}/quality/assertions${query}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function postLearningJourneyAnalyticsRebuild(token, payload = {}) {
  const res = await fetchClient(`${BASE_URL}/analytics/rebuild`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  const requestId = json.requestId || res.headers.get('x-request-id') || '';
  if (!res.ok || json.success === false) {
    let msg = json.error || json.message || `HTTP ${res.status}`;
    if (res.status === 403 || json.code === 'INSUFFICIENT_PERMISSIONS') {
      msg = '您沒有執行此操作的權限。';
    }
    const err = new Error(msg);
    err.requestId = requestId;
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  const data = json.data != null ? json.data : {};
  return {
    ...data,
    async: json.async === true,
    message: json.message || null,
    requestId,
  };
}
