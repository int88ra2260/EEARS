/**
 * 活動類型 slug 對應（用於 /activities/:slug 分類頁）
 * 有效 slug 以 GET /api/event-types 啟用中類型為準。
 */
import { activityTypeContentKey, usesLegacyActivityPresentation } from '../utils/activityTypeContent';

/** slug → 翻譯 key（activities.xxx）用於分類頁標題（已知類型） */
export const SLUG_TO_TITLE_KEY = {
  'english-table': 'activities.englishTable',
  'english-club': 'activities.englishClub',
  'job-talk': 'activities.jobTalk',
};

/**
 * @param {string} slug
 * @param {Array<{ slug: string, code: string, displayName?: string, isActive?: boolean }>} eventTypes
 */
export function resolveBookableSlug(slug, eventTypes) {
  const key = String(slug || '').trim();
  if (!key) return null;
  const row = (Array.isArray(eventTypes) ? eventTypes : []).find(
    (r) => r.slug === key && r.isActive !== false
  );
  if (!row) return null;
  const titleKey = SLUG_TO_TITLE_KEY[key]
    || (!usesLegacyActivityPresentation(row.code) ? activityTypeContentKey(row.code, 'title') : null);
  return {
    slug: key,
    type: row.code,
    titleKey,
    displayName: row.displayName || key,
    /** phrasebookItems 使用顯示名稱欄位 */
    phrasebookActivityType: row.displayName || null,
  };
}

export function slugToTab(slug) {
  return String(slug || '').trim() || null;
}

/** @deprecated 請用 resolveBookableSlug(slug, eventTypes) */
export function isValidActivitySlug(slug, eventTypes) {
  return Boolean(resolveBookableSlug(slug, eventTypes));
}

export function getCategoryTitleKey(slug, eventTypes) {
  const resolved = resolveBookableSlug(slug, eventTypes);
  if (!resolved) return null;
  return resolved.titleKey;
}
