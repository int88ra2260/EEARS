import { getTranslation, LANG_EN, LANG_ZH, translations } from '../constants/translations';
import { SITE_CONTENT_KEY_SUGGESTIONS } from '../constants/siteContentManifest';
import { buildActivitiesContentSeedItems } from './activityTypeContent';

/** 與後端 siteContentManifest 前綴一致 */
export const TEXT_SECTION_PREFIXES = {
  home: ['homePage.', 'home.notice', 'home.rule', 'home.usage'],
  english_test_registration: ['englishTestRegistration.'],
  english_learning_passport: ['elpPage.'],
  activities: ['activitiesPage.', 'activities.', 'page.activitiesLead', 'page.activityCategoryLead'],
  about: ['aboutPage.'],
  contact: ['homePage.contact'],
  legal: ['privacyPage.', 'termsPage.'],
};

const LABEL_BY_KEY = Object.fromEntries(
  Object.values(SITE_CONTENT_KEY_SUGGESTIONS)
    .flat()
    .map(({ key, label }) => [key, label])
);

function walkStringKeys(obj, prefix, out) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  Object.entries(obj).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out.push(path);
      return;
    }
    if (value && typeof value === 'object') {
      walkStringKeys(value, path, out);
    }
  });
}

function allTranslationKeys() {
  const keys = [];
  walkStringKeys(translations.zh, '', keys);
  return keys;
}

const ALL_KEYS_CACHE = allTranslationKeys();

export function keysForTextSection(section) {
  const prefixes = TEXT_SECTION_PREFIXES[section] || [];
  return ALL_KEYS_CACHE.filter((key) => prefixes.some((prefix) => key.startsWith(prefix))).sort();
}

function isResolvableKey(key) {
  const zh = getTranslation(LANG_ZH, key);
  const en = getTranslation(LANG_EN, key);
  return zh !== key || en !== key;
}

export function buildTextSeedItems(section, { eventTypes } = {}) {
  const fromTranslations = keysForTextSection(section)
    .filter(isResolvableKey)
    .map((contentKey) => ({
      contentKey,
      label: LABEL_BY_KEY[contentKey] || contentKey,
      valueZh: getTranslation(LANG_ZH, contentKey),
      valueEn: getTranslation(LANG_EN, contentKey),
    }));

  if (section !== 'activities') return fromTranslations;

  const dynamic = buildActivitiesContentSeedItems(eventTypes);
  const seen = new Set(fromTranslations.map((row) => row.contentKey));
  const extra = dynamic.filter((row) => !seen.has(row.contentKey));
  return [...fromTranslations, ...extra];
}

function mergeSeedWithSaved(defaults, savedByKey) {
  const saved = savedByKey.get(defaults.contentKey);
  if (!saved) {
    return {
      ...defaults,
      id: null,
      status: 'default',
      isActive: true,
      valueZh: defaults.valueZh,
      valueEn: defaults.valueEn,
    };
  }
  return {
    ...defaults,
    id: saved.id,
    status: saved.isActive === false ? 'disabled' : 'custom',
    isActive: saved.isActive !== false,
    valueZh: saved.valueZh,
    valueEn: saved.valueEn,
    updatedAt: saved.updatedAt,
  };
}

/**
 * @param {string} section
 * @param {Array} savedItems
 * @param {{ eventTypes?: Array }} [options] - activities 區塊可傳入活動類型目錄，產生動態介紹文案列
 */
export function mergeTextCatalog(section, savedItems = [], options = {}) {
  const savedByKey = new Map((savedItems || []).map((item) => [item.contentKey, item]));
  return buildTextSeedItems(section, options).map((defaults) => mergeSeedWithSaved(defaults, savedByKey));
}

export function labelForContentKey(contentKey) {
  return LABEL_BY_KEY[contentKey] || contentKey;
}

export function catalogStats(rows) {
  const total = rows.length;
  const custom = rows.filter((r) => r.status === 'custom').length;
  const disabled = rows.filter((r) => r.status === 'disabled').length;
  const defaultOnly = rows.filter((r) => r.status === 'default').length;
  return { total, custom, disabled, defaultOnly };
}
