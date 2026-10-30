import { fetchClient } from '../utils/fetchClient';
import { withStudentAuth } from '../utils/studentSession';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export async function sendStudentEmailVerification({ email, studentId }) {
  const res = await fetchClient('/api/student-auth/email-verification/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, studentId }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function verifyStudentEmailCode({ email, code }) {
  const res = await fetchClient('/api/student-auth/email-verification/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function registerStudentAccount(payload) {
  const res = await fetchClient('/api/student-auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function fetchStudentLoginOptions() {
  const res = await fetchClient('/api/student-auth/login-options');
  const data = await parseJson(res);
  return { ok: res.ok, data };
}

export async function loginStudentAccount(studentId, password) {
  const res = await fetchClient('/api/student-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, password }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function sendStudentPasswordReset(studentId) {
  const res = await fetchClient('/api/student-auth/password-reset/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId }),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function confirmStudentPasswordReset(payload) {
  const res = await fetchClient('/api/student-auth/password-reset/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function completeCampusEmailSetup(payload) {
  const res = await fetchClient('/api/student-auth/campus-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function fetchCampusProfile() {
  const res = await fetchClient('/api/student-auth/campus-profile', withStudentAuth());
  const data = await parseJson(res);
  return { ok: res.ok, data };
}

export async function refreshCampusProfile(password) {
  const res = await fetchClient('/api/student-auth/campus-profile', withStudentAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }));
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function changeStudentNotificationEmail(payload) {
  const res = await fetchClient('/api/student-auth/email', withStudentAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function changeStudentPassword(payload) {
  const res = await fetchClient('/api/student-auth/password', withStudentAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}
