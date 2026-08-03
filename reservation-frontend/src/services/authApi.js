/**
 * 後台登入與密碼 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export async function login(username, password) {
  const res = await fetchClient('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function changeTeacherPassword(token, { currentPassword, newPassword }) {
  const res = await fetchClient('/api/teachers/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    const policyMsg =
      (data.code === 'WEAK_PASSWORD' || data.code === 'PASSWORD_POLICY_VIOLATION')
        ? (data.error || data.message)
        : null;
    const err = new Error(policyMsg || data.error || '更新密碼失敗');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
