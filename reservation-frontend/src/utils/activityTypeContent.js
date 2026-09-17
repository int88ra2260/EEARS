/**
 * 活動類型介紹文案（動態 key）
 * 已知類型（ET／EC／JT）仍走 activityCatalog 舊 key；其餘類型用 activities.type.{code}.*。
 * 卡片圖片：鍵名以 ImageUrl 結尾，後台視覺編輯會接媒體庫。
 * 第二按鈕：secondaryCtaLabel + secondaryCtaUrl；預設留白＝前台不顯示。
 */

import IMAGES from '../constants/imagePaths';

export const ACTIVITY_TYPE_CONTENT_FIELDS = Object.freeze([
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

/** 已有專屬 presentation／翻譯 key，不走動態 key */
export const LEGACY_ACTIVITY_PRESENTATION_CODES = Object.freeze([
  'english_table',
  'english_club',
  'job_talk',
]);

/** 固定卡片（含寫作工坊）的圖片覆寫鍵 → 預設圖 */
export const FIXED_ACTIVITY_IMAGE_DEFAULTS = Object.freeze({
  'activities.englishTableImageUrl': IMAGES.englishTable,
  'activities.englishClubImageUrl': IMAGES.englishClub,
  'activities.jobTalkImageUrl': IMAGES.jobTalk[0],
  'activities.writingWorkshopImageUrl': IMAGES.writingWorkshop,
});

export const FIXED_ACTIVITY_IMAGE_SEEDS = Object.freeze([
  {
    contentKey: 'activities.englishTableImageUrl',
    label: 'English Table · 卡片圖片',
    valueZh: '',
    valueEn: '',
  },
  {
    contentKey: 'activities.englishClubImageUrl',
    label: 'English Club · 卡片圖片',
    valueZh: '',
    valueEn: '',
  },
  {
    contentKey: 'activities.jobTalkImageUrl',
    label: 'Job Talk · 卡片圖片',
    valueZh: '',
    valueEn: '',
  },
  {
    contentKey: 'activities.writingWorkshopImageUrl',
    label: 'Writing Workshop · 卡片圖片',
    valueZh: '',
    valueEn: '',
  },
]);

/** 固定卡片第二按鈕（預設留白＝前台不顯示） */
export const FIXED_ACTIVITY_SECONDARY_CTA_SEEDS = Object.freeze([
  {
    contentKey: 'activities.englishTableSecondaryCtaLabel',
    label: 'English Table · 第二按鈕名稱',
    valueZh: '',
    valueEn: '',
  },
  {
    contentKey: 'activities.englishTableSecondaryCtaUrl',
    label: 'English Table · 第二按鈕網址',
    valueZh: '',
    valueEn: '',
  },
  {
    contentKey: 'activities.englishClubSecondaryCtaLabel',
    label: 'English Club · 第二按鈕名稱',
    valueZh: '',
    valueEn: '',
  },
  {
    contentKey: 'activities.englishClubSecondaryCtaUrl',
    label: 'English Club · 第二按鈕網址',
    valueZh: '',
    valueEn: '',
  },
  {
    contentKey: 'activities.jobTalkSecondaryCtaLabel',
    label: 'Job Talk · 第二按鈕名稱',
    valueZh: '',
    valueEn: '',
  },
  {
    contentKey: 'activities.jobTalkSecondaryCtaUrl',
    label: 'Job Talk · 第二按鈕網址',
    valueZh: '',
    valueEn: '',
  },
  {
    contentKey: 'activities.writingWorkshopSecondaryCtaLabel',
    label: 'Writing Workshop · 第二按鈕名稱',
    valueZh: '',
    valueEn: '',
  },
  {
    contentKey: 'activities.writingWorkshopSecondaryCtaUrl',
    label: 'Writing Workshop · 第二按鈕網址',
    valueZh: '',
    valueEn: '',
  },
]);

const TYPE_KEY_RE = /^activities\.type\.([a-z][a-z0-9_]{1,63})\.(title|intro|fit|format|duration|visual[123]|imageUrl|secondaryCtaLabel|secondaryCtaUrl)$/;

export function activityTypeContentKey(code, field) {
  return `activities.type.${code}.${field}`;
}

export function getActivityTypeContentKeys(code) {
  const c = String(code || '').trim();
  return {
    titleKey: activityTypeContentKey(c, 'title'),
    introKey: activityTypeContentKey(c, 'intro'),
    fitKey: activityTypeContentKey(c, 'fit'),
    formatKey: activityTypeContentKey(c, 'format'),
    durationKey: activityTypeContentKey(c, 'duration'),
    imageKey: activityTypeContentKey(c, 'imageUrl'),
    secondaryCtaLabelKey: activityTypeContentKey(c, 'secondaryCtaLabel'),
    secondaryCtaUrlKey: activityTypeContentKey(c, 'secondaryCtaUrl'),
    visualKeys: [
      activityTypeContentKey(c, 'visual1'),
      activityTypeContentKey(c, 'visual2'),
      activityTypeContentKey(c, 'visual3'),
    ],
  };
}

export function usesLegacyActivityPresentation(code) {
  return LEGACY_ACTIVITY_PRESENTATION_CODES.includes(String(code || '').trim());
}

export function parseActivityTypeContentKey(contentKey) {
  const m = TYPE_KEY_RE.exec(String(contentKey || ''));
  if (!m) return null;
  return { code: m[1], field: m[2] };
}

/** 由第二按鈕名稱鍵推導網址鍵 */
export function pairSecondaryCtaUrlKey(labelKey) {
  const key = String(labelKey || '');
  if (key.endsWith('SecondaryCtaLabel')) {
    return key.replace(/SecondaryCtaLabel$/, 'SecondaryCtaUrl');
  }
  if (key.endsWith('.secondaryCtaLabel')) {
    return key.replace(/\.secondaryCtaLabel$/, '.secondaryCtaUrl');
  }
  return null;
}

export function isSecondaryCtaLabelKey(contentKey) {
  const key = String(contentKey || '');
  return key.endsWith('SecondaryCtaLabel') || key.endsWith('.secondaryCtaLabel');
}

export function isSecondaryCtaUrlKey(contentKey) {
  const key = String(contentKey || '');
  return key.endsWith('SecondaryCtaUrl') || key.endsWith('.secondaryCtaUrl');
}

function humanizeCode(code) {
  return String(code || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * @param {{ code: string, displayName?: string, abbreviation?: string }} eventType
 * @returns {Record<string, { zh: string, en: string }>}
 */
export function buildActivityTypeContentDefaultValues(eventType) {
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
    /** 空白＝使用系統預設圖（與 ELP guideImageUrl 相同慣例） */
    imageUrl: { zh: '', en: '' },
    /** 空白＝前台不顯示第二按鈕 */
    secondaryCtaLabel: { zh: '', en: '' },
    secondaryCtaUrl: { zh: '', en: '' },
  };
}

/**
 * 合併／後台目錄用的種子列（僅非 legacy 類型）。
 * @param {Array<{ code: string, displayName?: string, abbreviation?: string, isActive?: boolean }>} eventTypes
 */
export function buildActivityTypeContentSeedItems(eventTypes = []) {
  const rows = (Array.isArray(eventTypes) ? eventTypes : [])
    .filter((r) => r && r.code && !usesLegacyActivityPresentation(r.code));

  const items = [];
  rows.forEach((row) => {
    const defaults = buildActivityTypeContentDefaultValues(row);
    const name = row.displayName || humanizeCode(row.code);
    ACTIVITY_TYPE_CONTENT_FIELDS.forEach(({ field, labelSuffix }) => {
      const contentKey = activityTypeContentKey(row.code, field);
      const values = defaults[field];
      items.push({
        contentKey,
        label: `${name} · ${labelSuffix}`,
        valueZh: values.zh,
        valueEn: values.en,
      });
    });
  });
  return items;
}

/**
 * 活動介紹區塊：固定類型卡片圖／第二按鈕 + 動態類型文案／圖／第二按鈕。
 */
export function buildActivitiesContentSeedItems(eventTypes = []) {
  return [
    ...FIXED_ACTIVITY_IMAGE_SEEDS.map((row) => ({ ...row })),
    ...FIXED_ACTIVITY_SECONDARY_CTA_SEEDS.map((row) => ({ ...row })),
    ...buildActivityTypeContentSeedItems(eventTypes),
  ];
}

/**
 * LanguageContext / getTranslation 找不到時的 fallback。
 * @param {string} contentKey
 * @param {'zh'|'en'} lang
 */
export function resolveActivityTypeContentFallback(contentKey, lang = 'zh') {
  const key = String(contentKey || '');
  if (isSecondaryCtaLabelKey(key) || isSecondaryCtaUrlKey(key)) return '';

  const parsed = parseActivityTypeContentKey(contentKey);
  if (!parsed) return null;
  if (parsed.field === 'imageUrl' || parsed.field === 'secondaryCtaLabel' || parsed.field === 'secondaryCtaUrl') {
    return '';
  }
  const defaults = buildActivityTypeContentDefaultValues({ code: parsed.code });
  const pair = defaults[parsed.field];
  if (!pair) return null;
  return lang === 'en' ? pair.en : pair.zh;
}

/**
 * 解析活動卡片圖片：site-content 覆寫優先，否則用 catalog 預設路徑。
 * @param {(key: string) => string} t
 * @param {string|null|undefined} imageKey
 * @param {string} fallbackSrc
 */
export function resolveActivityImageSrc(t, imageKey, fallbackSrc) {
  const fallback = fallbackSrc || IMAGES.englishTable;
  if (!imageKey || typeof t !== 'function') return fallback;
  const custom = String(t(imageKey) || '').trim();
  if (!custom || custom === imageKey) return fallback;
  if (/^https?:\/\//i.test(custom) || custom.startsWith('/')) return custom;
  return fallback;
}

/** 後台側欄預覽：依 contentKey 回傳系統預設圖 */
export function getActivityImageDefaultSrc(contentKey) {
  const key = String(contentKey || '');
  if (FIXED_ACTIVITY_IMAGE_DEFAULTS[key]) return FIXED_ACTIVITY_IMAGE_DEFAULTS[key];
  const parsed = parseActivityTypeContentKey(key);
  if (parsed?.field === 'imageUrl') return IMAGES.englishTable;
  return '';
}

function isValidCtaHref(href) {
  const value = String(href || '').trim();
  if (!value) return false;
  if (value.startsWith('/')) return true;
  if (/^https?:\/\//i.test(value)) return true;
  return false;
}

/**
 * 解析卡片第二按鈕；名稱或網址留白／未啟用時回 null（前台不顯示）。
 * @param {{ secondaryCtaLabelKey?: string, secondaryCtaUrlKey?: string }} card
 * @param {(key: string) => string} t
 * @returns {{ label: string, href: string, labelKey: string, urlKey: string, external: boolean } | null}
 */
export function resolveActivitySecondaryCta(card, t) {
  const labelKey = card?.secondaryCtaLabelKey;
  const urlKey = card?.secondaryCtaUrlKey;
  if (!labelKey || !urlKey || typeof t !== 'function') return null;

  const label = String(t(labelKey) || '').trim();
  const href = String(t(urlKey) || '').trim();
  if (!label || label === labelKey) return null;
  if (!href || href === urlKey || !isValidCtaHref(href)) return null;

  return {
    label,
    href,
    labelKey,
    urlKey,
    external: /^https?:\/\//i.test(href),
  };
}
