/**
 * 活動類型目錄（前端 fallback／離線）。正式來源 GET /api/event-types。
 */

export const OPEN_RULE_TYPES = Object.freeze({
  DAY_BEFORE: 'day_before',
  DAYS_BEFORE: 'days_before',
  PREV_WEEKDAY: 'prev_weekday',
});

export const CAPACITY_MODES = Object.freeze({
  SIMPLE: 'simple',
  GROUPED: 'grouped',
});

export const DEFAULT_EVENT_TYPE_CODE = 'english_table';

export const DEFAULT_EVENT_TYPES = Object.freeze([
  {
    code: 'english_table',
    displayName: 'English Table',
    abbreviation: 'ET',
    slug: 'english-table',
    sortOrder: 10,
    isActive: true,
    legacyAliases: ['English Table', 'ET'],
    openRule: { type: OPEN_RULE_TYPES.DAY_BEFORE, days: 1, hour: 12, minute: 0 },
    cutoffHours: 2,
    capacityMode: CAPACITY_MODES.GROUPED,
    defaultGroupCount: 9,
    defaultPerGroupCapacity: 4,
    maxCapacityCap: 300,
    maxGroupCount: 20,
    maxPerGroup: 30,
    surveyGateEnabled: true,
  },
  {
    code: 'job_talk',
    displayName: 'Job Talk',
    abbreviation: 'JT',
    slug: 'job-talk',
    sortOrder: 20,
    isActive: true,
    legacyAliases: ['Job Talk', 'JT'],
    openRule: { type: OPEN_RULE_TYPES.DAYS_BEFORE, days: 7, hour: 12, minute: 0 },
    cutoffHours: 2,
    capacityMode: CAPACITY_MODES.SIMPLE,
    maxCapacityCap: 100,
    surveyGateEnabled: false,
  },
  {
    code: 'english_club',
    displayName: 'English Club',
    abbreviation: 'EC',
    slug: 'english-club',
    sortOrder: 30,
    isActive: true,
    legacyAliases: ['English Club', 'EC'],
    openRule: { type: OPEN_RULE_TYPES.PREV_WEEKDAY, weekday: 3, hour: 12, minute: 0 },
    cutoffHours: 2,
    capacityMode: CAPACITY_MODES.SIMPLE,
    maxCapacityCap: 100,
    surveyGateEnabled: true,
  },
  {
    code: 'international_forum',
    displayName: 'International Forum',
    abbreviation: 'IF',
    slug: 'international-forum',
    sortOrder: 40,
    isActive: false,
    legacyAliases: ['International Forum', 'IF'],
    openRule: { type: OPEN_RULE_TYPES.PREV_WEEKDAY, weekday: 5, hour: 12, minute: 0 },
    cutoffHours: 2,
    capacityMode: CAPACITY_MODES.SIMPLE,
    maxCapacityCap: 100,
    surveyGateEnabled: false,
  },
]);

const BY_CODE = Object.freeze(
  Object.fromEntries(DEFAULT_EVENT_TYPES.map((r) => [r.code, r]))
);

const ALIAS_TO_CODE = (() => {
  const map = {};
  for (const row of DEFAULT_EVENT_TYPES) {
    map[row.code] = row.code;
    map[String(row.displayName).toLowerCase()] = row.code;
    map[String(row.slug).toLowerCase()] = row.code;
    for (const alias of row.legacyAliases || []) {
      map[String(alias).toLowerCase()] = row.code;
    }
  }
  return Object.freeze(map);
})();

export function normalizeEventTypeCode(raw) {
  const key = String(raw || '').trim();
  if (!key) return null;
  if (BY_CODE[key]) return key;
  return ALIAS_TO_CODE[key.toLowerCase()] || null;
}

export function getDefaultTypeConfig(raw) {
  const code = normalizeEventTypeCode(raw) || DEFAULT_EVENT_TYPE_CODE;
  return BY_CODE[code] || BY_CODE[DEFAULT_EVENT_TYPE_CODE];
}

/** UI 顯示用：一律顯示 displayName；未知類型回傳原字串 */
export function getEventTypeDisplayName(raw) {
  const key = String(raw || '').trim();
  if (!key) return '—';
  const code = normalizeEventTypeCode(key);
  if (code && BY_CODE[code]) return BY_CODE[code].displayName;
  return key;
}

/** 表單 <select>：value 一律為 code（「其他」除外） */
export function getEventTypeSelectOptions({ includeOther = false } = {}) {
  const opts = DEFAULT_EVENT_TYPES.filter((r) => r.isActive).map((r) => ({
    value: r.code,
    label: r.displayName,
  }));
  if (includeOther) opts.push({ value: '其他', label: '其他' });
  return opts;
}

export function isEnglishTableEventTypeCode(raw) {
  return normalizeEventTypeCode(raw) === 'english_table';
}

export function isEnglishClubEventTypeCode(raw) {
  return normalizeEventTypeCode(raw) === 'english_club';
}
