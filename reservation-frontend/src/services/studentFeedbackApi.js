import { fetchClient } from '../utils/fetchClient';
import { withStudentAuth } from '../utils/studentSession';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export async function submitStudentFeedback(payload) {
  const res = await fetchClient('/api/student/feedback', withStudentAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: payload.kind,
      category: payload.category,
      message: payload.message,
    }),
  }));
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function fetchAdminStudentFeedback(token, kind) {
  const params = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const res = await fetchClient(`/api/admin/student-feedback${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}
