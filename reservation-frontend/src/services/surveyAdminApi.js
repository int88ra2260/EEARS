/**
 * 問卷後台 API 薄層：統一 token、fetchClient、錯誤處理。
 */
import { fetchClient } from '../utils/fetchClient';

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

async function throwIfNotOk(res, fallback = '請求失敗') {
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data.message || data.error || fallback);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function throwBlobIfNotOk(res, fallback = '匯出失敗') {
  if (res.ok) return res.blob();
  const data = await parseJson(res);
  const err = new Error(data.message || data.error || fallback);
  err.status = res.status;
  err.data = data;
  throw err;
}

/** 問卷中心 meta 選項 */
export async function fetchSurveyCenterOptions(token) {
  const res = await fetchClient('/api/admin/survey-center/meta/options', { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入問卷選項失敗');
}

// --- 問卷管理 (SurveyAdminModulePage) ---
export async function fetchAdminSurveys(token) {
  const res = await fetchClient('/api/admin/surveys', { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入問卷列表失敗');
}

export async function createAdminSurvey(token, payload) {
  const res = await fetchClient('/api/admin/surveys', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return throwIfNotOk(res, '建立問卷失敗');
}

export async function fetchSurveyVersions(token, surveyId) {
  const res = await fetchClient(`/api/admin/surveys/${surveyId}/versions`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入版本失敗');
}

export async function createSurveyVersion(token, surveyId, body = {}) {
  const res = await fetchClient(`/api/admin/surveys/${surveyId}/versions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return throwIfNotOk(res, '建立版本失敗');
}

export async function updateSurveyVersion(token, surveyId, versionId, body) {
  const res = await fetchClient(`/api/admin/surveys/${surveyId}/versions/${versionId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return throwIfNotOk(res, '更新版本失敗');
}

export async function publishSurveyVersion(token, surveyId, versionId) {
  const res = await fetchClient(`/api/admin/surveys/${surveyId}/versions/${versionId}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return throwIfNotOk(res, '發布版本失敗');
}

export async function exportSurveyJson(token, surveyId, userRole) {
  const headers = { Authorization: `Bearer ${token}` };
  if (userRole) headers['X-User-Role'] = userRole;
  const res = await fetchClient(`/api/admin/surveys/${surveyId}/export/json`, { headers });
  return throwBlobIfNotOk(res, '匯出問卷失敗');
}

// --- 問卷統計 ---
export async function fetchSurveyAnalyticsSummary(token, surveyId) {
  const res = await fetchClient(`/api/admin/surveys/${surveyId}/analytics/summary`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入統計摘要失敗');
}

export async function fetchSurveyAnalyticsQuestions(token, surveyId) {
  const res = await fetchClient(`/api/admin/surveys/${surveyId}/analytics/questions`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入題目統計失敗');
}

export async function fetchSurveyStats(token, surveyId) {
  const res = await fetchClient(`/api/admin/surveys/stats/${surveyId}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入問卷統計失敗');
}

export async function exportSurveyData(token, surveyId) {
  const res = await fetchClient(`/api/admin/surveys/export/${surveyId}`, { headers: authHeaders(token) });
  return throwBlobIfNotOk(res, '匯出失敗');
}

// --- 問卷分析中心 ---
export async function fetchSurveyAnalyticsBundle(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const base = `/api/admin/surveys/analytics`;
  const [overviewRes, distRes, trendsRes, compRes, openRes] = await Promise.all([
    fetchClient(`${base}/overview?${qs}`, { headers: authHeaders(token) }),
    fetchClient(`${base}/distribution?${qs}`, { headers: authHeaders(token) }),
    fetchClient(`${base}/trends?${qs}`, { headers: authHeaders(token) }),
    fetchClient(`${base}/comparison?${qs}`, { headers: authHeaders(token) }),
    fetchClient(`${base}/open-text-summary?${qs}`, { headers: authHeaders(token) }),
  ]);
  return {
    overview: await throwIfNotOk(overviewRes, '載入總覽失敗'),
    distribution: await throwIfNotOk(distRes, '載入分布失敗'),
    trends: await throwIfNotOk(trendsRes, '載入趨勢失敗'),
    comparison: await throwIfNotOk(compRes, '載入比較失敗'),
    openTextSummary: await throwIfNotOk(openRes, '載入開放題摘要失敗'),
  };
}

export async function exportSurveyAnalyticsXlsx(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`/api/admin/surveys/analytics/export/xlsx?${qs}`, { headers: authHeaders(token) });
  return throwBlobIfNotOk(res, '匯出失敗');
}

// --- 填答紀錄 ---
export async function fetchSurveyResponses(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`/api/admin/survey-responses?${qs}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入填答紀錄失敗');
}

export async function fetchSurveyResponseById(token, id) {
  const res = await fetchClient(`/api/admin/survey-responses/${id}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入填答詳情失敗');
}

export async function fetchSurveyResponsesStats(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`/api/admin/survey-responses/stats/basic?${qs}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入填答統計失敗');
}

export async function fetchSurveyResponsesExport(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`/api/admin/survey-responses/export/xlsx?${qs}`, { headers: authHeaders(token) });
  return throwBlobIfNotOk(res, '匯出失敗');
}

export async function fetchSurveyGateGaps(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`/api/admin/survey-gate/gaps?${qs}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入 gate gaps 失敗');
}

export async function exportSurveyGateGapsXlsx(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`/api/admin/survey-gate/gaps/export/xlsx?${qs}`, { headers: authHeaders(token) });
  return throwBlobIfNotOk(res, '匯出失敗');
}

export async function fetchSurveyResponsesBySurveyId(token, surveyId, limit = 50) {
  const res = await fetchClient(`/api/admin/surveys/${surveyId}/responses?limit=${limit}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入填答失敗');
}

// --- 答案對照 ---
export async function fetchAnswerMappings(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`/api/admin/surveys/answer-mappings?${qs}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入答案對照失敗');
}

export async function saveAnswerMapping(token, { method, url, payload }) {
  const res = await fetchClient(url, { method, headers: authHeaders(token), body: JSON.stringify(payload) });
  return throwIfNotOk(res, '儲存答案對照失敗');
}

export async function approveAnswerMapping(token, id, body = {}) {
  const res = await fetchClient(`/api/admin/surveys/answer-mappings/${id}/approve`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return throwIfNotOk(res, '核准失敗');
}

export async function rejectAnswerMapping(token, id, body = {}) {
  const res = await fetchClient(`/api/admin/surveys/answer-mappings/${id}/reject`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return throwIfNotOk(res, '拒絕失敗');
}

export async function proposeAnswerMappings(token, body) {
  const res = await fetchClient('/api/admin/surveys/answer-mappings/proposals', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return throwIfNotOk(res, '提案失敗');
}

export async function createAnswerMappings(token, body) {
  const res = await fetchClient('/api/admin/surveys/answer-mappings', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return throwIfNotOk(res, '建立對照失敗');
}

// --- 資料健康 ---
export async function fetchSurveyHealthBundle(token) {
  const headers = authHeaders(token);
  const [optRes, a, b, c, d, e] = await Promise.all([
    fetchClient('/api/admin/survey-center/meta/options', { headers }),
    fetchClient('/api/admin/surveys/health/overview', { headers }),
    fetchClient('/api/admin/surveys/health/problems', { headers }),
    fetchClient('/api/admin/surveys/health/rules', { headers }),
    fetchClient('/api/admin/surveys/health/readiness', { headers }),
    fetchClient('/api/admin/surveys/health/recent-runs', { headers }),
  ]);
  const [optData, oa, ob, oc, od, oe] = await Promise.all([
    throwIfNotOk(optRes, '載入問卷選項失敗'),
    throwIfNotOk(a, '載入健康總覽失敗'),
    throwIfNotOk(b, '載入問題清單失敗'),
    throwIfNotOk(c, '載入規則失敗'),
    throwIfNotOk(d, '載入就緒狀態失敗'),
    throwIfNotOk(e, '載入修復紀錄失敗'),
  ]);
  return {
    options: { surveys: optData.surveys || [] },
    overview: oa,
    problems: ob,
    rules: oc,
    readiness: od,
    runs: Array.isArray(oe) ? oe : [],
  };
}

export async function runSurveyRepair(token, { type, executeMode, confirmPhrase }) {
  const endpoint = executeMode
    ? `/api/admin/surveys/repairs/execute/${type}`
    : `/api/admin/surveys/repairs/preview/${type}`;
  const payload = executeMode
    ? { mode: 'execute', confirmExecute: true, confirmPhrase }
    : { mode: 'dry_run' };
  const res = await fetchClient(endpoint, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return throwIfNotOk(res, '修復執行失敗');
}

export async function fetchSurveyRepairRun(token, id) {
  const res = await fetchClient(`/api/admin/surveys/repairs/runs/${id}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '紀錄詳情載入失敗');
}

// --- 啟用規則 ---
export async function fetchSurveyRules(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`/api/admin/survey-rules?${qs}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '載入規則失敗');
}

export async function saveSurveyRule(token, { method, url, payload }) {
  const res = await fetchClient(url, { method, headers: authHeaders(token), body: JSON.stringify(payload) });
  return throwIfNotOk(res, '儲存規則失敗');
}

export async function deleteSurveyRule(token, id) {
  const res = await fetchClient(`/api/admin/survey-rules/${id}`, { method: 'DELETE', headers: authHeaders(token) });
  return throwIfNotOk(res, '刪除規則失敗');
}

export async function queryEffectiveSurveyRules(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`/api/admin/survey-rules/effective/query?${qs}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '查詢有效規則失敗');
}

export async function simulateSurveyRules(token, queryParams) {
  const qs = queryParams instanceof URLSearchParams ? queryParams.toString() : new URLSearchParams(queryParams).toString();
  const res = await fetchClient(`/api/admin/survey-rules/simulate/query?${qs}`, { headers: authHeaders(token) });
  return throwIfNotOk(res, '模擬規則失敗');
}

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
