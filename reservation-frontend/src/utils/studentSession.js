import { clearReservationIdentity, saveReservationIdentity } from './studentIdentityStorage';
import { saveStudentTrio } from './studentTrioStorage';

const TOKEN_KEY = 'eears-student-token';
const PROFILE_KEY = 'eears-student-profile:v1';

function readProfile() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!token || !raw) return null;
    const student = JSON.parse(raw);
    if (!student?.studentId || !student?.name || !student?.email) return null;
    return { token, student };
  } catch {
    return null;
  }
}

export function loadStudentSession() {
  if (typeof window === 'undefined') return null;
  return readProfile();
}

export function saveStudentSession({ token, student }) {
  if (typeof window === 'undefined') return;
  const profile = {
    id: student.id,
    studentId: String(student.studentId || '').trim(),
    name: String(student.name || '').trim(),
    email: String(student.email || '').trim(),
    ssoLinked: Boolean(student.ssoLinked),
    ssoProvider: student.ssoProvider || null,
  };
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  const identity = {
    studentId: profile.studentId,
    studentName: profile.name,
    studentEmail: profile.email,
  };
  saveReservationIdentity(identity);
  saveStudentTrio(identity);
  window.dispatchEvent(new Event('eears-student-session'));
}

export function clearStudentSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem('lastStudentId');
    localStorage.removeItem('lastStudentName');
    localStorage.removeItem('lastStudentEmail');
  } catch {
    /* ignore */
  }
  clearReservationIdentity();
  window.dispatchEvent(new Event('eears-student-session'));
}

export function getStudentToken() {
  return loadStudentSession()?.token || '';
}

export function withStudentAuth(init = {}) {
  const headers = new Headers(init.headers || {});
  const token = getStudentToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

export function applyStudentIdentityToFormData(formData) {
  const session = loadStudentSession();
  if (!session || !(formData instanceof FormData)) return formData;
  formData.set('studentId', session.student.studentId);
  formData.set('name', session.student.name);
  return formData;
}

/** 只允許站內相對路徑，避免登入後被帶到外部網址。 */
export function safeStudentNext(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/my-reservations';
  }
  if (
    raw.startsWith('/admin')
    || raw.startsWith('/login')
    || raw.startsWith('/student/login')
    || raw.startsWith('/student/register')
    || raw.startsWith('/student/forgot-password')
  ) {
    return '/my-reservations';
  }
  return raw;
}
