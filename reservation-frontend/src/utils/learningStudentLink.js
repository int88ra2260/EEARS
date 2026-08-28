const STORAGE_KEY = 'eears_voluntary_student_id';

export function setVoluntaryStudentId(studentId) {
  if (typeof window === 'undefined') return;
  const id = String(studentId || '').trim();
  if (!id) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function getVoluntaryStudentId() {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
