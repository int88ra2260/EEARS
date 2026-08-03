'use strict';

const { LearningAnalyticsLvaConfig } = require('../../models');
const {
  LVA_CONFIG_DEFAULTS,
  LVA_CONFIG_GROUPS,
  cloneDefaults,
} = require('./learningAnalyticsLvaDefaults');

const CACHE_TTL_MS = 30_000;
const SINGLETON_ID = 1;

let activeConfig = cloneDefaults();
let cacheLoadedAt = 0;
let loadPromise = null;

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      out[key] = deepMerge(base[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function getByPath(obj, path) {
  return String(path).split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setByPath(obj, path, value) {
  const keys = String(path).split('.');
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!isPlainObject(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

function unsetByPath(obj, path) {
  const keys = String(path).split('.');
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    cursor = cursor?.[keys[i]];
    if (!cursor) return;
  }
  if (cursor) delete cursor[keys[keys.length - 1]];
}

function valuesEqual(a, b) {
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) === Number(b);
  }
  return a === b;
}

function pruneEmptyObjects(obj) {
  if (!isPlainObject(obj)) return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isPlainObject(value)) {
      const nested = pruneEmptyObjects(value);
      if (Object.keys(nested).length) out[key] = nested;
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function diffFromDefaults(config) {
  const overrides = {};
  for (const group of LVA_CONFIG_GROUPS) {
    for (const field of group.fields) {
      const current = getByPath(config, field.key);
      const fallback = getByPath(LVA_CONFIG_DEFAULTS, field.key);
      if (!valuesEqual(current, fallback)) {
        setByPath(overrides, field.key, current);
      }
    }
  }
  return pruneEmptyObjects(overrides);
}

function validateField(field, value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${field.label} 須為數字`);
  }
  if (field.type === 'integer' && !Number.isInteger(num)) {
    throw new Error(`${field.label} 須為整數`);
  }
  if (field.min != null && num < field.min) {
    throw new Error(`${field.label} 不可小於 ${field.min}`);
  }
  if (field.max != null && num > field.max) {
    throw new Error(`${field.label} 不可大於 ${field.max}`);
  }
  return field.type === 'integer' ? num : num;
}

function findField(key) {
  for (const group of LVA_CONFIG_GROUPS) {
    const field = group.fields.find((item) => item.key === key);
    if (field) return field;
  }
  return null;
}

async function loadOverridesFromDb() {
  try {
    const row = await LearningAnalyticsLvaConfig.findByPk(SINGLETON_ID);
    return row?.configJson && isPlainObject(row.configJson) ? row.configJson : {};
  } catch (error) {
    const code = error?.original?.code || error?.parent?.code;
    if (code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(error.message || '')) {
      return {};
    }
    throw error;
  }
}

async function ensureLvaConfigLoaded({ force = false } = {}) {
  const stale = !cacheLoadedAt || (Date.now() - cacheLoadedAt > CACHE_TTL_MS);
  if (!force && !stale && activeConfig) return activeConfig;
  if (loadPromise && !force) {
    await loadPromise;
    return activeConfig;
  }
  loadPromise = (async () => {
    const overrides = await loadOverridesFromDb();
    activeConfig = deepMerge(cloneDefaults(), overrides);
    cacheLoadedAt = Date.now();
    return activeConfig;
  })();
  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

function invalidateLvaConfigCache() {
  cacheLoadedAt = 0;
}

function getLvaConfig() {
  return activeConfig || cloneDefaults();
}

function resolveMatchingCaliper(queryValue) {
  const fromQuery = Number(queryValue);
  if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;
  return getLvaConfig().matchingCaliper ?? LVA_CONFIG_DEFAULTS.matchingCaliper;
}

async function listLvaConfigForSettings() {
  await ensureLvaConfigLoaded();
  const overrides = await loadOverridesFromDb();
  const merged = getLvaConfig();

  const groups = LVA_CONFIG_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    description: group.description,
    fields: group.fields.map((field) => {
      const value = getByPath(merged, field.key);
      const defaultValue = getByPath(LVA_CONFIG_DEFAULTS, field.key);
      const overrideValue = getByPath(overrides, field.key);
      return {
        ...field,
        value,
        defaultValue,
        isCustom: overrideValue !== undefined && !valuesEqual(value, defaultValue),
      };
    }),
  }));

  return {
    groups,
    matchingCaliperDefault: merged.matchingCaliper,
    hasCustomOverrides: Object.keys(pruneEmptyObjects(overrides)).length > 0,
  };
}

async function upsertLvaConfig(updates = [], { user } = {}) {
  if (!Array.isArray(updates) || !updates.length) {
    throw new Error('請提供至少一項 LVA 參數');
  }

  const overrides = await loadOverridesFromDb();
  const nextOverrides = deepMerge({}, overrides);

  for (const item of updates) {
    const key = item?.key;
    const field = findField(key);
    if (!field) throw new Error(`不支援的 LVA 參數：${key}`);
    const parsed = validateField(field, item.value);
    const defaultValue = getByPath(LVA_CONFIG_DEFAULTS, key);
    if (valuesEqual(parsed, defaultValue)) {
      unsetByPath(nextOverrides, key);
    } else {
      setByPath(nextOverrides, key, parsed);
    }
  }

  const updatedBy = user?.username || user?.account || user?.email || String(user?.id || '');
  const payload = pruneEmptyObjects(nextOverrides);

  try {
    const [row] = await LearningAnalyticsLvaConfig.findOrCreate({
      where: { id: SINGLETON_ID },
      defaults: { configJson: payload, updatedBy },
    });
    await row.update({ configJson: payload, updatedBy });
  } catch (error) {
    const code = error?.original?.code || error?.parent?.code;
    if (code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(error.message || '')) {
      throw new Error('LVA 設定資料表尚未建立，請先執行資料庫 migration');
    }
    throw error;
  }

  invalidateLvaConfigCache();
  await ensureLvaConfigLoaded({ force: true });
  return listLvaConfigForSettings();
}

async function resetLvaConfig({ user } = {}) {
  try {
    await LearningAnalyticsLvaConfig.destroy({ where: { id: SINGLETON_ID } });
  } catch (error) {
    const code = error?.original?.code || error?.parent?.code;
    if (code !== 'ER_NO_SUCH_TABLE' && !/doesn't exist/i.test(error.message || '')) {
      throw error;
    }
  }
  invalidateLvaConfigCache();
  await ensureLvaConfigLoaded({ force: true });
  return {
    resetBy: user?.username || user?.account || user?.email || String(user?.id || ''),
    lvaConfig: await listLvaConfigForSettings(),
  };
}

module.exports = {
  LVA_CONFIG_DEFAULTS,
  LVA_CONFIG_GROUPS,
  ensureLvaConfigLoaded,
  invalidateLvaConfigCache,
  getLvaConfig,
  resolveMatchingCaliper,
  listLvaConfigForSettings,
  upsertLvaConfig,
  resetLvaConfig,
};
