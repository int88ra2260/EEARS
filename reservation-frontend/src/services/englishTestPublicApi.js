/**
 * 培力英檢學生端 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';
import { applyStudentIdentityToFormData, loadStudentSession, withStudentAuth } from '../utils/studentSession';
import {
  fetchEnglishTestRegistrationEnabledPublic,
  fetchEnglishTestRegistrationGroupEnabledPublic,
  fetchEnglishTestRegistrationEditEnabledPublic,
} from './settingsAdminApi';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export { fetchEnglishTestRegistrationEnabledPublic as fetchRegistrationEnabled };
export { fetchEnglishTestRegistrationGroupEnabledPublic as fetchRegistrationGroupEnabled };
export { fetchEnglishTestRegistrationEditEnabledPublic as fetchRegistrationEditEnabled };

export async function queryEnglishTestRegistration(body) {
  const session = loadStudentSession();
  const payload = session
    ? { ...body, studentId: session.student.studentId, name: session.student.name }
    : body;
  const res = await fetchClient('/api/english-test/registrations/query', withStudentAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function registerEnglishTest(formData) {
  const res = await fetchClient('/api/english-test/register', withStudentAuth({
    method: 'POST',
    body: applyStudentIdentityToFormData(formData),
  }));
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function updateEnglishTestRegistration(formData) {
  const res = await fetchClient('/api/english-test/registrations/update', withStudentAuth({
    method: 'PUT',
    body: applyStudentIdentityToFormData(formData),
  }));
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function sendEnglishTestEmailVerificationCode({ email, studentId } = {}) {
  const res = await fetchClient('/api/english-test/email-verification/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, studentId }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function verifyEnglishTestEmailCode({ email, code } = {}) {
  const res = await fetchClient('/api/english-test/email-verification/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}
