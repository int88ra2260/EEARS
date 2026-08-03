/**
 * 培力英檢報名表單 schema API
 */
import { fetchClient } from '../utils/fetchClient';

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

/** 公開：學生端載入已發布表單 */
export async function fetchPublicEnglishTestFormSchema() {
  const res = await fetchClient('/api/english-test/form-schema');
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入報名表單失敗');
  return data.data;
}

/** 管理端：檢視表單 */
export async function fetchAdminEnglishTestFormSchema(token) {
  const res = await fetchClient('/api/english-test/admin/form-schema', {
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '載入報名表單失敗');
  return data.data;
}

/** 管理端：儲存完整 schema */
export async function saveAdminEnglishTestFormSchema(token, { schema, changeSummary } = {}) {
  const res = await fetchClient('/api/english-test/admin/form-schema', {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ schema, changeSummary }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data.error || '儲存失敗');
    err.code = data.code;
    throw err;
  }
  return data.data;
}

/** 管理端：重設為系統預設 */
export async function resetAdminEnglishTestFormSchema(token) {
  const res = await fetchClient('/api/english-test/admin/form-schema/reset', {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '重設失敗');
  return data.data;
}
