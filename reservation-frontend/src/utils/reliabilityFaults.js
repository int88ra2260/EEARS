// Dev-only fault injection helpers for reliability testing (Phase 6.6)
// Production must not be affected.

export function getReliabilityFault() {
  if (import.meta.env.PROD) return null;
  if (typeof window === 'undefined') return null;

  try {
    const sp = new URLSearchParams(window.location.search);
    const fromQuery = sp.get('reliabilityFault');
    const fromLocal = window.localStorage.getItem('reliabilityFault');
    return fromQuery || fromLocal || null;
  } catch (_) {
    return null;
  }
}

export function clearReliabilityFault() {
  if (import.meta.env.PROD) return;
  try {
    window.localStorage.removeItem('reliabilityFault');
  } catch (_) {
    // ignore
  }
}

export function makeDevRequestId(prefix = 'DEV') {
  const rnd = Math.random().toString(16).slice(2, 10);
  const ts = Date.now();
  return `${prefix}-${ts}-${rnd}`;
}

export function createSimulatedApiError({ status = 500, requestId = null, message = 'API fail' } = {}) {
  const err = new Error(message);
  err.requestId = requestId;
  err.status = status;
  err.response = {
    status,
    data: { error: message },
    requestId,
  };
  return err;
}

export function createSimulatedTimeoutError({ requestId = null, message = 'timeout' } = {}) {
  const err = new Error(message);
  err.requestId = requestId;
  err.name = 'AbortError';
  err.code = 'ECONNABORTED';
  return err;
}

export function createSimulatedNetworkError({ requestId = null, message = 'network error' } = {}) {
  const err = new Error(message);
  err.requestId = requestId;
  return err;
}

