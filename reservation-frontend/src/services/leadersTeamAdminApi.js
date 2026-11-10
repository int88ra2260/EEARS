import { fetchClient } from '../utils/fetchClient';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseJsonOrThrow(res) {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const payload = await res.json();
      message = payload?.error || payload?.message || message;
    } catch {
      // ignore
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchLeaderPublicProfiles(token) {
  const res = await fetchClient('/api/admin/leader-public-profiles', {
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function createLeaderPublicProfile(token, body) {
  const res = await fetchClient('/api/admin/leader-public-profiles', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJsonOrThrow(res);
}

export async function updateLeaderPublicProfile(token, id, body) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJsonOrThrow(res);
}

export async function deleteLeaderPublicProfile(token, id) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function fetchLeaderProfileImages(token) {
  const res = await fetchClient('/api/admin/leader-public-profiles/media', {
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function uploadLeaderProfileImage(token, file) {
  const formData = new FormData();
  formData.append('file', file);
  if (file?.name) formData.append('label', file.name);
  const res = await fetchClient('/api/admin/leader-public-profiles/media/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseJsonOrThrow(res);
}

export async function reorderLeaderPublicProfiles(token, ids) {
  const res = await fetchClient('/api/admin/leader-public-profiles/reorder', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });
  return parseJsonOrThrow(res);
}
