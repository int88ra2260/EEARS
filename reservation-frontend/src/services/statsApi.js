/**
 * 公開統計 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';

const STATS_CACHE_KEY = 'eears_view_stats_cache';
const STATS_CACHE_MS = 5 * 60 * 1000;

function readStatsCache() {
  try {
    const raw = sessionStorage.getItem(STATS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > STATS_CACHE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeStatsCache(data) {
  try {
    sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore quota errors
  }
}

export async function fetchViewStats() {
  const cached = readStatsCache();
  if (cached) return cached;

  const res = await fetchClient('/api/stats/views');
  if (res.status === 429) {
    const stale = readStatsCache();
    if (stale) return stale;
    throw new Error('瀏覽統計暫時無法載入，請稍後再試');
  }
  if (!res.ok) throw new Error('載入瀏覽統計失敗');
  const data = await res.json();
  writeStatsCache(data);
  return data;
}
