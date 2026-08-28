import { fetchClient } from '../utils/fetchClient';

const TRACE_URL = '/api/learning-traces';
const ENGAGEMENT_URL = '/api/admin/learning-traces/engagement';
const FUNNEL_URL = '/api/admin/learning-traces/funnel';
const CORRELATION_URL = '/api/admin/learning-traces/correlation';
const STUDENT_DASHBOARD_URL = '/api/student-learning-journey/dashboard';

export async function submitLearningTrace(body) {
  try {
    const res = await fetchClient(TRACE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      return { ok: false };
    }
    return { ok: true, duplicate: json.data?.created === false, projected: json.data?.projected };
  } catch {
    return { ok: false };
  }
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function parseAdminEnvelope(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  return json.data != null ? json.data : json;
}

export async function getMicroLearningEngagement(token, params = {}, options = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const query = qs.toString();
  const res = await fetchClient(`${ENGAGEMENT_URL}${query ? `?${query}` : ''}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseAdminEnvelope(res);
}

export async function getRecommendationFunnelSummary(token, params = {}, options = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const query = qs.toString();
  const res = await fetchClient(`${FUNNEL_URL}${query ? `?${query}` : ''}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseAdminEnvelope(res);
}

export async function getTraceLjCorrelation(token, params = {}, options = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const query = qs.toString();
  const res = await fetchClient(`${CORRELATION_URL}${query ? `?${query}` : ''}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseAdminEnvelope(res);
}

export async function fetchStudentLearningJourneyDashboard(identity, options = {}) {
  const qs = new URLSearchParams({
    studentId: identity.studentId,
    studentName: identity.studentName,
    studentEmail: identity.studentEmail,
  });
  const res = await fetchClient(`${STUDENT_DASHBOARD_URL}?${qs.toString()}`, {
    signal: options.signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const err = new Error(json.message || '載入學習歷程失敗');
    err.code = json.code;
    err.status = res.status;
    throw err;
  }
  return json.data;
}
