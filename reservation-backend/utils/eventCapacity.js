'use strict';

const eventTypeService = require('../services/eventTypeService');
const {
  DEFAULT_EVENT_TYPE_CODE,
} = require('../constants/eventTypeCatalog');

const DEFAULT_ET_GROUP_COUNT = 9;
const DEFAULT_ET_PER_GROUP_CAPACITY = 4;
const MAX_GROUP_COUNT = 20;
const MAX_PER_GROUP_CAPACITY = 30;
const MAX_TOTAL_CAPACITY = 300;
const MAX_NON_ET_CAPACITY = 100;

/** Sequelize where／相容查詢用：code + legacy 顯示名 */
const ENGLISH_TABLE_EVENT_TYPE_ALIASES = Object.freeze(['english_table', 'English Table', 'ET']);
const ENGLISH_CLUB_EVENT_TYPE_ALIASES = Object.freeze(['english_club', 'English Club', 'EC']);

function matchesAliasList(eventType, aliases) {
  const raw = String(eventType || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return aliases.some((alias) => String(alias).toLowerCase() === lower);
}

/**
 * 是否為 English Table（相容 code `english_table` 與 legacy 顯示名）。
 * 別名比對優先，避免 DB catalog／快取未暖機時誤判。
 */
function isEnglishTableEventType(eventType) {
  if (matchesAliasList(eventType, ENGLISH_TABLE_EVENT_TYPE_ALIASES)) return true;
  try {
    return eventTypeService.matchesEventTypeCode(eventType, 'english_table');
  } catch {
    return false;
  }
}

/** 是否為 English Club（相容 code `english_club` 與 legacy 顯示名） */
function isEnglishClubEventType(eventType) {
  if (matchesAliasList(eventType, ENGLISH_CLUB_EVENT_TYPE_ALIASES)) return true;
  try {
    return eventTypeService.matchesEventTypeCode(eventType, 'english_club');
  } catch {
    return false;
  }
}

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/**
 * 正規化活動名額欄位；grouped 模式以 組數×每組人數=總人數 為準。
 */
function normalizeEventCapacityInput({
  eventType,
  groupCount,
  perGroupCapacity,
  maxCapacity,
  typeConfig,
} = {}) {
  const cfg = typeConfig || eventTypeService.resolveTypeConfigSync(eventType || DEFAULT_EVENT_TYPE_CODE);
  const isGrouped = eventTypeService.isGroupedCapacityMode(cfg);
  const maxGroupedTotal = cfg.maxCapacityCap || MAX_TOTAL_CAPACITY;
  const maxSimple = cfg.maxCapacityCap || MAX_NON_ET_CAPACITY;
  const maxGroups = cfg.maxGroupCount || MAX_GROUP_COUNT;
  const maxPerGroup = cfg.maxPerGroup || MAX_PER_GROUP_CAPACITY;
  const defaultGc = cfg.defaultGroupCount || DEFAULT_ET_GROUP_COUNT;
  const defaultPgc = cfg.defaultPerGroupCapacity || DEFAULT_ET_PER_GROUP_CAPACITY;

  if (!isGrouped) {
    const cap = toPositiveInt(maxCapacity);
    if (!cap) return { error: `請輸入有效的總人數（1-${maxSimple}）` };
    if (cap > maxSimple) {
      return { error: `此活動類型總人數不可超過 ${maxSimple}` };
    }
    return { groupCount: null, perGroupCapacity: null, maxCapacity: cap };
  }

  let gc = toPositiveInt(groupCount);
  let pgc = toPositiveInt(perGroupCapacity);
  const mcInput = toPositiveInt(maxCapacity);

  if (!gc) gc = defaultGc;
  if (!pgc) pgc = defaultPgc;

  if (gc > maxGroups) {
    return { error: `組數不可超過 ${maxGroups}` };
  }
  if (pgc > maxPerGroup) {
    return { error: `每組人數不可超過 ${maxPerGroup}` };
  }

  const mc = gc * pgc;

  if (mcInput && mcInput !== mc) {
    return { error: `總人數須等於組數×每組人數（${gc}×${pgc}=${mc}）` };
  }

  if (mc > maxGroupedTotal) {
    return { error: `總人數不可超過 ${maxGroupedTotal}` };
  }

  return { groupCount: gc, perGroupCapacity: pgc, maxCapacity: mc };
}

function resolveLegacyGroupCount(event) {
  if (!event) return DEFAULT_ET_GROUP_COUNT;
  const gc = toPositiveInt(event.groupCount);
  return gc || DEFAULT_ET_GROUP_COUNT;
}

function formatCapacityPayload(event) {
  if (!event) return {};
  const base = {
    maxCapacity: event.maxCapacity,
    groupCount: event.groupCount ?? null,
    perGroupCapacity: event.perGroupCapacity ?? null,
  };
  if (eventTypeService.isGroupedCapacityMode(event.eventType) && base.groupCount && base.perGroupCapacity) {
    base.totalCapacity = base.groupCount * base.perGroupCapacity;
  }
  return base;
}

module.exports = {
  DEFAULT_ET_GROUP_COUNT,
  DEFAULT_ET_PER_GROUP_CAPACITY,
  MAX_GROUP_COUNT,
  MAX_PER_GROUP_CAPACITY,
  MAX_TOTAL_CAPACITY,
  MAX_NON_ET_CAPACITY,
  ENGLISH_TABLE_EVENT_TYPE_ALIASES,
  ENGLISH_CLUB_EVENT_TYPE_ALIASES,
  isEnglishTableEventType,
  isEnglishClubEventType,
  toPositiveInt,
  normalizeEventCapacityInput,
  resolveLegacyGroupCount,
  formatCapacityPayload,
};
