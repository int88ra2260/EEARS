/**
 * ET 能力分組 API
 */
import { fetchClient } from '../utils/fetchClient';

const API_BASE = '/api/admin/et-grouping';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

async function handleResponse(res, fallback) {
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data.message || data.error || fallback);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data.data ?? data;
}

export async function fetchEtGroupingBands(token, { semesterId } = {}) {
  const qs = semesterId != null ? `?semesterId=${semesterId}` : '';
  const res = await fetchClient(`${API_BASE}/bands${qs}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入分組帶設定失敗');
}

export async function saveEtGroupingBands(token, bands, { semesterId } = {}) {
  const res = await fetchClient(`${API_BASE}/bands`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ bands, semesterId }),
  });
  return handleResponse(res, '儲存分組帶設定失敗');
}

export async function fetchEventGrouping(token, eventId) {
  const res = await fetchClient(`${API_BASE}/events/${eventId}/grouping`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入分組資料失敗');
}

export async function generateEventGrouping(token, eventId, {
  force = false,
  groupSlots = null,
  groupingLayout = 'physical_slots',
} = {}) {
  const res = await fetchClient(`${API_BASE}/events/${eventId}/grouping/generate`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ force, groupSlots, groupingLayout }),
  });
  return handleResponse(res, '自動分組失敗');
}

export async function patchEventGroupingAssignments(token, eventId, patches) {
  const res = await fetchClient(`${API_BASE}/events/${eventId}/grouping/assignments`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ patches }),
  });
  return handleResponse(res, '更新分組失敗');
}

export async function publishEventGrouping(token, eventId) {
  const res = await fetchClient(`${API_BASE}/events/${eventId}/grouping/publish`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return handleResponse(res, '發布分組失敗');
}

export async function fetchEtLeaderCandidates(token) {
  const res = await fetchClient(`${API_BASE}/leaders/candidates`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入 Leader 候選名單失敗');
}

export async function assignEventGroupLeaders(token, eventId, assignments, { rememberPreference = false } = {}) {
  const res = await fetchClient(`${API_BASE}/events/${eventId}/group-leaders`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignments, rememberPreference }),
  });
  return handleResponse(res, '指派 Leader 失敗');
}

export async function applyEventLeaderPreferences(token, eventId) {
  const res = await fetchClient(`${API_BASE}/events/${eventId}/group-leaders/apply-preferences`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return handleResponse(res, '套用學期 Leader 偏好失敗');
}

export async function applyEventLeaderPreferencesBatch(token, eventIds) {
  const res = await fetchClient(`${API_BASE}/leader-preferences/apply-batch`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventIds }),
  });
  return handleResponse(res, '批次套用學期 Leader 偏好失敗');
}

export async function fetchEtLeaderPreferences(token, { semesterId } = {}) {
  const qs = semesterId != null ? `?semesterId=${semesterId}` : '';
  const res = await fetchClient(`${API_BASE}/leader-preferences${qs}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入 Leader 偏好失敗');
}

export async function saveEtLeaderPreferences(token, preferences, { semesterId } = {}) {
  const res = await fetchClient(`${API_BASE}/leader-preferences`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences, semesterId }),
  });
  return handleResponse(res, '儲存 Leader 偏好失敗');
}

export async function fetchLeaderManagementEvents(token, { semester, date } = {}) {
  const params = new URLSearchParams();
  if (semester && semester !== 'all') params.append('semester', semester);
  if (date) params.append('date', date);
  const qs = params.toString() ? `?${params}` : '';
  const res = await fetchClient(`${API_BASE}/leader-management/events${qs}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入 Leader 管理場次失敗');
}

export async function fetchMyLeaderSessions(token, { semester } = {}) {
  const qs = semester && semester !== 'all' ? `?semester=${encodeURIComponent(semester)}` : '';
  const res = await fetchClient(`${API_BASE}/my-sessions${qs}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入我的帶班場次失敗');
}

export async function fetchEtGroupingReportsSummary(token, { semester, date, dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  if (semester && semester !== 'all') params.append('semester', semester);
  if (date) params.append('date', date);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  const qs = params.toString() ? `?${params}` : '';
  const res = await fetchClient(`${API_BASE}/reports/summary${qs}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入場次報表失敗');
}

function parseFilenameFromDisposition(headerValue) {
  if (!headerValue) return null;
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(headerValue);
  return match ? decodeURIComponent(match[1]) : null;
}

export function downloadEtBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function exportEventEtGrouping(token, eventId) {
  const res = await fetchClient(`${API_BASE}/events/${eventId}/export`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data.message || data.error || '匯出 ET 分組報表失敗');
  }
  const blob = await res.blob();
  const filename = parseFilenameFromDisposition(res.headers.get('Content-Disposition'))
    || `et-grouping-${eventId}.xlsx`;
  return { blob, filename };
}

export async function exportEtGroupingReports(token, { semester, date, dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  if (semester && semester !== 'all') params.append('semester', semester);
  if (date) params.append('date', date);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  const qs = params.toString() ? `?${params}` : '';
  const res = await fetchClient(`${API_BASE}/reports/export${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data.message || data.error || '匯出場次報表失敗');
  }
  const blob = await res.blob();
  return { blob, filename: 'et-grouping-reports.xlsx' };
}

export async function fetchEtTaskTemplate(token, { semesterId } = {}) {
  const qs = semesterId != null ? `?semesterId=${semesterId}` : '';
  const res = await fetchClient(`${API_BASE}/task-templates${qs}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入任務模板失敗');
}

export async function saveEtTaskTemplate(token, items, { semesterId } = {}) {
  const res = await fetchClient(`${API_BASE}/task-templates`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, semesterId }),
  });
  return handleResponse(res, '儲存任務模板失敗');
}

export async function fetchEventTaskMarks(token, eventId) {
  const res = await fetchClient(`${API_BASE}/events/${eventId}/task-marks`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入任務勾選失敗');
}

export async function saveEventTaskMarks(token, eventId, marks) {
  const res = await fetchClient(`${API_BASE}/events/${eventId}/task-marks`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ marks }),
  });
  return handleResponse(res, '儲存任務勾選失敗');
}

export async function fetchStudentEtInsights(token, studentId) {
  const res = await fetchClient(`${API_BASE}/students/${encodeURIComponent(studentId)}/insights`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入 ET 參與紀錄失敗');
}

export async function fetchStudentEtTrends(token, studentId, { semester } = {}) {
  const params = new URLSearchParams({ studentId });
  if (semester && semester !== 'all') params.append('semester', semester);
  const res = await fetchClient(`${API_BASE}/reports/student-trends?${params}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入 ET 學期趨勢失敗');
}

export async function fetchStudentEtRecommendations(token, studentId, { limit = 5 } = {}) {
  const qs = limit != null ? `?limit=${encodeURIComponent(limit)}` : '';
  const res = await fetchClient(`${API_BASE}/students/${encodeURIComponent(studentId)}/recommendations${qs}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, '載入活動建議失敗');
}
