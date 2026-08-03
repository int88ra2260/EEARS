/**
 * 帳號管理 API 薄層：統一 token、fetchClient、錯誤處理。
 */
import { fetchClient } from '../utils/fetchClient';
import { buildTeacherListParams } from '../utils/accountManagementHelpers';

const BASE = '/api/admin/teachers';

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

function throwTeacherMutationError(data, fallback) {
  const msg =
    data.code === 'WEAK_PASSWORD' || data.code === 'PASSWORD_POLICY_VIOLATION'
      ? (data.error || data.message)
      : data.code === 'PERMISSION_ASSIGNMENT_DENIED' && data.error
        ? data.error
        : data.error || fallback;
  const err = new Error(msg);
  err.code = data.code;
  err.data = data;
  throw err;
}

export async function fetchTeachers(token, filters) {
  const params = buildTeacherListParams(filters);
  const res = await fetchClient(`${BASE}?${params.toString()}`, { headers: authHeaders(token) });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || '載入帳號資料失敗');
  }
  return data.data || [];
}

export async function createTeacher(token, body) {
  const res = await fetchClient(BASE, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throwTeacherMutationError(data, '建立帳號失敗');
  }
  return data.data;
}

export async function updateTeacher(token, teacherId, body) {
  const res = await fetchClient(`${BASE}/${teacherId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throwTeacherMutationError(data, '更新失敗');
  }
  return data.data;
}

export async function deleteTeacher(token, teacherId) {
  const res = await fetchClient(`${BASE}/${teacherId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throwTeacherMutationError(data, '刪除帳號失敗');
  }
  return data.data;
}

export async function resetTeacherPassword(token, teacherId) {
  const res = await fetchClient(`${BASE}/${teacherId}/reset-password`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || '重設密碼失敗');
  }
  return data.data;
}

export async function fetchTeacherAccessDebug(token, teacherId) {
  const res = await fetchClient(`${BASE}/${teacherId}/access-debug`, {
    headers: authHeaders(token),
  });
  const body = await parseJson(res);
  if (res.status === 403) {
    const err = new Error('您沒有檢視權限來源的權限。');
    err.code = 'ACCESS_DEBUG_FORBIDDEN';
    throw err;
  }
  if (res.status === 404) {
    const err = new Error('找不到此帳號。');
    err.code = 'ACCESS_DEBUG_NOT_FOUND';
    throw err;
  }
  if (!res.ok || !body.success) {
    throw new Error(body.error || `載入失敗（${res.status}）`);
  }
  return body.data || null;
}
