import { fetchClient } from '../utils/fetchClient';

/**
 * 學生進度統一讀取 API
 * @param {{ studentId: string, studentName: string, studentEmail: string }} identity
 */
export async function fetchStudentProgress(identity) {
  const qs = new URLSearchParams({
    studentId: identity.studentId || '',
    studentName: identity.studentName || '',
    studentEmail: identity.studentEmail || '',
  });
  const res = await fetchClient(`/api/student-progress?${qs}`);
  const json = await res.json().catch(() => ({}));
  const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;

  if (!res.ok) {
    const msg = json?.message || json?.error || '查詢失敗';
    const err = new Error(requestId ? `${msg}（錯誤識別碼：${requestId}）` : msg);
    err.requestId = requestId;
    err.status = res.status;
    throw err;
  }

  return {
    found: !!json.found,
    message: json.message,
    data: json.data || null,
  };
}
