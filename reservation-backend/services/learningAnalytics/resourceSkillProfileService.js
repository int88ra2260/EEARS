'use strict';

const { ResourceSkillProfile } = require('../../models');
const {
  RESOURCE_SKILL_PROFILE_DEFAULTS,
  SKILL_WEIGHT_KEYS,
} = require('./resourceSkillProfileDefaults');

const AGGREGATE_RESOURCE_ID = 0;
const CACHE_TTL_MS = 30_000;

let activeProfiles = { ...RESOURCE_SKILL_PROFILE_DEFAULTS };
let cacheLoadedAt = 0;
let loadPromise = null;

const WEIGHT_FIELD_BY_KEY = Object.freeze({
  listening: 'weightListening',
  reading: 'weightReading',
  speaking: 'weightSpeaking',
  writing: 'weightWriting',
  interaction: 'weightInteraction',
  mediation: 'weightMediation',
  eap: 'weightEap',
  esp: 'weightEsp',
});

function roundWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(1, n)) * 10000) / 10000;
}

function rowToWeights(row) {
  const weights = {};
  for (const key of SKILL_WEIGHT_KEYS) {
    const field = WEIGHT_FIELD_BY_KEY[key];
    weights[key] = roundWeight(row[field]);
  }
  return weights;
}

function weightsToRowFields(weights = {}) {
  const fields = {};
  for (const key of SKILL_WEIGHT_KEYS) {
    const field = WEIGHT_FIELD_BY_KEY[key];
    fields[field] = roundWeight(weights[key]);
  }
  return fields;
}

function cloneDefaultsMap() {
  const merged = {};
  for (const [key, weights] of Object.entries(RESOURCE_SKILL_PROFILE_DEFAULTS)) {
    merged[key] = { ...weights };
  }
  return merged;
}

function getResourceSkillProfilesMap() {
  return activeProfiles;
}

function validateWeights(weights) {
  if (!weights || typeof weights !== 'object') {
    throw new Error('weights 為必填物件');
  }
  for (const key of SKILL_WEIGHT_KEYS) {
    const value = weights[key];
    if (value === undefined || value === null || value === '') continue;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      throw new Error(`${key} 權重須為 0–1 的數字`);
    }
  }
}

function normalizeWeightsInput(weights = {}, fallback = {}) {
  const normalized = {};
  for (const key of SKILL_WEIGHT_KEYS) {
    const raw = weights[key] !== undefined && weights[key] !== null && weights[key] !== ''
      ? weights[key]
      : fallback[key];
    normalized[key] = roundWeight(raw);
  }
  return normalized;
}

function weightsEqual(a = {}, b = {}) {
  return SKILL_WEIGHT_KEYS.every((key) => roundWeight(a[key]) === roundWeight(b[key]));
}

async function loadProfilesFromDb() {
  const merged = cloneDefaultsMap();
  const overrides = new Set();
  try {
    const rows = await ResourceSkillProfile.findAll({
      where: { resourceId: AGGREGATE_RESOURCE_ID },
      order: [['resourceType', 'ASC']],
    });
    for (const row of rows) {
      const key = String(row.resourceType || '').toUpperCase();
      if (!RESOURCE_SKILL_PROFILE_DEFAULTS[key]) continue;
      merged[key] = rowToWeights(row);
      overrides.add(key);
    }
  } catch (error) {
    const code = error?.original?.code || error?.parent?.code;
    if (code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(error.message || '')) {
      return { merged, overrides };
    }
    throw error;
  }
  return { merged, overrides };
}

async function ensureResourceSkillProfilesLoaded({ force = false } = {}) {
  const stale = !cacheLoadedAt || (Date.now() - cacheLoadedAt > CACHE_TTL_MS);
  if (!force && !stale && activeProfiles) return activeProfiles;
  if (loadPromise && !force) {
    await loadPromise;
    return activeProfiles;
  }
  loadPromise = (async () => {
    const { merged } = await loadProfilesFromDb();
    activeProfiles = merged;
    cacheLoadedAt = Date.now();
    return activeProfiles;
  })();
  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

function invalidateProfileCache() {
  cacheLoadedAt = 0;
}

async function listResourceSkillProfilesForSettings() {
  await ensureResourceSkillProfilesLoaded();
  const { overrides } = await loadProfilesFromDb();
  return Object.entries(RESOURCE_SKILL_PROFILE_DEFAULTS).map(([resourceKey, defaultWeights]) => {
    const weights = activeProfiles[resourceKey] || defaultWeights;
    const isCustom = overrides.has(resourceKey);
    return {
      resourceKey,
      weights,
      defaultWeights: { ...defaultWeights },
      editable: true,
      source: isCustom ? 'db' : 'default',
      isCustom,
    };
  });
}

async function upsertResourceSkillProfiles(updates = [], { user } = {}) {
  if (!Array.isArray(updates) || !updates.length) {
    throw new Error('請提供至少一筆 profiles');
  }
  const createdBy = user?.username || user?.account || user?.email || String(user?.id || '');
  const saved = [];

  for (const item of updates) {
    const resourceKey = String(item.resourceKey || item.resource_type || '').toUpperCase();
    if (!RESOURCE_SKILL_PROFILE_DEFAULTS[resourceKey]) {
      throw new Error(`不支援的資源類型：${resourceKey}`);
    }
    validateWeights(item.weights);
    const defaultWeights = RESOURCE_SKILL_PROFILE_DEFAULTS[resourceKey];
    const weights = normalizeWeightsInput(item.weights, defaultWeights);

    if (weightsEqual(weights, defaultWeights)) {
      await ResourceSkillProfile.destroy({
        where: { resourceType: resourceKey, resourceId: AGGREGATE_RESOURCE_ID },
      });
      saved.push({ resourceKey, source: 'default', weights: { ...defaultWeights } });
      continue;
    }

    const fields = weightsToRowFields(weights);
    const [row] = await ResourceSkillProfile.findOrCreate({
      where: { resourceType: resourceKey, resourceId: AGGREGATE_RESOURCE_ID },
      defaults: {
        ...fields,
        createdBy,
      },
    });
    await row.update({ ...fields, createdBy });
    saved.push({ resourceKey, source: 'db', weights });
  }

  invalidateProfileCache();
  await ensureResourceSkillProfilesLoaded({ force: true });
  return { saved, profiles: await listResourceSkillProfilesForSettings() };
}

async function resetResourceSkillProfile(resourceKey, { user } = {}) {
  const key = String(resourceKey || '').toUpperCase();
  if (!RESOURCE_SKILL_PROFILE_DEFAULTS[key]) {
    throw new Error(`不支援的資源類型：${key}`);
  }
  await ResourceSkillProfile.destroy({
    where: { resourceType: key, resourceId: AGGREGATE_RESOURCE_ID },
  });
  invalidateProfileCache();
  await ensureResourceSkillProfilesLoaded({ force: true });
  return {
    resourceKey: key,
    source: 'default',
    weights: { ...RESOURCE_SKILL_PROFILE_DEFAULTS[key] },
    resetBy: user?.username || user?.account || user?.email || String(user?.id || ''),
  };
}

module.exports = {
  AGGREGATE_RESOURCE_ID,
  SKILL_WEIGHT_KEYS,
  RESOURCE_SKILL_PROFILE_DEFAULTS,
  getResourceSkillProfilesMap,
  ensureResourceSkillProfilesLoaded,
  invalidateProfileCache,
  listResourceSkillProfilesForSettings,
  upsertResourceSkillProfiles,
  resetResourceSkillProfile,
  validateWeights,
  normalizeWeightsInput,
  weightsEqual,
};
