const STAFF_NEXT_KEY = 'eears.staffLoginNext';

export function safeStaffNext(raw) {
  if (typeof raw !== 'string' || raw.startsWith('//') || raw.includes('\\') || raw.includes('://')) return '';
  let url;
  try {
    url = new URL(raw, 'http://staff.local');
  } catch {
    return '';
  }
  if (url.origin !== 'http://staff.local') return '';
  if (url.pathname !== '/admin' && !url.pathname.startsWith('/admin/')) return '';
  return `${url.pathname}${url.search}`;
}

export function rememberStaffNext(raw) {
  const next = safeStaffNext(raw);
  try {
    if (next) sessionStorage.setItem(STAFF_NEXT_KEY, next);
    else sessionStorage.removeItem(STAFF_NEXT_KEY);
  } catch {
    // 私密瀏覽可能無法寫入
  }
  return next;
}

export function consumeStaffNext() {
  let stored = '';
  try {
    stored = sessionStorage.getItem(STAFF_NEXT_KEY) || '';
    sessionStorage.removeItem(STAFF_NEXT_KEY);
  } catch {
    stored = '';
  }
  return safeStaffNext(stored);
}

export function staffLoginPath(nextPath) {
  const next = safeStaffNext(nextPath);
  if (!next) return '/login';
  return `/login?next=${encodeURIComponent(next)}`;
}
