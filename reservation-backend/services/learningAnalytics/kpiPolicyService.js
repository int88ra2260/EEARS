'use strict';

const { LearningAnalyticsKpiPolicy } = require('../../models');
const { getBuiltinPolicySeeds, POLICY_SCHEMA_VERSION } = require('./kpiPolicyDefaults');
const { mergeInstrumentThresholds } = require('./kpiInstrumentThresholds');

function serializePolicy(row) {
  const j = typeof row.toJSON === 'function' ? row.toJSON() : row;
  return {
    id: j.id,
    policyKey: j.policyKey,
    name: j.name,
    academicYear: j.academicYear,
    description: j.description,
    definition: j.definitionJson || {},
    isBuiltin: Boolean(j.isBuiltin),
    isArchived: Boolean(j.isArchived),
    createdBy: j.createdBy,
    updatedBy: j.updatedBy,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}

async function ensureBuiltinKpiPolicies() {
  const seeds = getBuiltinPolicySeeds();
  const results = [];
  for (const seed of seeds) {
    const [row, created] = await LearningAnalyticsKpiPolicy.findOrCreate({
      where: { policyKey: seed.policyKey },
      defaults: {
        name: seed.name,
        academicYear: seed.academicYear,
        description: seed.description,
        definitionJson: seed.definition,
        isBuiltin: true,
        isArchived: false,
        createdBy: 'system',
        updatedBy: 'system',
      },
    });
    if (!created && row.isBuiltin) {
      // 內建政策定義隨程式更新同步（名稱／說明／definition）
      await row.update({
        name: seed.name,
        academicYear: seed.academicYear,
        description: seed.description,
        definitionJson: seed.definition,
        updatedBy: 'system',
      });
    }
    results.push(serializePolicy(row));
  }
  return results;
}

async function listKpiPolicies({ includeArchived = false } = {}) {
  await ensureBuiltinKpiPolicies();
  const where = includeArchived ? {} : { isArchived: false };
  const rows = await LearningAnalyticsKpiPolicy.findAll({
    where,
    order: [
      ['academicYear', 'DESC'],
      ['id', 'ASC'],
    ],
  });
  return rows.map(serializePolicy);
}

async function getKpiPolicyById(id) {
  await ensureBuiltinKpiPolicies();
  const row = await LearningAnalyticsKpiPolicy.findByPk(id);
  return row ? serializePolicy(row) : null;
}

async function getKpiPolicyByKey(policyKey) {
  await ensureBuiltinKpiPolicies();
  const row = await LearningAnalyticsKpiPolicy.findOne({
    where: { policyKey: String(policyKey || '').trim() },
  });
  return row ? serializePolicy(row) : null;
}

function validateDefinition(definition) {
  if (!definition || typeof definition !== 'object') {
    const err = new Error('政策定義不可為空');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(definition.dimensions) || definition.dimensions.length === 0) {
    const err = new Error('政策至少需要一個 dimension');
    err.status = 400;
    throw err;
  }
  for (const dim of definition.dimensions) {
    if (!dim.id || !dim.label || !Array.isArray(dim.skills) || !dim.skills.length) {
      const err = new Error('dimension 需包含 id、label、skills');
      err.status = 400;
      throw err;
    }
    if (!['pair', 'skill'].includes(String(dim.kind))) {
      const err = new Error(`dimension.kind 無效：${dim.kind}`);
      err.status = 400;
      throw err;
    }
  }
  return {
    ...definition,
    schemaVersion: definition.schemaVersion || POLICY_SCHEMA_VERSION,
    instruments: mergeInstrumentThresholds(definition.instruments),
  };
}

async function createKpiPolicy(payload = {}, { user } = {}) {
  const actor = user?.username || user?.account || user?.id || 'admin';
  const policyKey = String(payload.policyKey || '').trim();
  if (!policyKey) {
    const err = new Error('policyKey 必填');
    err.status = 400;
    throw err;
  }
  const definition = validateDefinition(payload.definition);
  try {
    const row = await LearningAnalyticsKpiPolicy.create({
      policyKey,
      name: String(payload.name || policyKey).trim(),
      academicYear: payload.academicYear != null ? String(payload.academicYear) : null,
      description: payload.description || null,
      definitionJson: definition,
      isBuiltin: false,
      isArchived: false,
      createdBy: String(actor),
      updatedBy: String(actor),
    });
    return serializePolicy(row);
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      const err = new Error('policyKey 已存在');
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

async function cloneKpiPolicy(id, payload = {}, { user } = {}) {
  const source = await LearningAnalyticsKpiPolicy.findByPk(id);
  if (!source) {
    const err = new Error('找不到政策');
    err.status = 404;
    throw err;
  }
  const actor = user?.username || user?.account || user?.id || 'admin';
  const baseKey = String(payload.policyKey || `${source.policyKey}-copy`).trim();
  let policyKey = baseKey;
  let attempt = 1;
  while (await LearningAnalyticsKpiPolicy.findOne({ where: { policyKey } })) {
    attempt += 1;
    policyKey = `${baseKey}-${attempt}`;
  }
  const definition = validateDefinition({
    ...(source.definitionJson || {}),
    ...(payload.definition || {}),
  });
  const row = await LearningAnalyticsKpiPolicy.create({
    policyKey,
    name: String(payload.name || `${source.name}（副本）`).trim(),
    academicYear: payload.academicYear != null
      ? String(payload.academicYear)
      : source.academicYear,
    description: payload.description != null ? payload.description : source.description,
    definitionJson: definition,
    isBuiltin: false,
    isArchived: false,
    createdBy: String(actor),
    updatedBy: String(actor),
  });
  return serializePolicy(row);
}

async function updateKpiPolicy(id, payload = {}, { user } = {}) {
  const row = await LearningAnalyticsKpiPolicy.findByPk(id);
  if (!row) {
    const err = new Error('找不到政策');
    err.status = 404;
    throw err;
  }
  if (row.isBuiltin) {
    const err = new Error('內建政策不可直接修改，請先複製');
    err.status = 400;
    throw err;
  }
  const actor = user?.username || user?.account || user?.id || 'admin';
  const patch = {
    updatedBy: String(actor),
  };
  if (payload.name != null) patch.name = String(payload.name).trim();
  if (payload.academicYear !== undefined) {
    patch.academicYear = payload.academicYear != null ? String(payload.academicYear) : null;
  }
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.definition != null) patch.definitionJson = validateDefinition(payload.definition);
  if (payload.isArchived != null) patch.isArchived = Boolean(payload.isArchived);
  await row.update(patch);
  return serializePolicy(row);
}

async function archiveKpiPolicy(id, { user } = {}) {
  return updateKpiPolicy(id, { isArchived: true }, { user });
}

module.exports = {
  ensureBuiltinKpiPolicies,
  listKpiPolicies,
  getKpiPolicyById,
  getKpiPolicyByKey,
  createKpiPolicy,
  cloneKpiPolicy,
  updateKpiPolicy,
  archiveKpiPolicy,
  serializePolicy,
};
