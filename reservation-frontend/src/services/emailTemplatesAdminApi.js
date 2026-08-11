/**
 * 後台郵件模板設定 API
 */
import { fetchClient } from '../utils/fetchClient';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseOrThrow(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function fetchEmailTemplates(token) {
  const res = await fetchClient('/api/admin/email-templates', { headers: authHeaders(token) });
  const data = await parseOrThrow(res);
  return data.data || [];
}

export async function fetchEmailTemplate(token, key) {
  const res = await fetchClient(`/api/admin/email-templates/${encodeURIComponent(key)}`, {
    headers: authHeaders(token),
  });
  const data = await parseOrThrow(res);
  return data.data;
}

export async function saveEmailTemplate(token, key, payload) {
  const res = await fetchClient(`/api/admin/email-templates/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseOrThrow(res);
  return { data: data.data, warnings: data.warnings || [] };
}

export async function resetEmailTemplate(token, key) {
  const res = await fetchClient(`/api/admin/email-templates/${encodeURIComponent(key)}/reset`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = await parseOrThrow(res);
  return data.data;
}

export async function previewEmailTemplate(token, key, payload) {
  const res = await fetchClient(`/api/admin/email-templates/${encodeURIComponent(key)}/preview`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
  const data = await parseOrThrow(res);
  return data.data;
}

export async function testSendEmailTemplate(token, key, payload) {
  const res = await fetchClient(`/api/admin/email-templates/${encodeURIComponent(key)}/test-send`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload || {}),
  });
  const data = await parseOrThrow(res);
  return data.data;
}
