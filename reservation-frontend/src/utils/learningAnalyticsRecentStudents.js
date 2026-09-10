const STORAGE_KEY = 'la:recentStudents:v1';
const MAX_RECENT = 8;

function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @returns {Array<{ studentId: string, name?: string|null, at: string }>}
 */
export function readRecentStudents() {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY))
      .filter((row) => row && row.studentId)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentStudent({ studentId, name = null } = {}) {
  const sid = String(studentId || '').trim().toUpperCase();
  if (!sid || typeof window === 'undefined') return;
  try {
    const prev = readRecentStudents().filter((row) => row.studentId !== sid);
    const next = [
      {
        studentId: sid,
        name: name ? String(name) : null,
        at: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, MAX_RECENT);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

export function clearRecentStudents() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function studentTrajectoryPath(studentId) {
  const sid = String(studentId || '').trim().toUpperCase();
  return `/admin/learning-analytics/students/${encodeURIComponent(sid)}`;
}
