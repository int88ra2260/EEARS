/**
 * 報表與分析 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

function getRequestId(res) {
  return res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
}

export function parseApiError(res, json) {
  const rid = getRequestId(res);
  const msg = json?.error || json?.message || '載入失敗';
  return rid ? `${msg}（錯誤識別碼：${rid}）` : msg;
}

async function fetchJsonOrThrow(url, options, fallback = '載入失敗') {
  const res = await fetchClient(url, options);
  const json = await parseJson(res);
  if (!res.ok) {
    const err = new Error(parseApiError(res, json) || fallback);
    err.status = res.status;
    err.requestId = getRequestId(res);
    throw err;
  }
  return { res, json };
}

export async function fetchParticipationCheckins(token) {
  const { json } = await fetchJsonOrThrow('/api/reports/participation-checkins', {
    headers: authHeaders(token),
  }, '載入簽到參與統計失敗');
  return json;
}

export async function fetchAnalyticsOverview(token, semester, { kind } = {}) {
  const sem = encodeURIComponent(semester);
  const kindQs = kind ? `&kind=${encodeURIComponent(kind)}` : '';
  const { json } = await fetchJsonOrThrow(
    `/api/analytics/overview?semester=${sem}${kindQs}`,
    { headers: authHeaders(token) },
  );
  return json;
}

export async function fetchReservationCapacityBreakdown(token, semester, { retry = false } = {}) {
  const sem = encodeURIComponent(semester);
  const suffix = retry ? '&retry=1' : '';
  const { res, json } = await fetchJsonOrThrow(
    `/api/analytics/reservation-capacity-breakdown?semester=${sem}&_=${Date.now()}${suffix}`,
    {
      headers: {
        ...authHeaders(token),
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: retry ? 'reload' : 'no-store',
    },
    '載入名額分項失敗',
  );
  return { res, json };
}

export async function fetchAnalyticsTrends(token, semester, kind = 'reservation') {
  const sem = encodeURIComponent(semester);
  const { json } = await fetchJsonOrThrow(
    `/api/analytics/trends?semester=${sem}&kind=${encodeURIComponent(kind)}`,
    { headers: authHeaders(token) },
  );
  return json;
}

export async function fetchAnalyticsEvents(token, semester) {
  const sem = encodeURIComponent(semester);
  const { json } = await fetchJsonOrThrow(
    `/api/analytics/events?semester=${sem}`,
    { headers: authHeaders(token) },
  );
  return json;
}

export async function fetchAnalyticsClasses(token, semester) {
  const sem = encodeURIComponent(semester);
  const { json } = await fetchJsonOrThrow(
    `/api/analytics/classes?semester=${sem}`,
    { headers: authHeaders(token) },
  );
  return json;
}

export async function fetchAnalyticsRisk(token, semester) {
  const sem = encodeURIComponent(semester);
  const { json } = await fetchJsonOrThrow(
    `/api/analytics/risk?semester=${sem}`,
    { headers: authHeaders(token) },
  );
  return json;
}

export async function fetchTeacherDashboard(token, teacherId, semester) {
  const { json } = await fetchJsonOrThrow(
    `/api/analytics/teachers/${encodeURIComponent(teacherId)}/dashboard?semester=${encodeURIComponent(semester)}`,
    { headers: authHeaders(token) },
  );
  return json;
}

export async function fetchTrendOverview(token, fromSemester, toSemester) {
  const { json } = await fetchJsonOrThrow(
    `/api/analytics/trends/overview?fromSemester=${encodeURIComponent(fromSemester)}&toSemester=${encodeURIComponent(toSemester)}`,
    { headers: authHeaders(token) },
  );
  return json;
}

export async function fetchTrendByStudent(token, studentId, fromSemester, toSemester) {
  const { json } = await fetchJsonOrThrow(
    `/api/analytics/trends?studentId=${encodeURIComponent(studentId)}&fromSemester=${encodeURIComponent(fromSemester)}&toSemester=${encodeURIComponent(toSemester)}`,
    { headers: authHeaders(token) },
  );
  return json;
}

export async function fetchTrendByClass(token, classId, fromSemester, toSemester) {
  const { json } = await fetchJsonOrThrow(
    `/api/analytics/trends/classes/${encodeURIComponent(classId)}?fromSemester=${encodeURIComponent(fromSemester)}&toSemester=${encodeURIComponent(toSemester)}`,
    { headers: authHeaders(token) },
  );
  return json;
}

export async function readJsonResponse(res) {
  return parseJson(res);
}
