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

// ============ 學期管理 ============

export async function fetchAvailableSemesters(token) {
  const res = await fetchClient('/api/admin/leader-public-profiles/semesters', {
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function fetchLeadersBySemester(token, semesterId) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/semester/${encodeURIComponent(semesterId)}`, {
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function reorderLeadersInSemester(token, semesterId, ids) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/semester/${encodeURIComponent(semesterId)}/reorder`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });
  return parseJsonOrThrow(res);
}

export async function copyLeadersFromSemester(token, targetSemesterId, sourceSemesterId) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/semester/${encodeURIComponent(targetSemesterId)}/copy`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ sourceSemesterId }),
  });
  return parseJsonOrThrow(res);
}

export async function assignLeaderToSemester(token, semesterId, leaderId, options = {}) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/semester/${encodeURIComponent(semesterId)}/assign/${leaderId}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(options),
  });
  return parseJsonOrThrow(res);
}

export async function removeLeaderFromSemester(token, semesterId, leaderId) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/semester/${encodeURIComponent(semesterId)}/leader/${leaderId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function updateSemesterAssignment(token, assignmentId, body) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/assignment/${assignmentId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJsonOrThrow(res);
}

// ============ 封存管理 ============

export async function fetchArchivedLeaders(token) {
  const res = await fetchClient('/api/admin/leader-public-profiles/archived', {
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function archiveLeader(token, id) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function unarchiveLeader(token, id) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/${id}/unarchive`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

// ============ Leader CRUD ============

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

// ============ 輪播圖片管理 ============

export async function fetchLeadersCarousel(token) {
  const res = await fetchClient('/api/admin/leader-public-profiles/carousel', {
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function createLeadersCarouselSlide(token, body) {
  const res = await fetchClient('/api/admin/leader-public-profiles/carousel', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJsonOrThrow(res);
}

export async function updateLeadersCarouselSlide(token, id, body) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/carousel/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJsonOrThrow(res);
}

export async function deleteLeadersCarouselSlide(token, id) {
  const res = await fetchClient(`/api/admin/leader-public-profiles/carousel/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function reorderLeadersCarousel(token, ids) {
  const res = await fetchClient('/api/admin/leader-public-profiles/carousel/reorder', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });
  return parseJsonOrThrow(res);
}
