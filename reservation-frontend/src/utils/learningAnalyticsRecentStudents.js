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

export function studentTrajectoryPath(studentId, returnTo = '') {
  const sid = String(studentId || '').trim().toUpperCase();
  const path = `/admin/learning-analytics/students/${encodeURIComponent(sid)}`;
  const back = String(returnTo || '');
  if (!back.startsWith('/admin/learning-analytics/') || back.startsWith('/admin/learning-analytics/students/')) {
    return path;
  }
  return `${path}?returnTo=${encodeURIComponent(back)}`;
}

const LIST_SCROLL_KEY = 'eears.la.findStudents.scroll.v1';

export function rememberFindListScroll() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LIST_SCROLL_KEY, JSON.stringify({
      path: `${window.location.pathname}${window.location.search}`,
      y: window.scrollY,
    }));
  } catch {
    // 私密瀏覽寫不進 session 時，返回仍回到來源網址。
  }
}

export function restoreFindListScroll() {
  if (typeof window === 'undefined') return;
  try {
    const saved = JSON.parse(sessionStorage.getItem(LIST_SCROLL_KEY) || 'null');
    const here = `${window.location.pathname}${window.location.search}`;
    if (!saved || saved.path !== here) return;
    sessionStorage.removeItem(LIST_SCROLL_KEY);
    const y = Number(saved.y) || 0;
    const apply = () => window.scrollTo(0, y);
    apply();
    window.requestAnimationFrame(apply);
    window.setTimeout(apply, 50);
    window.setTimeout(apply, 180);
  } catch {
    // 舊資料壞掉就留在頁首。
  }
}
