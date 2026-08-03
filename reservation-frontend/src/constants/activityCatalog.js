/**
 * 活動介紹頁卡片與 Tab 的結構設定（文案仍由 translations.js 管理）
 */
import { EVENT_TYPES } from './eventTypes';
import IMAGES from './imagePaths';

export const WRITING_WORKSHOP_URL = 'https://emicenter.siwan.nsysu.edu.tw/EWL/';

/** @typedef {'bookable' | 'external'} ActivityCardKind */

/**
 * @typedef {Object} ActivityCatalogCard
 * @property {string} slug
 * @property {ActivityCardKind} kind
 * @property {string} titleKey
 * @property {string} introKey
 * @property {string} tag
 * @property {string} tone
 * @property {string} fitKey
 * @property {string} formatKey
 * @property {string} durationKey
 * @property {string} [scheduleKey]
 * @property {string[]} visualKeys
 * @property {string} image
 * @property {string} [type] - EVENT_TYPES，僅 bookable
 * @property {string} [externalUrl] - 僅 external
 */

/** @type {ActivityCatalogCard[]} */
export const BOOKABLE_ACTIVITY_CARDS = [
  {
    slug: 'english-table',
    kind: 'bookable',
    titleKey: 'activities.englishTable',
    introKey: 'activities.etDesc',
    type: EVENT_TYPES.ENGLISH_TABLE,
    tag: 'Table',
    tone: 'blue',
    fitKey: 'activitiesPage.etFit',
    formatKey: 'activitiesPage.etFormat',
    durationKey: 'activitiesPage.etDuration',
    scheduleKey: 'activitiesPage.etSchedule',
    visualKeys: ['activitiesPage.etVisual1', 'activitiesPage.etVisual2', 'activitiesPage.etVisual3'],
    image: IMAGES.englishTable,
  },
  {
    slug: 'english-club',
    kind: 'bookable',
    titleKey: 'activities.englishClub',
    introKey: 'activities.ecDesc',
    type: EVENT_TYPES.ENGLISH_CLUB,
    tag: 'Club',
    tone: 'green',
    fitKey: 'activitiesPage.ecFit',
    formatKey: 'activitiesPage.ecFormat',
    durationKey: 'activitiesPage.ecDuration',
    scheduleKey: 'activitiesPage.ecSchedule',
    visualKeys: ['activitiesPage.ecVisual1', 'activitiesPage.ecVisual2', 'activitiesPage.ecVisual3'],
    image: IMAGES.englishClub,
  },
  {
    slug: 'international-forum',
    kind: 'bookable',
    titleKey: 'activities.internationalForum',
    introKey: 'activities.ifDesc',
    type: EVENT_TYPES.INTERNATIONAL_FORUM,
    tag: 'Forum',
    tone: 'yellow',
    fitKey: 'activitiesPage.ifFit',
    formatKey: 'activitiesPage.ifFormat',
    durationKey: 'activitiesPage.ifDuration',
    scheduleKey: 'activitiesPage.ifSchedule',
    visualKeys: ['activitiesPage.ifVisual1', 'activitiesPage.ifVisual2', 'activitiesPage.ifVisual3'],
    image: IMAGES.internationalForum,
  },
  {
    slug: 'job-talk',
    kind: 'bookable',
    titleKey: 'activities.jobTalk',
    introKey: 'activities.jtDesc',
    type: EVENT_TYPES.JOB_TALK,
    tag: 'Career',
    tone: 'red',
    fitKey: 'activitiesPage.jtFit',
    formatKey: 'activitiesPage.jtFormat',
    durationKey: 'activitiesPage.jtDuration',
    scheduleKey: 'activitiesPage.jtSchedule',
    visualKeys: ['activitiesPage.jtVisual1', 'activitiesPage.jtVisual2', 'activitiesPage.jtVisual3'],
    image: IMAGES.jobTalk[0],
  },
];

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
};

/** 活動介紹頁目錄（含外部資源） */
export const CATALOG_DISPLAY_CARDS = [...BOOKABLE_ACTIVITY_CARDS, WRITING_WORKSHOP_CARD];

/** 活動介紹 Modal Tab（僅可預約的四類） */
export const ACTIVITY_TAB_ITEMS = BOOKABLE_ACTIVITY_CARDS.map((card) => ({
  id: card.slug,
  labelKey: card.titleKey,
}));
