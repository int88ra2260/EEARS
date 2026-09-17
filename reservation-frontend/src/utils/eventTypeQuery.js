/**
 * /events?type= 與 EventList eventTypeFilter 雙向對應（slug ↔ code）
 * 優先使用 API 目錄（傳入 list 或公開快取），再退回 seed。
 */

import {
  DEFAULT_EVENT_TYPES,
  normalizeEventTypeCode,
} from '../constants/eventTypeCatalog';
import {
  getCachedPublicEventTypes,
  resolveTypeConfigFromList,
} from '../services/eventTypeApi';

function catalogRows(list) {
  if (Array.isArray(list) && list.length) return list;
  const cached = getCachedPublicEventTypes();
  if (cached?.length) return cached;
  return DEFAULT_EVENT_TYPES.filter((r) => r.isActive !== false);
}

function buildQueryMaps(list) {
  const rows = catalogRows(list);
  const queryToFilter = { all: 'all' };
  const filterToQuery = { all: 'all' };
  for (const r of rows) {
    if (!r?.code) continue;
    const slug = String(r.slug || r.code).toLowerCase();
    queryToFilter[slug] = r.code;
    queryToFilter[String(r.code).toLowerCase()] = r.code;
    filterToQuery[r.code] = slug;
    if (r.displayName) filterToQuery[r.displayName] = slug;
  }
  return { queryToFilter, filterToQuery };
}

export const VALID_EVENT_TYPE_QUERY_KEYS = Object.keys(
  Object.fromEntries([
    ['all', 'all'],
    ...DEFAULT_EVENT_TYPES.map((r) => [r.slug, r.code]),
  ])
);

/**
 * @param {string | null | undefined} raw
 * @param {Array} [list] - 活動類型目錄
 * @returns {string} 'all' 或活動類型 code
 */
export function parseEventTypeQueryParam(raw, list) {
  if (raw == null || raw === '') return 'all';
  const key = String(raw).trim().toLowerCase();
  if (key === 'all') return 'all';
  const { queryToFilter } = buildQueryMaps(list);
  if (queryToFilter[key]) return queryToFilter[key];
  const hit = resolveTypeConfigFromList(catalogRows(list), raw);
  if (hit?.code) return hit.code;
  const asCode = normalizeEventTypeCode(raw);
  return asCode || 'all';
}

export function isInvalidEventTypeQueryParam(raw, list) {
  if (raw == null || raw === '') return false;
  const key = String(raw).trim().toLowerCase();
  if (key === 'all') return false;
  const { queryToFilter } = buildQueryMaps(list);
  if (queryToFilter[key] !== undefined) return false;
  if (resolveTypeConfigFromList(catalogRows(list), raw)) return false;
  return !normalizeEventTypeCode(raw);
}

export function eventTypeFilterToQueryParam(filterValue, list) {
  if (filterValue === 'all') return 'all';
  const { filterToQuery } = buildQueryMaps(list);
  if (filterToQuery[filterValue]) return filterToQuery[filterValue];
  const hit = resolveTypeConfigFromList(catalogRows(list), filterValue);
  if (hit?.slug) return hit.slug;
  if (hit?.code) return hit.code;
  const code = normalizeEventTypeCode(filterValue);
  if (code && filterToQuery[code]) return filterToQuery[code];
  return 'all';
}

export function getEventsCalendarPath(typeSlug, list) {
  if (!typeSlug || typeSlug === 'all') return '/events';
  const key = String(typeSlug).trim().toLowerCase();
  if (key === 'all') return '/events';
  if (isInvalidEventTypeQueryParam(typeSlug, list)) return '/events';
  const slug = eventTypeFilterToQueryParam(
    parseEventTypeQueryParam(typeSlug, list),
    list,
  );
  return `/events?type=${encodeURIComponent(slug)}`;
}
