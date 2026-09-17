'use strict';

/**
 * 活動類型介紹文案（與前端 activityTypeContent.js 對齊）
 */

const ACTIVITY_TYPE_CONTENT_FIELDS = Object.freeze([
  { field: 'title', labelSuffix: '名稱' },
  { field: 'intro', labelSuffix: '簡介' },
  { field: 'fit', labelSuffix: '適合對象' },
  { field: 'format', labelSuffix: '活動形式' },
  { field: 'duration', labelSuffix: '時長' },
  { field: 'visual1', labelSuffix: '視覺標籤 1' },
  { field: 'visual2', labelSuffix: '視覺標籤 2' },
  { field: 'visual3', labelSuffix: '視覺標籤 3' },
  { field: 'imageUrl', labelSuffix: '卡片圖片' },
  { field: 'secondaryCtaLabel', labelSuffix: '第二按鈕名稱' },
  { field: 'secondaryCtaUrl', labelSuffix: '第二按鈕網址' },
]);

/** 空白預設欄位：不寫入 DB 種子（由前台／後台目錄以留白呈現） */
const SKIP_SEED_FIELDS = new Set(['imageUrl', 'secondaryCtaLabel', 'secondaryCtaUrl']);

const LEGACY_ACTIVITY_PRESENTATION_CODES = Object.freeze([
  'english_table',
  'english_club',
  'job_talk',
]);

function usesLegacyActivityPresentation(code) {
  return LEGACY_ACTIVITY_PRESENTATION_CODES.includes(String(code || '').trim());
}

function activityTypeContentKey(code, field) {
  return `activities.type.${code}.${field}`;
}

function humanizeCode(code) {
  return String(code || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildDefaultValues(eventType) {
  const name = String(eventType?.displayName || humanizeCode(eventType?.code) || 'Activity').trim();
  const abbr = String(eventType?.abbreviation || '').trim() || name;

  return {
    title: { zh: name, en: name },
    intro: {
      zh: `${name} 歡迎同學參加。請至活動日曆查看場次並完成預約。`,
      en: `${name} welcomes you. Check the calendar for open sessions and book a spot.`,
    },
    fit: {
      zh: `想認識 ${name}、練習英語的同學`,
      en: `Students interested in ${name} and practicing English`,
    },
    format: {
      zh: '小組互動／主題討論（依場次公告）',
      en: 'Small-group interaction / themed discussion (see session notice)',
    },
    duration: {
      zh: '約 50–90 分鐘（依場次）',
      en: 'About 50–90 minutes (varies by session)',
    },
    visual1: { zh: abbr, en: abbr },
    visual2: { zh: '英語練習', en: 'English practice' },
    visual3: { zh: '歡迎預約', en: 'Open for booking' },
    imageUrl: { zh: '', en: '' },
    secondaryCtaLabel: { zh: '', en: '' },
    secondaryCtaUrl: { zh: '', en: '' },
  };
}

/**
 * @param {{ code: string, displayName?: string, abbreviation?: string }} eventType
 * @returns {Array<{ contentKey: string, label: string, valueZh: string, valueEn: string }>}
 */
function buildActivityTypeContentSeedItems(eventType) {
  if (!eventType?.code || usesLegacyActivityPresentation(eventType.code)) return [];
  const defaults = buildDefaultValues(eventType);
  const name = eventType.displayName || humanizeCode(eventType.code);
  return ACTIVITY_TYPE_CONTENT_FIELDS
    .filter(({ field }) => !SKIP_SEED_FIELDS.has(field))
    .map(({ field, labelSuffix }) => ({
      contentKey: activityTypeContentKey(eventType.code, field),
      label: `${name} · ${labelSuffix}`,
      valueZh: defaults[field].zh,
      valueEn: defaults[field].en,
    }));
}

module.exports = {
  ACTIVITY_TYPE_CONTENT_FIELDS,
  LEGACY_ACTIVITY_PRESENTATION_CODES,
  usesLegacyActivityPresentation,
  activityTypeContentKey,
  buildActivityTypeContentSeedItems,
};
