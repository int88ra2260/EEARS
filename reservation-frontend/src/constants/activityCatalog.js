/**
 * 活動介紹頁卡片與 Tab 的結構設定（文案仍由 translations.js / site-content 管理）
 * 可預約類型以 GET /api/event-types 為準；此檔提供各 code 的視覺／文案 key。
 * 未列於 ACTIVITY_PRESENTATION_BY_CODE 的類型使用 activities.type.{code}.* 動態文案。
 */
import { DEFAULT_EVENT_TYPES } from './eventTypeCatalog';
import IMAGES from './imagePaths';
import { getActivityTypeContentKeys } from '../utils/activityTypeContent';

export const WRITING_WORKSHOP_URL = 'https://emicenter.siwan.nsysu.edu.tw/EWL/';

/** @typedef {'bookable' | 'external'} ActivityCardKind */

/**
 * @typedef {Object} ActivityCatalogCard
 * @property {string} slug
 * @property {ActivityCardKind} kind
 * @property {string} [titleKey]
 * @property {string} [displayName]
 * @property {string} [introKey]
 * @property {string} tag
 * @property {string} tone
 * @property {string} [fitKey]
 * @property {string} [formatKey]
 * @property {string} [durationKey]
 * @property {string} [scheduleKey]
 * @property {string[]} [visualKeys]
 * @property {string} image
 * @property {string} [imageKey] - site-content 圖片覆寫鍵（*ImageUrl）
 * @property {string} [type] - event type code，僅 bookable
 * @property {string} [externalUrl] - 僅 external
 */

/** @type {Record<string, Omit<ActivityCatalogCard, 'slug' | 'kind' | 'type'>>} */
export const ACTIVITY_PRESENTATION_BY_CODE = {
  english_table: {
    titleKey: 'activities.englishTable',
    introKey: 'activities.etDesc',
    tag: 'Table',
    tone: 'blue',
    fitKey: 'activitiesPage.etFit',
    formatKey: 'activitiesPage.etFormat',
    durationKey: 'activitiesPage.etDuration',
    scheduleKey: 'activitiesPage.etSchedule',
    visualKeys: ['activitiesPage.etVisual1', 'activitiesPage.etVisual2', 'activitiesPage.etVisual3'],
    image: IMAGES.englishTable,
    imageKey: 'activities.englishTableImageUrl',
    secondaryCtaLabelKey: 'activities.englishTableSecondaryCtaLabel',
    secondaryCtaUrlKey: 'activities.englishTableSecondaryCtaUrl',
  },
  english_club: {
    titleKey: 'activities.englishClub',
    introKey: 'activities.ecDesc',
    tag: 'Club',
    tone: 'green',
    fitKey: 'activitiesPage.ecFit',
    formatKey: 'activitiesPage.ecFormat',
    durationKey: 'activitiesPage.ecDuration',
    scheduleKey: 'activitiesPage.ecSchedule',
    visualKeys: ['activitiesPage.ecVisual1', 'activitiesPage.ecVisual2', 'activitiesPage.ecVisual3'],
    image: IMAGES.englishClub,
    imageKey: 'activities.englishClubImageUrl',
    secondaryCtaLabelKey: 'activities.englishClubSecondaryCtaLabel',
    secondaryCtaUrlKey: 'activities.englishClubSecondaryCtaUrl',
  },
  job_talk: {
    titleKey: 'activities.jobTalk',
    introKey: 'activities.jtDesc',
    tag: 'Career',
    tone: 'red',
    fitKey: 'activitiesPage.jtFit',
    formatKey: 'activitiesPage.jtFormat',
    durationKey: 'activitiesPage.jtDuration',
    scheduleKey: 'activitiesPage.jtSchedule',
    visualKeys: ['activitiesPage.jtVisual1', 'activitiesPage.jtVisual2', 'activitiesPage.jtVisual3'],
    image: IMAGES.jobTalk[0],
    imageKey: 'activities.jobTalkImageUrl',
    secondaryCtaLabelKey: 'activities.jobTalkSecondaryCtaLabel',
    secondaryCtaUrlKey: 'activities.jobTalkSecondaryCtaUrl',
  },
};

/**
 * 依後台啟用中的活動類型組出可預約卡片（不含寫作工坊外部連結）。
 * @param {Array<{ code: string, slug: string, displayName?: string, abbreviation?: string, sortOrder?: number, isActive?: boolean }>} eventTypes
 * @returns {ActivityCatalogCard[]}
 */
const DYNAMIC_TONES = ['blue', 'green', 'red', 'purple'];

export function buildBookableActivityCards(eventTypes) {
  const rows = (Array.isArray(eventTypes) ? eventTypes : [])
    .filter((r) => r && r.isActive !== false && r.code && r.slug)
    .slice()
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));

  return rows.map((row, index) => {
    const pres = ACTIVITY_PRESENTATION_BY_CODE[row.code];
    if (pres) {
      return {
        slug: row.slug,
        kind: 'bookable',
        type: row.code,
        ...pres,
      };
    }
    const keys = getActivityTypeContentKeys(row.code);
    return {
      slug: row.slug,
      kind: 'bookable',
      type: row.code,
      displayName: row.displayName || row.code,
      titleKey: keys.titleKey,
      introKey: keys.introKey,
      tag: row.abbreviation || 'Activity',
      tone: DYNAMIC_TONES[index % DYNAMIC_TONES.length],
      fitKey: keys.fitKey,
      formatKey: keys.formatKey,
      durationKey: keys.durationKey,
      visualKeys: keys.visualKeys,
      image: IMAGES.englishTable,
      imageKey: keys.imageKey,
      secondaryCtaLabelKey: keys.secondaryCtaLabelKey,
      secondaryCtaUrlKey: keys.secondaryCtaUrlKey,
    };
  });
}

/** @deprecated 請用 buildBookableActivityCards(apiList)；保留供測試／離線 fallback */
export const BOOKABLE_ACTIVITY_CARDS = buildBookableActivityCards(
  DEFAULT_EVENT_TYPES.filter((r) => r.isActive !== false)
);

/** @type {ActivityCatalogCard} */
export const WRITING_WORKSHOP_CARD = {
  slug: 'writing-workshop',
  kind: 'external',
  externalUrl: WRITING_WORKSHOP_URL,
  titleKey: 'activities.writingWorkshop',
  introKey: 'activities.wwDesc',
  tag: 'Writing',
  tone: 'purple',
  fitKey: 'activitiesPage.wwFit',
  formatKey: 'activitiesPage.wwFormat',
  durationKey: 'activitiesPage.wwDuration',
  visualKeys: ['activitiesPage.wwVisual1', 'activitiesPage.wwVisual2', 'activitiesPage.wwVisual3'],
  image: IMAGES.writingWorkshop,
  imageKey: 'activities.writingWorkshopImageUrl',
  secondaryCtaLabelKey: 'activities.writingWorkshopSecondaryCtaLabel',
  secondaryCtaUrlKey: 'activities.writingWorkshopSecondaryCtaUrl',
};

/** 活動介紹頁目錄（含外部資源）— fallback；頁面應優先使用 API */
export const CATALOG_DISPLAY_CARDS = [...BOOKABLE_ACTIVITY_CARDS, WRITING_WORKSHOP_CARD];

/** 活動介紹 Modal Tab（僅可預約類型，依 API 或 fallback） */
export function buildActivityTabItems(eventTypes) {
  return buildBookableActivityCards(eventTypes).map((card) => ({
    id: card.slug,
    labelKey: card.titleKey || null,
    displayName: card.displayName || null,
  }));
}

export const ACTIVITY_TAB_ITEMS = buildActivityTabItems(DEFAULT_EVENT_TYPES);
