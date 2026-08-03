/**
 * 英語實踐歷程護照 API（學生端無 token + 管理端有 token）
 */
import { fetchClient } from '../utils/fetchClient';

const STUDENT_BASE = '/api/english-learning-passport';
const ADMIN_BASE = '/api/admin/english-learning-passports';

const DASHBOARD_CACHE_MS = 90 * 1000;
const RULES_CACHE_MS = 5 * 60 * 1000;
const SUBMISSION_CACHE_MS = 90 * 1000;
const dashboardCache = new Map();
const submissionCache = new Map();
const rulesCache = { data: null, ts: 0 };
const inflightDashboard = new Map();
const inflightSubmissions = new Map();

function dashboardCacheKey(student) {
  return String(student?.studentId || '').trim();
}

function readDashboardCache(student) {
  const key = dashboardCacheKey(student);
  if (!key) return null;
  const entry = dashboardCache.get(key);
  if (!entry || Date.now() - entry.ts > DASHBOARD_CACHE_MS) return null;
  return entry.data;
}

function writeDashboardCache(student, data) {
  const key = dashboardCacheKey(student);
  if (!key) return;
  dashboardCache.set(key, { ts: Date.now(), data });
}

/** 寫入／審核後呼叫，強制下次重新載入 */
export function invalidateElpDashboardCache(student) {
  const key = dashboardCacheKey(student);
  if (key) {
    dashboardCache.delete(key);
    inflightDashboard.delete(key);
    const prefix = `${key}:sub:`;
    for (const cacheKey of submissionCache.keys()) {
      if (cacheKey.startsWith(prefix)) submissionCache.delete(cacheKey);
    }
    for (const cacheKey of inflightSubmissions.keys()) {
      if (cacheKey.startsWith(prefix)) inflightSubmissions.delete(cacheKey);
    }
  }
}

function submissionCacheKey(student, id) {
  return `${dashboardCacheKey(student)}:sub:${id}`;
}

function readSubmissionCache(student, id) {
  const key = submissionCacheKey(student, id);
  const entry = submissionCache.get(key);
  if (!entry || Date.now() - entry.ts > SUBMISSION_CACHE_MS) return null;
  return entry.data;
}

function writeSubmissionCache(student, id, data) {
  const key = submissionCacheKey(student, id);
  submissionCache.set(key, { ts: Date.now(), data });
}

function findSubmissionInDashboardCache(student, id) {
  const dash = readDashboardCache(student);
  if (!dash?.submissions) return null;
  return dash.submissions.find((s) => String(s.id) === String(id)) || null;
}

function readRulesCache() {
  if (!rulesCache.data || Date.now() - rulesCache.ts > RULES_CACHE_MS) return null;
  return rulesCache.data;
}

function writeRulesCache(data) {
  rulesCache.data = data;
  rulesCache.ts = Date.now();
}

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

function apiError(res, data, fallback) {
  if (res.status === 429) {
    const err = new Error(data.message || '請求過於頻繁，請稍後再試');
    err.code = 'RATE_LIMIT_EXCEEDED';
    err.status = 429;
    throw err;
  }
  const err = new Error(data.message || fallback);
  err.code = data.code;
  err.status = res.status;
  throw err;
}

function studentBody(student, extra = {}) {
  return {
    studentId: student.studentId,
    studentName: student.studentName,
    studentEmail: student.studentEmail,
    ...extra,
  };
}

// —— 學生端 ——

export async function fetchElpDashboard(student, { force = false } = {}) {
  const key = dashboardCacheKey(student);
  if (!force) {
    const cached = readDashboardCache(student);
    if (cached) return cached;
    const pending = inflightDashboard.get(key);
    if (pending) return pending;
  }

  const qs = new URLSearchParams(studentBody(student)).toString();
  const request = (async () => {
    const res = await fetchClient(`${STUDENT_BASE}/me?${qs}`);
    const data = await parseJson(res);
    if (!res.ok) apiError(res, data, '載入失敗');
    writeDashboardCache(student, data.data);
    return data.data;
  })();

  if (key) inflightDashboard.set(key, request);
  try {
    return await request;
  } finally {
    if (key) inflightDashboard.delete(key);
  }
}

export async function fetchElpRules({ force = false } = {}) {
  if (!force) {
    const cached = readRulesCache();
    if (cached) return cached;
  }
  const res = await fetchClient(`${STUDENT_BASE}/rules`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '載入規則失敗');
  writeRulesCache(data.data);
  return data.data;
}

export async function applyElpPassport(student, applicationReason) {
  const res = await fetchClient(`${STUDENT_BASE}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentBody(student, { applicationReason })),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '申請失敗');
  invalidateElpDashboardCache(student);
  return data.data;
}

export async function createElpSubmission(student, payload) {
  const res = await fetchClient(`${STUDENT_BASE}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentBody(student, payload)),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '建立失敗');
  invalidateElpDashboardCache(student);
  return data.data;
}

export async function updateElpSubmission(student, id, payload) {
  const res = await fetchClient(`${STUDENT_BASE}/submissions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentBody(student, payload)),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '更新失敗');
  invalidateElpDashboardCache(student);
  return data.data;
}

export async function submitElpSubmission(student, id) {
  const res = await fetchClient(`${STUDENT_BASE}/submissions/${id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentBody(student)),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '送出失敗');
  invalidateElpDashboardCache(student);
  return data.data;
}

export async function fetchElpSubmission(student, id, { force = false } = {}) {
  const cacheKey = submissionCacheKey(student, id);
  if (!force) {
    const cached = readSubmissionCache(student, id);
    if (cached) return cached;
    const fromDashboard = findSubmissionInDashboardCache(student, id);
    if (fromDashboard) {
      writeSubmissionCache(student, id, fromDashboard);
      return fromDashboard;
    }
    const pending = inflightSubmissions.get(cacheKey);
    if (pending) return pending;
  }

  const qs = new URLSearchParams(studentBody(student)).toString();
  const request = (async () => {
    const res = await fetchClient(`${STUDENT_BASE}/submissions/${id}?${qs}`);
    const data = await parseJson(res);
    if (!res.ok) apiError(res, data, '載入失敗');
    writeSubmissionCache(student, id, data.data);
    return data.data;
  })();

  inflightSubmissions.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inflightSubmissions.delete(cacheKey);
  }
}

export async function deleteElpSubmission(student, id) {
  const qs = new URLSearchParams(studentBody(student)).toString();
  const res = await fetchClient(`${STUDENT_BASE}/submissions/${id}?${qs}`, {
    method: 'DELETE',
  });
  const data = await parseJson(res);
  if (!res.ok) apiError(res, data, '刪除失敗');
  invalidateElpDashboardCache(student);
  return data.data;
}

export async function uploadElpAttachment(student, submissionId, file) {
  const form = new FormData();
  form.append('file', file);
  form.append('studentId', student.studentId);
  form.append('studentName', student.studentName);
  form.append('studentEmail', student.studentEmail);
  const res = await fetchClient(`${STUDENT_BASE}/submissions/${submissionId}/attachments`, {
    method: 'POST',
    body: form,
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '上傳失敗');
  return data.data;
}

export async function requestElpCertification(student) {
  const res = await fetchClient(`${STUDENT_BASE}/certification/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentBody(student)),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '申請失敗');
  invalidateElpDashboardCache(student);
  return data.data;
}

/** 已通過最終認證者：開啟認證單（列印／另存 PDF） */
export function openElpCertificationCertificate(student, { autoPrint = true } = {}) {
  const qs = new URLSearchParams(studentBody(student));
  if (autoPrint) qs.set('format', 'pdf');
  const url = `${STUDENT_BASE}/certification/certificate?${qs.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// —— 管理端 ——

export async function adminFetchPassports(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetchClient(`${ADMIN_BASE}?${qs}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '載入失敗');
  return data.data;
}

export async function adminFetchPassportDetail(token, id) {
  const res = await fetchClient(`${ADMIN_BASE}/${id}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '載入失敗');
  return data.data;
}

export async function adminApprovePassport(token, id) {
  const res = await fetchClient(`${ADMIN_BASE}/${id}/approve`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '核准失敗');
  return data.data;
}

export async function adminRejectPassport(token, id, reason) {
  const res = await fetchClient(`${ADMIN_BASE}/${id}/reject`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ reason }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '退回失敗');
  return data.data;
}

export async function adminFetchSubmissions(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetchClient(`${ADMIN_BASE}/submissions?${qs}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '載入失敗');
  return data.data;
}

export async function adminFetchSubmission(token, id) {
  const res = await fetchClient(`${ADMIN_BASE}/submissions/${id}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '載入失敗');
  return data.data;
}

export async function adminApproveSubmission(token, id, pointsApproved) {
  const res = await fetchClient(`${ADMIN_BASE}/submissions/${id}/approve`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ pointsApproved }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || data.code || '核准失敗');
  return data.data;
}

export async function adminRejectSubmission(token, id, reason) {
  const res = await fetchClient(`${ADMIN_BASE}/submissions/${id}/reject`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ reason }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '退回失敗');
  return data.data;
}

export async function adminFetchCertificationRequests(token) {
  const res = await fetchClient(`${ADMIN_BASE}/certification-requests`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '載入失敗');
  return data.data;
}

export async function adminApproveCertification(token, passportId) {
  const res = await fetchClient(`${ADMIN_BASE}/${passportId}/certification/approve`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '核准失敗');
  return data.data;
}

export async function adminRejectCertification(token, passportId, reason) {
  const res = await fetchClient(`${ADMIN_BASE}/${passportId}/certification/reject`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ reason }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '退回失敗');
  return data.data;
}

export async function adminFetchRules(token) {
  const res = await fetchClient(`${ADMIN_BASE}/rules`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '載入失敗');
  return data.data;
}

export async function adminUpdateRule(token, id, payload) {
  const res = await fetchClient(`${ADMIN_BASE}/rules/${id}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '更新失敗');
  rulesCache.data = null;
  rulesCache.ts = 0;
  return data.data;
}

export async function adminCreateRule(token, payload) {
  const res = await fetchClient(`${ADMIN_BASE}/rules`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '新增失敗');
  rulesCache.data = null;
  rulesCache.ts = 0;
  return data.data;
}

export async function adminDeleteRule(token, id) {
  const res = await fetchClient(`${ADMIN_BASE}/rules/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.message || '刪除失敗');
  rulesCache.data = null;
  rulesCache.ts = 0;
  return data.data;
}

export async function adminExportPassports(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetchClient(`${ADMIN_BASE}/export/xlsx?${qs}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('匯出失敗');
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  return { blob, fileName: match ? match[1] : 'english-learning-passports.xlsx' };
}

export const ELP_STATUS_LABELS = {
  pending: '待審核',
  active: '已核准',
  rejected: '已退回',
  revoked: '已停用',
  completed: '已完成認證',
  draft: '草稿',
  submitted: '待審核',
  approved: '已核准',
  cancelled: '已取消',
  none: '尚未申請',
  approved_cert: '已通過',
};

export const ELP_STORAGE_KEY = 'eears_elp_student';

export function loadElpStudent() {
  try {
    const raw = localStorage.getItem(ELP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveElpStudent(student) {
  localStorage.setItem(ELP_STORAGE_KEY, JSON.stringify(student));
}
