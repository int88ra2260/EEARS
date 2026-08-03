/**
 * 培力英檢學生端 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';
import { fetchEnglishTestRegistrationEnabledPublic } from './settingsAdminApi';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export { fetchEnglishTestRegistrationEnabledPublic as fetchRegistrationEnabled };

export async function queryEnglishTestRegistration(body) {
  const res = await fetchClient('/api/english-test/registrations/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function registerEnglishTest(formData) {
  const res = await fetchClient('/api/english-test/register', {
    method: 'POST',
    body: formData,
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function updateEnglishTestRegistration(formData) {
  const res = await fetchClient('/api/english-test/registrations/update', {
    method: 'PUT',
    body: formData,
  });
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
