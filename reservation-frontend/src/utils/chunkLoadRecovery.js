const RELOAD_KEY = 'eears:chunk-reload-at';
const RELOAD_WINDOW_MS = 15000;

const STALE_CHUNK_MESSAGE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|MIME type of ["']text\/html["']/i;

export function isStaleChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return STALE_CHUNK_MESSAGE.test(message);
}

/**
 * 部署後舊的程式片段已不存在。同一個分頁只自動重新整理一次，
 * 避免新版本仍失敗時不停重整。
 */
export function reloadOnceForStaleChunk(error, {
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  reload = () => window.location.reload(),
  now = () => Date.now(),
} = {}) {
  if (!isStaleChunkLoadError(error) || !storage) return false;
  const stampedAt = Number(storage.getItem(RELOAD_KEY) || 0);
  const current = now();
  if (stampedAt && current - stampedAt < RELOAD_WINDOW_MS) return false;
  try {
    storage.setItem(RELOAD_KEY, String(current));
  } catch {
    return false;
  }
  reload();
  return true;
}

export function installChunkLoadRecovery() {
  if (typeof window === 'undefined' || window.__eearsChunkRecovery) return;
  window.__eearsChunkRecovery = true;

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnceForStaleChunk(event?.payload || { message: 'Failed to fetch dynamically imported module' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isStaleChunkLoadError(event?.reason)) return;
    event.preventDefault();
    reloadOnceForStaleChunk(event.reason);
  });
}
