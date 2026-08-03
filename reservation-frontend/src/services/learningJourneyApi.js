import { fetchClient } from '../utils/fetchClient';

const BASE_URL = '/api/admin/learning-journey';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function parseEnvelope(res) {
  const headerRid = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || '';
  const json = await res.json().catch(() => ({}));
  const bodyRid = json.requestId || json.meta?.traceId || '';
  const requestId = bodyRid || headerRid;
  if (!res.ok) {
    const msg = json.error || json.message || `HTTP ${res.status}`;
    const err = new Error(requestId ? `${msg}（Request-ID: ${requestId}）` : msg);
    err.requestId = requestId;
    err.status = res.status;
    throw err;
  }
  if (json && json.success === false) {
    const err = new Error(json.error || 'Request failed');
    err.requestId = requestId;
    throw err;
  }
  return json.data != null ? json.data : json;
}

export async function getLearningJourneyProfile(token, studentId) {
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/profile`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyTimeline(token, studentId) {
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/timeline`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyStudentConsistency(token, studentId) {
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/consistency`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyStudentReport(token, studentId) {
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/report?format=json`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyStudentReportHtml(token, studentId) {
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/report?format=html`,
    { headers: authHeaders(token) }
  );
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(text || `HTTP ${res.status}`);
    err.status = res.status;
    err.requestId = res.headers.get('x-request-id') || '';
    throw err;
  }
  return text;
}

export async function getLearningJourneySemesterDashboard(token, semesterId) {
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/dashboard`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneySemesters(token) {
  const res = await fetchClient(`${BASE_URL}/semesters`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneySemesterOverview(token, semesterId) {
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/overview`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneySemesterStudents(token, semesterId, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/students?${qs.toString()}`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyImportHistories(token, semesterId, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/import-histories?${qs.toString()}`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function postLearningJourneyRebuildFinal(token, semesterId) {
  const res = await fetchClient(`${BASE_URL}/admin/rebuild-final`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ semesterId }),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyStudentDetail(token, studentId, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}${query}`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyReconciliation(token, semesterId) {
  const qs = new URLSearchParams();
  qs.set('semesterId', semesterId);
  const res = await fetchClient(`${BASE_URL}/admin/reconciliation?${qs.toString()}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyReadiness(token, semesterId) {
  const qs = new URLSearchParams();
  qs.set('semesterId', semesterId);
  const res = await fetchClient(`${BASE_URL}/admin/readiness?${qs.toString()}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyReadModelStatus(token) {
  const res = await fetchClient(`${BASE_URL}/admin/read-model-status`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyDataFreshness(token, semesterId) {
  const qs = new URLSearchParams();
  qs.set('semesterId', semesterId);
  const res = await fetchClient(`${BASE_URL}/admin/data-freshness?${qs.toString()}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyGovernanceOverview(token, semesterId) {
  const qs = new URLSearchParams();
  qs.set('semesterId', semesterId);
  const res = await fetchClient(`${BASE_URL}/admin/governance-overview?${qs.toString()}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyRecentJobs(token, semesterId, limit = 20) {
  const qs = new URLSearchParams();
  if (semesterId) qs.set('semesterId', semesterId);
  if (limit) qs.set('limit', String(limit));
  const res = await fetchClient(`${BASE_URL}/admin/jobs/recent?${qs.toString()}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function getLearningJourneyLegacyUsageAudit(token, days = 30) {
  const qs = new URLSearchParams();
  qs.set('days', String(days));
  const res = await fetchClient(`${BASE_URL}/admin/legacy-usage-audit?${qs.toString()}`, {
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export async function postLearningJourneyRunDailyGovernance(token, semesterId) {
  const res = await fetchClient(`${BASE_URL}/admin/jobs/run-daily-governance`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ semesterId }),
  });
  return parseEnvelope(res);
}

export async function postLearningJourneyReconcileSemester(token, semesterId) {
  const res = await fetchClient(`${BASE_URL}/admin/jobs/reconcile-semester`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ semesterId }),
  });
  return parseEnvelope(res);
}

/**
 * @param {string} token
 * @param {{ semesterId: string, sections: string[], dryRun: boolean }} body
 */
export async function getLearningJourneyEnglishTestSummaryV3(token, semesterId) {
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/english-test-summary`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function getLearningJourneyRiskStudents(token, semesterId) {
  const res = await fetchClient(
    `${BASE_URL}/semesters/${encodeURIComponent(semesterId)}/risk-students`,
    { headers: authHeaders(token) }
  );
  return parseEnvelope(res);
}

export async function postLearningJourneySync(token, body) {
  const res = await fetchClient(`${BASE_URL}/admin/sync`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return parseEnvelope(res);
}

export async function postLearningJourneyCourseImportDryRun(token, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchClient(`${BASE_URL}/admin/course-import/dry-run`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  return parseEnvelope(res);
}

export async function postLearningJourneyCourseImportApply(token, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchClient(`${BASE_URL}/admin/course-import/apply`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  return parseEnvelope(res);
}

export async function postAcademicCourseRosterDryRun(token, file, { semesterId, syncClassRoster = true }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('semesterId', semesterId);
  formData.append('syncClassRoster', syncClassRoster ? '1' : '0');
  const res = await fetchClient(`${BASE_URL}/admin/academic-course-roster/dry-run`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  return parseEnvelope(res);
}

export async function postAcademicCourseRosterApply(token, file, { semesterId, syncClassRoster = true }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('semesterId', semesterId);
  formData.append('syncClassRoster', syncClassRoster ? '1' : '0');
  const res = await fetchClient(`${BASE_URL}/admin/academic-course-roster/apply`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  return parseEnvelope(res);
}
