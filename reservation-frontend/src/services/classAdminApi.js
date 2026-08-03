/**
 * 班級管理 API 薄層：總覽、匯出、名冊匯入、刪除。
 */
import { fetchClient } from '../utils/fetchClient';
import { downloadBlob } from './englishTestApi';

const BASE = '/api/admin/classes';

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export async function fetchClassOverview(token, filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  const res = await fetchClient(`${BASE}/overview?${params}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.message || data.error || '載入資料失敗');
  }
  return {
    data: data.data || [],
    pagination: data.pagination || { total: 0, totalPages: 0 },
  };
}

export async function exportClassOverview(token, semester) {
  const params = new URLSearchParams({ semester });
  const res = await fetchClient(`${BASE}/overview/export?${params}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data.error || '匯出失敗');
  }
  return res.blob();
}

export async function downloadClassRosterSample(token) {
  const res = await fetchClient(`${BASE}/sample`, { headers: authHeaders(token) });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data.error || '下載範例檔案失敗');
  }
  return res.blob();
}

export async function importClassRoster(token, {
  file,
  semester,
  courseName,
  courseCode,
  teacherName,
  className,
}) {
  const formData = new FormData();
  formData.append('file', file);
  const qs = new URLSearchParams({
    semester,
    teacherName: String(teacherName || '').trim(),
  });
  if (courseName) qs.set('courseName', String(courseName).trim());
  if (courseCode) qs.set('courseCode', String(courseCode).trim());
  if (className) qs.set('className', String(className).trim());
  const res = await fetchClient(`${BASE}/roster/import?${qs}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || '上傳失敗');
  }
  return data;
}

export async function previewClassRosterPdf(token, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchClient(`${BASE}/roster/import-pdf/preview`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || 'PDF 解析失敗');
  }
  return data;
}

export async function importClassRosterPdf(token, {
  file,
  semester,
  courseName,
  courseCode,
  teacherName,
}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('semester', String(semester || '').trim());
  formData.append('courseName', String(courseName || '').trim());
  formData.append('courseCode', String(courseCode || '').trim());
  formData.append('teacherName', String(teacherName || '').trim());
  const res = await fetchClient(`${BASE}/roster/import-pdf`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || 'PDF 匯入失敗');
  }
  return data;
}

export async function deleteClass(token, classId) {
  const res = await fetchClient(`${BASE}/${classId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data.error || '刪除班級失敗');
  }
  return data;
}

export async function fetchClassDetailOverview(token, classId, filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  const res = await fetchClient(`${BASE}/${classId}/overview?${params}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入資料失敗');
  return data;
}

export async function exportClassDetailOverview(token, classId, { semester, activityType }) {
  const params = new URLSearchParams({ semester, activityType });
  const res = await fetchClient(`${BASE}/${classId}/overview/export?${params}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data.error || '匯出失敗');
  }
  return res.blob();
}

export async function fetchClassBestepOverview(token, classId, filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.append(key, value);
  });
  const res = await fetchClient(`${BASE}/${classId}/bestep-overview?${params}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入資料失敗');
  return data;
}

export async function exportClassBestepOverview(token, classId, { semester, examType, search }) {
  const params = new URLSearchParams({ semester, examType });
  if (search) params.append('search', search);
  const res = await fetchClient(`${BASE}/${classId}/bestep-overview/export?${params}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data.error || data.message || '匯出失敗');
  }
  return res.blob();
}

export { downloadBlob };
