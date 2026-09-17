'use strict';

const { Op } = require('sequelize');
const EventType = require('../models/EventType');
const Event = require('../models/Event');
const {
  DEFAULT_EVENT_TYPES,
  DEFAULT_BY_CODE,
  DEFAULT_EVENT_TYPE_CODE,
  OPEN_RULE_TYPES,
  CAPACITY_MODES,
  CUTOFF_HOURS_MIN,
  CUTOFF_HOURS_MAX,
  normalizeEventTypeCode,
} = require('../constants/eventTypeCatalog');
const siteContentService = require('./siteContentService');
const logger = require('../utils/logger');

const CODE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** @type {{ byCode: Map<string, object>, byAlias: Map<string, object>, bySlug: Map<string, object>, list: object[], at: number } | null} */
let catalogCache = null;
const CACHE_TTL_MS = 30_000;

function clonePlain(row) {
  if (!row) return null;
  if (typeof row.get === 'function') return row.get({ plain: true });
  return { ...row };
}

function toPublicDto(row) {
  const plain = clonePlain(row);
  if (!plain) return null;
  return {
    code: plain.code,
    displayName: plain.displayName,
    abbreviation: plain.abbreviation || '',
    slug: plain.slug,
    sortOrder: plain.sortOrder,
    isActive: !!plain.isActive,
    legacyAliases: Array.isArray(plain.legacyAliases) ? plain.legacyAliases : [],
    openRule: plain.openRule && typeof plain.openRule === 'object' ? plain.openRule : { type: OPEN_RULE_TYPES.DAY_BEFORE, days: 1, hour: 12, minute: 0 },
    cutoffHours: Number(plain.cutoffHours),
    capacityMode: plain.capacityMode === CAPACITY_MODES.GROUPED ? CAPACITY_MODES.GROUPED : CAPACITY_MODES.SIMPLE,
    defaultGroupCount: plain.defaultGroupCount == null ? null : Number(plain.defaultGroupCount),
    defaultPerGroupCapacity: plain.defaultPerGroupCapacity == null ? null : Number(plain.defaultPerGroupCapacity),
    maxCapacityCap: plain.maxCapacityCap == null ? null : Number(plain.maxCapacityCap),
    maxGroupCount: plain.maxGroupCount == null ? null : Number(plain.maxGroupCount),
    maxPerGroup: plain.maxPerGroup == null ? null : Number(plain.maxPerGroup),
    surveyGateEnabled: !!plain.surveyGateEnabled,
  };
}

function buildIndex(rows) {
  const byCode = new Map();
  const byAlias = new Map();
  const bySlug = new Map();
  const list = [];
  for (const raw of rows) {
    const dto = toPublicDto(raw);
    if (!dto?.code) continue;
    list.push(dto);
    byCode.set(dto.code, dto);
    byAlias.set(dto.code.toLowerCase(), dto);
    byAlias.set(String(dto.displayName).toLowerCase(), dto);
    bySlug.set(String(dto.slug).toLowerCase(), dto);
    for (const alias of dto.legacyAliases || []) {
      byAlias.set(String(alias).toLowerCase(), dto);
    }
  }
  list.sort((a, b) => (a.sortOrder - b.sortOrder) || a.code.localeCompare(b.code));
  return { byCode, byAlias, bySlug, list, at: Date.now() };
}

function fallbackCatalog() {
  return buildIndex(DEFAULT_EVENT_TYPES.map((r) => ({ ...r })));
}

function invalidateCatalogCache() {
  catalogCache = null;
}

async function refreshCatalogCache({ force = false } = {}) {
  if (!force && catalogCache && Date.now() - catalogCache.at < CACHE_TTL_MS) {
    return catalogCache;
  }
  try {
    const rows = await EventType.findAll({ order: [['sortOrder', 'ASC'], ['code', 'ASC']] });
    catalogCache = rows.length ? buildIndex(rows) : fallbackCatalog();
  } catch (_) {
    catalogCache = fallbackCatalog();
  }
  return catalogCache;
}

function getCatalogSync() {
  return catalogCache || fallbackCatalog();
}

function resolveFromCatalog(catalog, raw) {
  const key = String(raw || '').trim();
  if (!key) return null;
  return (
    catalog.byCode.get(key)
    || catalog.byAlias.get(key.toLowerCase())
    || catalog.bySlug.get(key.toLowerCase())
    || null
  );
}

/**
 * 同步解析類型設定（優先快取；未命中用 seed fallback）。
 * 同時相容舊顯示名與新 code。
 * @param {string} rawEventType
 * @param {{ fallbackDefault?: boolean }} [options] - fallbackDefault=false 時未知類型回 null（權限用）
 */
function resolveTypeConfigSync(rawEventType, { fallbackDefault = true } = {}) {
  const catalog = getCatalogSync();
  const hit = resolveFromCatalog(catalog, rawEventType);
  if (hit) return hit;
  const code = normalizeEventTypeCode(rawEventType);
  if (code && DEFAULT_BY_CODE[code]) return toPublicDto(DEFAULT_BY_CODE[code]);
  if (!fallbackDefault) return null;
  return toPublicDto(DEFAULT_BY_CODE[DEFAULT_EVENT_TYPE_CODE]);
}

async function resolveTypeConfig(rawEventType) {
  const catalog = await refreshCatalogCache();
  const hit = resolveFromCatalog(catalog, rawEventType);
  if (hit) return hit;
  return resolveTypeConfigSync(rawEventType);
}

async function listEventTypes({ activeOnly = false, includeInactive = true } = {}) {
  const catalog = await refreshCatalogCache();
  if (activeOnly || includeInactive === false) {
    return catalog.list.filter((r) => r.isActive);
  }
  return catalog.list.slice();
}

async function getEventTypeByCode(code) {
  const catalog = await refreshCatalogCache();
  return catalog.byCode.get(String(code || '').trim()) || null;
}

function validateOpenRule(openRule) {
  if (!openRule || typeof openRule !== 'object') {
    return { error: 'openRule 必須為物件' };
  }
  const type = String(openRule.type || '').trim();
  const hour = Number(openRule.hour);
  const minute = Number(openRule.minute ?? 0);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return { error: 'openRule.hour 須為 0–23' };
  }
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
    return { error: 'openRule.minute 須為 0–59' };
  }

  if (type === OPEN_RULE_TYPES.DAY_BEFORE || type === OPEN_RULE_TYPES.DAYS_BEFORE) {
    const days = Number(openRule.days ?? (type === OPEN_RULE_TYPES.DAY_BEFORE ? 1 : 7));
    if (!Number.isFinite(days) || days < 0 || days > 60) {
      return { error: 'openRule.days 須為 0–60' };
    }
    return {
      value: {
        type,
        days: Math.floor(days),
        hour: Math.floor(hour),
        minute: Math.floor(minute),
      },
    };
  }

  if (type === OPEN_RULE_TYPES.PREV_WEEKDAY) {
    const weekday = Number(openRule.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return { error: 'openRule.weekday 須為 0（日）–6（六）' };
    }
    return {
      value: {
        type,
        weekday,
        hour: Math.floor(hour),
        minute: Math.floor(minute),
      },
    };
  }

  return { error: 'openRule.type 不支援' };
}

function validateCutoffHours(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: 'cutoffHours 必須為數字' };
  if (n < CUTOFF_HOURS_MIN || n > CUTOFF_HOURS_MAX) {
    return { error: `cutoffHours 須為 ${CUTOFF_HOURS_MIN}–${CUTOFF_HOURS_MAX}` };
  }
  return { value: Math.round(n * 100) / 100 };
}

function normalizePayload(input = {}, { isCreate = false } = {}) {
  const errors = [];
  let code = String(input.code || '').trim();
  if (isCreate) {
    if (!CODE_PATTERN.test(code)) {
      errors.push('code 須為小寫 snake_case（例如 workshop）');
    }
  } else if (input.code != null) {
    code = String(input.code).trim();
  }

  const displayName = String(input.displayName ?? '').trim();
  if (!displayName) errors.push('displayName 必填');

  const abbreviation = String(input.abbreviation ?? '').trim().slice(0, 16);
  let slug = String(input.slug ?? '').trim().toLowerCase();
  if (!slug && displayName) {
    slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  if (!SLUG_PATTERN.test(slug)) errors.push('slug 格式無效');

  const openRuleResult = validateOpenRule(input.openRule);
  if (openRuleResult.error) errors.push(openRuleResult.error);

  const cutoffResult = validateCutoffHours(input.cutoffHours ?? 2);
  if (cutoffResult.error) errors.push(cutoffResult.error);

  const capacityMode = String(input.capacityMode || CAPACITY_MODES.SIMPLE).trim();
  if (![CAPACITY_MODES.SIMPLE, CAPACITY_MODES.GROUPED].includes(capacityMode)) {
    errors.push('capacityMode 須為 simple 或 grouped');
  }

  const legacyAliases = Array.isArray(input.legacyAliases)
    ? input.legacyAliases.map((a) => String(a).trim()).filter(Boolean)
    : [];

  if (errors.length) {
    const err = new Error(errors.join('；'));
    err.status = 400;
    err.code = 'EVENT_TYPE_VALIDATION';
    throw err;
  }

  return {
    ...(isCreate ? { code } : {}),
    displayName,
    abbreviation,
    slug,
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 100,
    isActive: input.isActive !== false && input.isActive !== 0,
    legacyAliases,
    openRule: openRuleResult.value,
    cutoffHours: cutoffResult.value,
    capacityMode,
    defaultGroupCount: input.defaultGroupCount == null || input.defaultGroupCount === ''
      ? null
      : Math.max(1, Math.floor(Number(input.defaultGroupCount))),
    defaultPerGroupCapacity: input.defaultPerGroupCapacity == null || input.defaultPerGroupCapacity === ''
      ? null
      : Math.max(1, Math.floor(Number(input.defaultPerGroupCapacity))),
    maxCapacityCap: input.maxCapacityCap == null || input.maxCapacityCap === ''
      ? null
      : Math.max(1, Math.floor(Number(input.maxCapacityCap))),
    maxGroupCount: input.maxGroupCount == null || input.maxGroupCount === ''
      ? null
      : Math.max(1, Math.floor(Number(input.maxGroupCount))),
    maxPerGroup: input.maxPerGroup == null || input.maxPerGroup === ''
      ? null
      : Math.max(1, Math.floor(Number(input.maxPerGroup))),
    surveyGateEnabled: !!input.surveyGateEnabled,
  };
}

async function createEventType(input) {
  const payload = normalizePayload(input, { isCreate: true });
  const existing = await EventType.findByPk(payload.code);
  if (existing) {
    const err = new Error('活動類型 code 已存在');
    err.status = 409;
    err.code = 'EVENT_TYPE_EXISTS';
    throw err;
  }
  const slugHit = await EventType.findOne({ where: { slug: payload.slug } });
  if (slugHit) {
    const err = new Error('slug 已被使用');
    err.status = 409;
    err.code = 'EVENT_TYPE_SLUG_EXISTS';
    throw err;
  }
  const row = await EventType.create(payload);
  invalidateCatalogCache();
  await refreshCatalogCache({ force: true });
  const dto = toPublicDto(row);
  try {
    await siteContentService.ensureActivityTypeIntroContent(dto);
  } catch (err) {
    logger.warn({ err, code: dto.code }, 'ensureActivityTypeIntroContent failed after createEventType');
  }
  return dto;
}

async function updateEventType(code, input) {
  const row = await EventType.findByPk(code);
  if (!row) {
    const err = new Error('找不到活動類型');
    err.status = 404;
    err.code = 'EVENT_TYPE_NOT_FOUND';
    throw err;
  }
  const payload = normalizePayload({ ...toPublicDto(row), ...input, code }, { isCreate: false });
  if (payload.slug !== row.slug) {
    const slugHit = await EventType.findOne({
      where: { slug: payload.slug, code: { [Op.ne]: code } },
    });
    if (slugHit) {
      const err = new Error('slug 已被使用');
      err.status = 409;
      err.code = 'EVENT_TYPE_SLUG_EXISTS';
      throw err;
    }
  }
  await row.update(payload);
  invalidateCatalogCache();
  await refreshCatalogCache({ force: true });
  return toPublicDto(row);
}

async function setEventTypeActive(code, isActive) {
  const row = await EventType.findByPk(code);
  if (!row) {
    const err = new Error('找不到活動類型');
    err.status = 404;
    throw err;
  }
  await row.update({ isActive: !!isActive });
  invalidateCatalogCache();
  await refreshCatalogCache({ force: true });
  return toPublicDto(row);
}

async function softDeleteEventType(code) {
  const count = await Event.count({ where: { eventType: code } });
  if (count > 0) {
    const err = new Error(`仍有 ${count} 筆活動使用此類型，僅可停用不可刪除`);
    err.status = 409;
    err.code = 'EVENT_TYPE_IN_USE';
    throw err;
  }
  const row = await EventType.findByPk(code);
  if (!row) {
    const err = new Error('找不到活動類型');
    err.status = 404;
    throw err;
  }
  await row.destroy();
  invalidateCatalogCache();
  await refreshCatalogCache({ force: true });
  return { deleted: true, code };
}

/** 將任意輸入正規成 code（寫入 Event 用） */
function coerceEventTypeCode(raw, { fallback = DEFAULT_EVENT_TYPE_CODE } = {}) {
  const cfg = resolveTypeConfigSync(raw, { fallbackDefault: false });
  return (cfg && cfg.code) || fallback;
}

/** UI／報表顯示名 */
function getEventTypeDisplayName(raw) {
  const cfg = resolveTypeConfigSync(raw, { fallbackDefault: false });
  if (cfg?.displayName) return cfg.displayName;
  const s = String(raw || '').trim();
  return s || '';
}

/**
 * Sequelize where／相容查詢：同一活動類型的 code + displayName + legacyAliases
 * @returns {string[]}
 */
function getEventTypeQueryValues(raw) {
  const cfg = resolveTypeConfigSync(raw, { fallbackDefault: false });
  if (!cfg) {
    const s = String(raw || '').trim();
    return s ? [s] : [];
  }
  return [...new Set([cfg.code, cfg.displayName, ...(cfg.legacyAliases || [])].filter(Boolean))];
}

function matchesEventTypeCode(raw, code) {
  const cfg = resolveTypeConfigSync(raw, { fallbackDefault: false });
  return cfg?.code === String(code || '').trim();
}

function isGroupedCapacityMode(rawEventTypeOrConfig) {
  if (rawEventTypeOrConfig && typeof rawEventTypeOrConfig === 'object' && rawEventTypeOrConfig.capacityMode) {
    return rawEventTypeOrConfig.capacityMode === CAPACITY_MODES.GROUPED;
  }
  const cfg = resolveTypeConfigSync(rawEventTypeOrConfig);
  return cfg.capacityMode === CAPACITY_MODES.GROUPED;
}

function isSurveyGateEnabledForType(rawEventTypeOrConfig) {
  if (rawEventTypeOrConfig && typeof rawEventTypeOrConfig === 'object' && 'surveyGateEnabled' in rawEventTypeOrConfig) {
    return !!rawEventTypeOrConfig.surveyGateEnabled;
  }
  const cfg = resolveTypeConfigSync(rawEventTypeOrConfig);
  return !!cfg.surveyGateEnabled;
}

/** 動態 scope：允許 ALL_SCOPES 以外的活動類型 code */
function isEventTypeScopeCode(scope) {
  const s = String(scope || '').trim();
  if (!CODE_PATTERN.test(s)) return false;
  const reserved = new Set([
    'all',
    'class',
    'survey_english_table',
    'survey_english_club',
    'english_test',
  ]);
  if (reserved.has(s)) return false;
  return true;
}

module.exports = {
  toPublicDto,
  invalidateCatalogCache,
  refreshCatalogCache,
  getCatalogSync,
  resolveTypeConfigSync,
  resolveTypeConfig,
  listEventTypes,
  getEventTypeByCode,
  createEventType,
  updateEventType,
  setEventTypeActive,
  softDeleteEventType,
  coerceEventTypeCode,
  getEventTypeDisplayName,
  getEventTypeQueryValues,
  matchesEventTypeCode,
  isGroupedCapacityMode,
  isSurveyGateEnabledForType,
  isEventTypeScopeCode,
  CODE_PATTERN,
};
