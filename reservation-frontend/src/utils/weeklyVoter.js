const VOTER_STORAGE_KEY = 'eears-weekly-voter-id';

function randomId() {
  return `wv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getWeeklyVoterId() {
  try {
    const existing = localStorage.getItem(VOTER_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = randomId();
    localStorage.setItem(VOTER_STORAGE_KEY, next);
    return next;
  } catch {
    return randomId();
  }
}

export function hasWeeklyRead(slug) {
  try {
    return localStorage.getItem(`eears-weekly-read:${slug}`) === '1';
  } catch {
    return false;
  }
}

export function markWeeklyReadLocal(slug) {
  try {
    localStorage.setItem(`eears-weekly-read:${slug}`, '1');
  } catch {
    // ignore
  }
}
