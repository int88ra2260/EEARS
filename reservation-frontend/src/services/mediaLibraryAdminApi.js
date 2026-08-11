import { fetchClient } from '../utils/fetchClient';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonOrThrow(res) {
  if (!res.ok) {
    let payload = null;
    let message = `HTTP ${res.status}`;
    try {
      payload = await res.json();
      message = payload?.error || payload?.message || message;
    } catch {
      // ignore
    }
    const err = new Error(message);
    err.status = res.status;
    err.code = payload?.code;
    err.references = payload?.references || [];
    err.payload = payload;
    throw err;
  }
  return res.json();
}

async function requestJson(path, { token, method = 'GET', body } = {}) {
  const res = await fetchClient(path, {
    method,
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return parseJsonOrThrow(res);
}

export async function fetchMediaLibraryAdmin(token, { scope, q, includeInactive, mimePrefix } = {}) {
  const params = new URLSearchParams();
  if (scope) params.set('scope', Array.isArray(scope) ? scope.join(',') : scope);
  if (q) params.set('q', q);
  if (includeInactive) params.set('includeInactive', '1');
  if (mimePrefix) params.set('mimePrefix', mimePrefix);
  const qs = params.toString();
  return requestJson(`/api/admin/media${qs ? `?${qs}` : ''}`, { token, method: 'GET' });
}

export async function uploadMediaLibraryAdmin(token, file, { scope = 'general', label } = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (scope) formData.append('scope', scope);
  if (label) formData.append('label', label);

  const res = await fetchClient('/api/admin/media/upload', {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  return parseJsonOrThrow(res);
}

export async function updateMediaLibraryAdmin(token, id, payload) {
  return requestJson(`/api/admin/media/${id}`, { token, method: 'PUT', body: payload });
}

export async function deleteMediaLibraryAdmin(token, id, { force = false } = {}) {
  const qs = force ? '?force=1' : '';
  const res = await fetchClient(`/api/admin/media/${id}${qs}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function fetchMediaReferencesAdmin(token, id) {
  return requestJson(`/api/admin/media/${id}/references`, { token, method: 'GET' });
}
