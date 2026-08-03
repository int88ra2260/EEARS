import { fetchClient } from '../utils/fetchClient';
import { clearSiteContentCache } from './siteContentApi';

function notifySiteContentUpdated() {
  clearSiteContentCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('eears:site-content-updated'));
  }
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function handleErr(res) {
  const j = await res.json().catch(() => ({}));
  const msg = j?.error || j?.message || `HTTP ${res.status}`;
  const err = new Error(msg);
  err.status = res.status;
  throw err;
}

async function request(path, { token, method = 'GET', body, clearCache = true } = {}) {
  const res = await fetchClient(path, {
    method,
    headers: authHeaders(token),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await handleErr(res);
  const data = await res.json();
  if (clearCache) notifySiteContentUpdated();
  return data;
}

export async function fetchSiteContentSections(token) {
  const res = await fetchClient('/api/admin/site-content/sections', {
    headers: authHeaders(token),
  });
  if (!res.ok) await handleErr(res);
  return res.json();
}

export async function fetchSiteContentSection(token, section) {
  const res = await fetchClient(`/api/admin/site-content/${encodeURIComponent(section)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) await handleErr(res);
  return res.json();
}

export async function upsertSiteContentText(token, section, body) {
  return request(`/api/admin/site-content/${encodeURIComponent(section)}/text`, {
    token,
    method: 'PUT',
    body,
  });
}

export async function createSiteContentFaq(token, body) {
  return request('/api/admin/site-content/faq', { token, method: 'POST', body });
}

export async function updateSiteContentFaq(token, id, body) {
  return request(`/api/admin/site-content/faq/${id}`, { token, method: 'PUT', body });
}

export async function deleteSiteContentEntry(token, id) {
  return request(`/api/admin/site-content/${id}`, { token, method: 'DELETE' });
}

export async function reorderSiteContentFaq(token, ids) {
  return request('/api/admin/site-content/faq/reorder', { token, method: 'POST', body: { ids } });
}

export async function seedSiteContentFaq(token, items, { overwrite = false } = {}) {
  return request('/api/admin/site-content/faq/seed', {
    token,
    method: 'POST',
    body: { items, overwrite },
  });
}

export async function seedSiteContentText(token, section, items, { overwrite = false } = {}) {
  return request(`/api/admin/site-content/${encodeURIComponent(section)}/text/seed`, {
    token,
    method: 'POST',
    body: { items, overwrite },
  });
}

export async function createSiteContentStaff(token, section, body) {
  return request(`/api/admin/site-content/staff/${encodeURIComponent(section)}`, {
    token,
    method: 'POST',
    body,
  });
}

export async function updateSiteContentStaff(token, id, body) {
  return request(`/api/admin/site-content/staff/${id}`, { token, method: 'PUT', body });
}

export async function reorderSiteContentStaff(token, section, ids) {
  return request(`/api/admin/site-content/staff/${encodeURIComponent(section)}/reorder`, {
    token,
    method: 'POST',
    body: { ids },
  });
}

export async function seedSiteContentStaff(token, section, items, { overwrite = false } = {}) {
  return request(`/api/admin/site-content/staff/${encodeURIComponent(section)}/seed`, {
    token,
    method: 'POST',
    body: { items, overwrite },
  });
}
