/**
 * 學生資料 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';

function getRequestId(res) {
  return res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
}

export async function fetchStudentProfile(token, studentId, queryParams) {
  const qs = queryParams instanceof URLSearchParams
    ? queryParams.toString()
    : new URLSearchParams(queryParams).toString();
  const suffix = qs ? `?${qs}` : '';
  const res = await fetchClient(`/api/students/${encodeURIComponent(studentId)}/profile${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const requestId = getRequestId(res);
    const msg = json?.error || json?.message || '載入失敗';
    const err = new Error(msg);
    err.requestId = requestId;
    err.status = res.status;
    if (requestId) err.message = `${msg}（錯誤識別碼：${requestId}）`;
    throw err;
  }
  return json;
}
