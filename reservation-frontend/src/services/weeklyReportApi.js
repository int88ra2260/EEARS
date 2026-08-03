import { fetchClient } from '../utils/fetchClient';

export async function fetchCurrentWeeklyReport() {
  const res = await fetchClient('/api/weekly/current');
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error('Failed to load weekly report');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchWeeklyReportByKey(idOrSlug) {
  const res = await fetchClient(`/api/weekly/${encodeURIComponent(idOrSlug)}`);
  if (!res.ok) {
    const err = new Error('Failed to load weekly report');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchWeeklyReportList({ page = 1, limit = 12 } = {}) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetchClient(`/api/weekly?${qs}`);
  if (!res.ok) throw new Error('Failed to load weekly reports');
  return res.json();
}

export async function fetchWeeklyPreview(token) {
  const res = await fetchClient(`/api/weekly/preview/${encodeURIComponent(token)}`);
  if (!res.ok) {
    const err = new Error('預覽連結無效或已過期');
    err.status = res.status;
    throw err;
  }
  return res.json();
}
