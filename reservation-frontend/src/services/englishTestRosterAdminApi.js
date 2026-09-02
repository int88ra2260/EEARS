/**
 * 英檢在學名單比對 Excel 管理 API
 */
import { fetchClient } from '../utils/fetchClient';

const BASE = '/api/english-test/admin/student-roster';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonOrThrow(res) {
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }

  return data;
}

export async function fetchEnglishTestStudentRosterAdmin(token, { offset = 0, limit = 30 } = {}) {
  const qs = new URLSearchParams();
  qs.set('offset', String(offset));
  qs.set('limit', String(limit));

  const res = await fetchClient(`${BASE}?${qs}`, { headers: authHeaders(token) });
  const data = await parseJsonOrThrow(res);
  return data.data || {};
}

export async function uploadEnglishTestStudentRosterAdmin(token, file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchClient(`${BASE}/upload`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });

  const data = await parseJsonOrThrow(res);
  return data.data;
}

export async function updateEnglishTestStudentRosterMatchFields(token, matchFields) {
  const res = await fetchClient(`${BASE}/match-fields`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ matchFields }),
  });

  const data = await parseJsonOrThrow(res);
  return data.data;
}

export async function deleteEnglishTestStudentRosterAdmin(token) {
  const res = await fetchClient(BASE, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  const data = await parseJsonOrThrow(res);
  return data.data;
}

export async function downloadEnglishTestRosterSampleXlsx(token) {
  const res = await fetchClient(`${BASE}/sample-xlsx`, { headers: authHeaders(token) });
  if (!res.ok) {
    const data = await parseJsonOrThrow(res);
    throw new Error(data?.error || data?.message || '下載失敗');
  }
  return res.blob();
}
