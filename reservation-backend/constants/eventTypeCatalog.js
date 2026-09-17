'use strict';

/**
 * 活動類型目錄：預設 seed 與 legacy 顯示名對照。
 * 正式來源為 DB event_types；此檔供 migration／快取未暖機時的 fallback。
 */

const OPEN_RULE_TYPES = Object.freeze({
  DAY_BEFORE: 'day_before',
  DAYS_BEFORE: 'days_before',
  PREV_WEEKDAY: 'prev_weekday',
});

const CAPACITY_MODES = Object.freeze({
  SIMPLE: 'simple',
  GROUPED: 'grouped',
});

/** @type {ReadonlyArray<object>} */
const DEFAULT_EVENT_TYPES = Object.freeze([
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
    defaultGroupCount: null,
    defaultPerGroupCapacity: null,
    maxCapacityCap: 100,
    maxGroupCount: null,
    maxPerGroup: null,
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
    defaultGroupCount: null,
    defaultPerGroupCapacity: null,
    maxCapacityCap: 100,
    maxGroupCount: null,
    maxPerGroup: null,
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
    defaultGroupCount: null,
    defaultPerGroupCapacity: null,
    maxCapacityCap: 100,
    maxGroupCount: null,
    maxPerGroup: null,
    surveyGateEnabled: false,
  },
]);

const CODE_BY_LEGACY = (() => {
  /** @type {Record<string, string>} */
  const map = {};
  for (const row of DEFAULT_EVENT_TYPES) {
    map[row.code] = row.code;
    map[String(row.displayName).toLowerCase()] = row.code;
    for (const alias of row.legacyAliases || []) {
      map[String(alias).toLowerCase()] = row.code;
    }
  }
  return Object.freeze(map);
})();

const DEFAULT_BY_CODE = Object.freeze(
  Object.fromEntries(DEFAULT_EVENT_TYPES.map((row) => [row.code, row]))
);

const DEFAULT_EVENT_TYPE_CODE = 'english_table';

const CUTOFF_HOURS_MIN = 0;
const CUTOFF_HOURS_MAX = 72;

function normalizeEventTypeCode(raw) {
  const key = String(raw || '').trim();
  if (!key) return null;
  if (DEFAULT_BY_CODE[key]) return key;
  return CODE_BY_LEGACY[key.toLowerCase()] || null;
}

module.exports = {
  OPEN_RULE_TYPES,
  CAPACITY_MODES,
  DEFAULT_EVENT_TYPES,
  DEFAULT_BY_CODE,
  CODE_BY_LEGACY,
  DEFAULT_EVENT_TYPE_CODE,
  CUTOFF_HOURS_MIN,
  CUTOFF_HOURS_MAX,
  normalizeEventTypeCode,
};
