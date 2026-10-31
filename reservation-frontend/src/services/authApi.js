/**
 * 後台登入與密碼 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

/**
 * 取得登入選項（是否有 SSO 可用）
 */
export async function getLoginInfo() {
  try {
    const res = await fetchClient('/api/login/info');
    const data = await parseJson(res);
    return res.ok && data.success ? data.data : null;
  } catch {
    return null;
  }
}

/**
 * 本地帳號登入
 */
export async function login(username, password) {
  const res = await fetchClient('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

/**
 * SSO 登入（中山單一入口）
 */
export async function loginSso(username, password) {
  const res = await fetchClient('/api/login/sso', {
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
