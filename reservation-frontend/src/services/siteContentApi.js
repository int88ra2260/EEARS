import { fetchClient } from '../utils/fetchClient';

let cache = null;
let cacheAt = 0;
const CACHE_MS = 60 * 1000;

async function parseJson(res) {
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchSiteContent({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache && now - cacheAt < CACHE_MS) {
    return cache;
  }
  const res = await fetchClient('/api/site-content');
  const data = await parseJson(res);
  cache = data;
  cacheAt = now;
  return data;
}

export function clearSiteContentCache() {
  cache = null;
  cacheAt = 0;
}
