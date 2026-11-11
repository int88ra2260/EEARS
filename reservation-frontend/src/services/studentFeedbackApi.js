import { fetchClient } from '../utils/fetchClient';
import { withStudentAuth } from '../utils/studentSession';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

function studentRequest(path, options = {}) {
  return fetchClient(path, withStudentAuth({
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  }));
}

function staffRequest(token, path, options = {}) {
  return fetchClient(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
}

export async function submitStudentFeedback(payload) {
  const res = await studentRequest('/api/student/feedback', {
    method: 'POST',
    body: JSON.stringify({
      kind: payload.kind,
      category: payload.category,
      message: payload.message,
      replyRequested: payload.replyRequested,
    }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function fetchMyStudentFeedback(page = 1) {
  const res = await studentRequest(`/api/student/feedback?page=${encodeURIComponent(page)}`);
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function fetchMyStudentFeedbackDetail(id) {
  const res = await studentRequest(`/api/student/feedback/${encodeURIComponent(id)}`);
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function postMyStudentFeedbackMessage(id, message) {
  const res = await studentRequest(`/api/student/feedback/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function fetchAdminStudentFeedback(token, query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const res = await staffRequest(token, `/api/admin/student-feedback${suffix}`);
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function fetchAdminStudentFeedbackDetail(token, id) {
  const res = await staffRequest(token, `/api/admin/student-feedback/${encodeURIComponent(id)}`);
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function fetchFeedbackAssignees(token) {
  const res = await staffRequest(token, '/api/admin/student-feedback/assignees');
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function postAdminStudentFeedbackReply(token, id, message) {
  const res = await staffRequest(token, `/api/admin/student-feedback/${encodeURIComponent(id)}/replies`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function postAdminStudentFeedbackNote(token, id, message) {
  const res = await staffRequest(token, `/api/admin/student-feedback/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function patchAdminStudentFeedback(token, id, patch) {
  const res = await staffRequest(token, `/api/admin/student-feedback/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}
