import { fetchClient } from '../utils/fetchClient';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonOrThrow(res) {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      message = j?.error || j?.message || message;
    } catch {
      // ignore
    }
    const err = new Error(message);
    err.status = res.status;
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

export async function fetchLearningResourcesAdmin(token) {
  return requestJson('/api/admin/page-content/learning-resources', { token, method: 'GET' });
}

export async function createLearningResourceAdmin(token, kind, payload) {
  return requestJson(`/api/admin/page-content/learning-resources/${encodeURIComponent(kind)}`, {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function updateLearningResourceAdmin(token, kind, id, payload) {
  return requestJson(`/api/admin/page-content/learning-resources/${encodeURIComponent(kind)}/${id}`, {
    token,
    method: 'PUT',
    body: payload,
  });
}

export async function deleteLearningResourceAdmin(token, kind, id) {
  const res = await fetchClient(
    `/api/admin/page-content/learning-resources/${encodeURIComponent(kind)}/${id}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
  );
  return parseJsonOrThrow(res);
}

export async function reorderLearningResourcesAdmin(token, kind, ids) {
  return requestJson(`/api/admin/page-content/learning-resources/${encodeURIComponent(kind)}/reorder`, {
    token,
    method: 'POST',
    body: { ids },
  });
}

// Regulations forms
export async function fetchRegulationsFormsAdmin(token) {
  return requestJson('/api/admin/page-content/regulations-forms', { token, method: 'GET' });
}

export async function createRegulationsGroupAdmin(token, payload) {
  return requestJson('/api/admin/page-content/regulations-forms/groups', { token, method: 'POST', body: payload });
}

export async function updateRegulationsGroupAdmin(token, id, payload) {
  return requestJson(`/api/admin/page-content/regulations-forms/groups/${id}`, { token, method: 'PUT', body: payload });
}

export async function deleteRegulationsGroupAdmin(token, id) {
  const res = await fetchClient(`/api/admin/page-content/regulations-forms/groups/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function reorderRegulationsGroupsAdmin(token, ids) {
  return requestJson('/api/admin/page-content/regulations-forms/groups/reorder', {
    token,
    method: 'POST',
    body: { ids },
  });
}

export async function createRegulationsItemAdmin(token, payload) {
  return requestJson('/api/admin/page-content/regulations-forms/items', { token, method: 'POST', body: payload });
}

export async function updateRegulationsItemAdmin(token, id, payload) {
  return requestJson(`/api/admin/page-content/regulations-forms/items/${id}`, { token, method: 'PUT', body: payload });
}

export async function deleteRegulationsItemAdmin(token, id) {
  const res = await fetchClient(`/api/admin/page-content/regulations-forms/items/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function reorderRegulationsItemsAdmin(token, ids) {
  return requestJson('/api/admin/page-content/regulations-forms/items/reorder', {
    token,
    method: 'POST',
    body: { ids },
  });
}

export async function uploadRegulationsFormsPdfAdmin(token, file, { signal } = {}) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchClient('/api/admin/page-content/regulations-forms/upload/pdf', {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
    signal,
  });

  return parseJsonOrThrow(res);
}

// Scroll world test segments
export async function fetchScrollWorldTestSegmentsAdmin(token) {
  return requestJson('/api/admin/page-content/scroll-world-test', { token, method: 'GET' });
}

export async function updateScrollWorldTestSegmentAdmin(token, sectionId, payload) {
  return requestJson(`/api/admin/page-content/scroll-world-test/${encodeURIComponent(sectionId)}`, {
    token,
    method: 'PUT',
    body: payload,
  });
}

export async function reorderScrollWorldTestSegmentsAdmin(token, sectionIds) {
  return requestJson('/api/admin/page-content/scroll-world-test/reorder', {
    token,
    method: 'POST',
    body: { sectionIds },
  });
}

// Course guide
export async function fetchCourseGuideAdmin(token) {
  return requestJson('/api/admin/page-content/course-guide', { token, method: 'GET' });
}

export async function createCourseGuideSectionAdmin(token, payload) {
  return requestJson('/api/admin/page-content/course-guide/sections', {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function updateCourseGuideSectionAdmin(token, id, payload) {
  return requestJson(`/api/admin/page-content/course-guide/sections/${id}`, {
    token,
    method: 'PUT',
    body: payload,
  });
}

export async function deleteCourseGuideSectionAdmin(token, id) {
  const res = await fetchClient(`/api/admin/page-content/course-guide/sections/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function reorderCourseGuideSectionsAdmin(token, ids) {
  return requestJson('/api/admin/page-content/course-guide/sections/reorder', {
    token,
    method: 'POST',
    body: { ids },
  });
}

export async function createCourseGuideTopicAdmin(token, payload) {
  return requestJson('/api/admin/page-content/course-guide/topics', {
    token,
    method: 'POST',
    body: payload,
  });
}

export async function updateCourseGuideTopicAdmin(token, id, payload) {
  return requestJson(`/api/admin/page-content/course-guide/topics/${id}`, {
    token,
    method: 'PUT',
    body: payload,
  });
}

export async function deleteCourseGuideTopicAdmin(token, id) {
  const res = await fetchClient(`/api/admin/page-content/course-guide/topics/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseJsonOrThrow(res);
}

export async function reorderCourseGuideTopicsAdmin(token, ids) {
  return requestJson('/api/admin/page-content/course-guide/topics/reorder', {
    token,
    method: 'POST',
    body: { ids },
  });
}

export async function fetchCourseGuideMediaAdmin(token) {
  return requestJson('/api/admin/page-content/course-guide/media', { token, method: 'GET' });
}

export async function uploadCourseGuideMediaAdmin(token, file, { signal } = {}) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchClient('/api/admin/page-content/course-guide/media/upload', {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
    signal,
  });

  return parseJsonOrThrow(res);
}

export async function deleteCourseGuideMediaAdmin(token, storedName) {
  const res = await fetchClient(
    `/api/admin/page-content/course-guide/media/${encodeURIComponent(storedName)}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
  );
  return parseJsonOrThrow(res);
}

