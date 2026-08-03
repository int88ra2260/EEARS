/**
 * 以 sessionStorage 固定種子，讓同一瀏覽分頁內的洗牌結果穩定（重新整理仍會重洗）。
 */

function hashSeed(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(String(seed));
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithSeed(items, seed) {
  const copy = [...items];
  const rand = seededRandom(seed);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getSessionShuffleSeed(key) {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return String(Date.now());
  }
  const storageKey = `eears:shuffle:${key}`;
  let seed = window.sessionStorage.getItem(storageKey);
  if (!seed) {
    seed = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    window.sessionStorage.setItem(storageKey, seed);
  }
  return seed;
}

export function getSessionShuffledItems(items, sessionKey) {
  const seed = getSessionShuffleSeed(sessionKey);
  return shuffleWithSeed(items, seed);
}
