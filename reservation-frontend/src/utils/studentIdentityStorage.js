const RESERVATION_IDENTITY_KEY = 'eears-reservation-identity:v1';

export function loadReservationIdentity() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RESERVATION_IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.studentId || !parsed?.studentName || !parsed?.studentEmail) return null;
    return {
      studentId: String(parsed.studentId),
      studentName: String(parsed.studentName),
      studentEmail: String(parsed.studentEmail),
    };
  } catch {
    return null;
  }
}

export function clearReservationIdentity() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RESERVATION_IDENTITY_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('eears-student-identity'));
  }
}

export function saveReservationIdentity(identity) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      RESERVATION_IDENTITY_KEY,
      JSON.stringify({
        studentId: String(identity.studentId || '').trim(),
        studentName: String(identity.studentName || '').trim(),
        studentEmail: String(identity.studentEmail || '').trim(),
      }),
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('eears-student-identity'));
    }
  } catch {
    /* ignore quota / private mode */
  }
}
