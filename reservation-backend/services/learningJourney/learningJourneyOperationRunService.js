'use strict';

const { Op, col, fn, where: sqlWhere } = require('sequelize');
const { LearningJourneyOperationRun, sequelize } = require('../../models');

const OPERATION_TYPES = {
  IMPORT_ENROLLMENT: 'IMPORT_ENROLLMENT',
  IMPORT_EXAM: 'IMPORT_EXAM',
  REBUILD_BEST_SKILL_PROJECTION: 'REBUILD_BEST_SKILL_PROJECTION',
  REBUILD_ANALYTICS: 'REBUILD_ANALYTICS',
  HEALTH_CHECK: 'HEALTH_CHECK',
  SYNC_EWL: 'SYNC_EWL'
};

const STATUSES = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  PARTIAL: 'partial'
};

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toEndOfDayDate(value) {
  const d = toDate(value);
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function operatorFromUser(user) {
  if (!user) return { executedByUserId: null, executedByUsername: null };
  return {
    executedByUserId: user.id == null ? null : String(user.id),
    executedByUsername: user.user || user.username || user.name || null
  };
}

function sanitizeErrorMessage(message) {
  const text = String(message || '').trim();
  if (!text) return null;
  return text.replace(/\s+/g, ' ').slice(0, 2000);
}

function warningsCount(warnings) {
  return Array.isArray(warnings) ? warnings.length : 0;
}

function serializeListRow(row) {
  const j = typeof row?.toJSON === 'function' ? row.toJSON() : row;
  return {
    id: j.id,
    operationType: j.operationType,
    semesterId: j.semesterId,
    status: j.status,
    requestId: j.requestId,
    executedByUsername: j.executedByUsername,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    durationMs: j.durationMs,
    warningsCount: warningsCount(j.warnings),
    errorCode: j.errorCode,
    errorMessage: j.errorMessage,
    archivedAt: j.archivedAt,
    archivedByUsername: j.archivedByUsername,
    cleanupRequestId: j.cleanupRequestId,
    // 列表用精簡摘要（EWL 同步頁等需要）
    resultSummary: j.resultSummary || null,
    dryRun: j.dryRun === true
  };
}

function serializeDetail(row) {
  const j = typeof row?.toJSON === 'function' ? row.toJSON() : row;
  if (!j) return null;
  return {
    id: j.id,
    operationType: j.operationType,
    semesterId: j.semesterId,
    status: j.status,
    requestId: j.requestId,
    executedBy: {
      id: j.executedByUserId,
      username: j.executedByUsername
    },
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    durationMs: j.durationMs,
    source: j.source,
    dryRun: j.dryRun,
    confirm: j.confirm,
    beforeSummary: j.beforeSummary,
    afterSummary: j.afterSummary,
    diffSummary: j.diffSummary,
    resultSummary: j.resultSummary,
    warnings: Array.isArray(j.warnings) ? j.warnings : [],
    errorCode: j.errorCode,
    errorMessage: j.errorMessage,
    archivedAt: j.archivedAt,
    archivedByUserId: j.archivedByUserId,
    archivedByUsername: j.archivedByUsername,
    archiveReason: j.archiveReason,
    cleanupRequestId: j.cleanupRequestId
  };
}

function parseOperationTypes(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRunsWhere(query = {}) {
  const where = {};
  if (!(query.includeArchived === true || String(query.includeArchived || '').toLowerCase() === 'true')) {
    where.archivedAt = null;
  }
  if (query.semesterId) where.semesterId = String(query.semesterId).trim();
  if (query.operationType) {
    const operationTypes = parseOperationTypes(query.operationType);
    if (operationTypes.length === 1) where.operationType = operationTypes[0];
    if (operationTypes.length > 1) where.operationType = { [Op.in]: operationTypes };
  }
  if (query.status) where.status = String(query.status).trim();
  if (query.requestId) where.requestId = { [Op.like]: `%${String(query.requestId).trim()}%` };

  const startedAtRange = {};
  const startedFrom = toDate(query.startedFrom);
  const startedTo = toEndOfDayDate(query.startedTo);
  if (startedFrom) startedAtRange[Op.gte] = startedFrom;
  if (startedTo) startedAtRange[Op.lte] = startedTo;
  if (Reflect.ownKeys(startedAtRange).length) where.startedAt = startedAtRange;

  if (String(query.warningsOnly || '').toLowerCase() === 'true') {
    where[Op.and] = [
      ...(where[Op.and] || []),
      sqlWhere(fn('JSON_LENGTH', col('warnings')), { [Op.gt]: 0 })
    ];
  }
  return where;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function serializeCleanupSampleRow(row) {
  const j = typeof row?.toJSON === 'function' ? row.toJSON() : row;
  return {
    id: j.id,
    operationType: j.operationType,
    semesterId: j.semesterId,
    status: j.status,
    startedAt: j.startedAt,
    requestId: j.requestId,
    archivedAt: j.archivedAt,
    cleanupRequestId: j.cleanupRequestId
  };
}

function buildCleanupWhere(criteria = {}, warnings = []) {
  const olderThan = toEndOfDayDate(criteria.olderThan);
  if (!olderThan) {
    const err = new Error('olderThan is required and must be a valid date');
    err.status = 400;
    throw err;
  }

  const ninetyDayCutoff = daysAgo(90);
  let effectiveOlderThan = olderThan;
  if (olderThan > ninetyDayCutoff) {
    effectiveOlderThan = ninetyDayCutoff;
    warnings.push('最近 90 天內資料不會被清理；olderThan 已依 90 天保護線調整。');
  }

  const where = {
    startedAt: { [Op.lt]: effectiveOlderThan },
    archivedAt: null
  };
  if (criteria.operationType) {
    const operationTypes = parseOperationTypes(criteria.operationType);
    if (operationTypes.length === 1) where.operationType = operationTypes[0];
    if (operationTypes.length > 1) where.operationType = { [Op.in]: operationTypes };
  }

  const includeNonSuccess = criteria.includeNonSuccess === true || String(criteria.includeNonSuccess || '').toLowerCase() === 'true';
  const requestedStatus = String(criteria.status || '').trim().toLowerCase();
  if (requestedStatus === STATUSES.RUNNING) {
    warnings.push('running operation 不會納入清理。');
    where.status = '__never_match_running_cleanup__';
  } else if (!includeNonSuccess) {
    if (requestedStatus && requestedStatus !== STATUSES.SUCCESS) {
      warnings.push('partial/failed 預設不納入；若要評估非 success，需 includeNonSuccess=true。');
      where.status = '__never_match_non_success_cleanup__';
    } else {
      where.status = STATUSES.SUCCESS;
      warnings.push('partial/failed 預設不納入。');
    }
  } else if (requestedStatus) {
    where.status = requestedStatus;
  } else {
    where.status = { [Op.ne]: STATUSES.RUNNING };
    warnings.push('running operation 不會納入清理。');
  }

  return { where, effectiveOlderThan, includeNonSuccess };
}

async function createRun(payload = {}) {
  const op = payload.user ? operatorFromUser(payload.user) : {
    executedByUserId: payload.executedByUserId == null ? null : String(payload.executedByUserId),
    executedByUsername: payload.executedByUsername || null
  };
  return LearningJourneyOperationRun.create({
    operationType: payload.operationType,
    semesterId: payload.semesterId || null,
    status: STATUSES.RUNNING,
    requestId: payload.requestId || null,
    ...op,
    startedAt: toDate(payload.startedAt) || new Date(),
    source: payload.source || 'api',
    dryRun: payload.dryRun === true,
    confirm: payload.confirm === true
  });
}

async function markSuccess(runOrId, payload = {}) {
  const row = typeof runOrId === 'object' ? runOrId : await LearningJourneyOperationRun.findByPk(runOrId);
  if (!row) return null;
  const finishedAt = toDate(payload.finishedAt) || new Date();
  const startedAt = toDate(row.startedAt) || finishedAt;
  await row.update({
    status: payload.status || STATUSES.SUCCESS,
    finishedAt,
    durationMs: Number(payload.durationMs ?? (finishedAt.getTime() - startedAt.getTime())),
    beforeSummary: payload.beforeSummary || null,
    afterSummary: payload.afterSummary || null,
    diffSummary: payload.diffSummary || null,
    resultSummary: payload.resultSummary || null,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    errorCode: null,
    errorMessage: null
  });
  return row;
}

async function markFailed(runOrId, payload = {}) {
  const row = typeof runOrId === 'object' ? runOrId : await LearningJourneyOperationRun.findByPk(runOrId);
  if (!row) return null;
  const finishedAt = toDate(payload.finishedAt) || new Date();
  const startedAt = toDate(row.startedAt) || finishedAt;
  await row.update({
    status: STATUSES.FAILED,
    finishedAt,
    durationMs: Number(payload.durationMs ?? (finishedAt.getTime() - startedAt.getTime())),
    beforeSummary: payload.beforeSummary || row.beforeSummary || null,
    afterSummary: payload.afterSummary || null,
    diffSummary: payload.diffSummary || null,
    resultSummary: payload.resultSummary || null,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    errorCode: payload.errorCode || null,
    errorMessage: sanitizeErrorMessage(payload.errorMessage)
  });
  return row;
}

async function findRunningByType(operationType) {
  if (!operationType) return null;
  return LearningJourneyOperationRun.findOne({
    where: {
      operationType: String(operationType).trim(),
      status: STATUSES.RUNNING,
      archivedAt: null,
    },
    order: [['startedAt', 'DESC']],
  });
}

async function updateProgress(runOrId, payload = {}) {
  const row = typeof runOrId === 'object' ? runOrId : await LearningJourneyOperationRun.findByPk(runOrId);
  if (!row) return null;
  const updates = {};
  if (payload.resultSummary != null) updates.resultSummary = payload.resultSummary;
  if (payload.warnings != null) updates.warnings = payload.warnings;
  if (Reflect.ownKeys(updates).length) {
    await row.update(updates);
  }
  return row;
}

async function listRuns(query = {}) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 5, 1), 100);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  const where = buildRunsWhere(query);
  const total = typeof LearningJourneyOperationRun.count === 'function'
    ? await LearningJourneyOperationRun.count({ where })
    : null;
  const rows = await LearningJourneyOperationRun.findAll({
    where,
    order: [['startedAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset
  });
  return {
    items: rows.map(serializeListRow),
    pagination: {
      limit,
      offset,
      returned: rows.length,
      ...(total == null ? {} : { total })
    }
  };
}

async function exportRuns(query = {}) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 5000, 1), 5000);
  const where = buildRunsWhere(query);
  const total = typeof LearningJourneyOperationRun.count === 'function'
    ? await LearningJourneyOperationRun.count({ where })
    : null;
  const rows = await LearningJourneyOperationRun.findAll({
    where,
    order: [['startedAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset: 0
  });
  return {
    items: rows.map(serializeListRow),
    limit,
    total,
    truncated: total == null ? false : total > rows.length
  };
}

async function cleanupDryRun(criteria = {}) {
  const warnings = [
    '此 API 只做 dry-run，不會刪除資料。',
    '清理前必須先 export 或備份。'
  ];
  const { where, effectiveOlderThan, includeNonSuccess } = buildCleanupWhere(criteria, warnings);
  const matchedCount = typeof LearningJourneyOperationRun.count === 'function'
    ? await LearningJourneyOperationRun.count({ where })
    : null;
  const rows = await LearningJourneyOperationRun.findAll({
    where,
    order: [['startedAt', 'ASC'], ['id', 'ASC']],
    limit: 5000,
    offset: 0
  });
  const items = rows.map(serializeCleanupSampleRow);
  const byStatus = {};
  const byOperationType = {};
  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    byOperationType[item.operationType] = (byOperationType[item.operationType] || 0) + 1;
  }
  if (matchedCount != null && matchedCount > items.length) {
    warnings.push('dry-run summary 超過 5000 筆時，byStatus/byOperationType 只依前 5000 筆估算。');
  }

  const sortedTimes = items
    .map((item) => item.startedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return {
    dryRun: true,
    criteria: {
      olderThan: criteria.olderThan || null,
      effectiveOlderThan,
      operationType: criteria.operationType || null,
      status: criteria.status || null,
      includeNonSuccess
    },
    summary: {
      matchedCount: matchedCount == null ? items.length : matchedCount,
      byStatus,
      byOperationType,
      oldestStartedAt: sortedTimes[0] || null,
      newestStartedAt: sortedTimes[sortedTimes.length - 1] || null,
      summaryLimitedTo: items.length
    },
    warnings,
    sampleItems: items.slice(0, 20)
  };
}

function operatorFromArchiveUser(user) {
  if (!user) return { archivedByUserId: null, archivedByUsername: null };
  return {
    archivedByUserId: user.id == null ? null : String(user.id),
    archivedByUsername: user.user || user.username || user.name || null
  };
}

async function archiveRuns(criteria = {}) {
  if (criteria.confirm !== true) {
    const err = new Error('confirm=true is required');
    err.status = 400;
    throw err;
  }
  if (criteria.backupConfirmed !== true) {
    const err = new Error('backupConfirmed=true is required');
    err.status = 400;
    throw err;
  }
  const reason = String(criteria.reason || '').trim();
  if (!reason) {
    const err = new Error('archive reason is required');
    err.status = 400;
    throw err;
  }

  const dryRun = await cleanupDryRun(criteria);
  const matchedCount = Number(dryRun.summary?.matchedCount || 0);
  if (matchedCount <= 0) {
    return {
      archived: true,
      criteria: dryRun.criteria,
      archivedCount: 0,
      cleanupRequestId: criteria.requestId || null,
      warnings: dryRun.warnings || [],
      sampleItems: []
    };
  }

  const cleanupRequestId = criteria.requestId || `cleanup:${Date.now()}`;
  const archivedAt = new Date();
  const op = operatorFromArchiveUser(criteria.user);
  const patch = {
    archivedAt,
    ...op,
    archiveReason: reason.slice(0, 2000),
    cleanupRequestId
  };

  const { where } = buildCleanupWhere(criteria, []);
  const runUpdate = async (transaction) => LearningJourneyOperationRun.update(patch, { where, transaction });
  let updateResult;
  if (sequelize && typeof sequelize.transaction === 'function') {
    updateResult = await sequelize.transaction(async (transaction) => runUpdate(transaction));
  } else {
    updateResult = await runUpdate(undefined);
  }
  const archivedCount = Array.isArray(updateResult) ? Number(updateResult[0] || 0) : Number(updateResult || 0);
  return {
    archived: true,
    criteria: dryRun.criteria,
    archivedCount,
    cleanupRequestId,
    warnings: dryRun.warnings || [],
    sampleItems: dryRun.sampleItems || []
  };
}

async function getRunDetail(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  const row = await LearningJourneyOperationRun.findByPk(n);
  return serializeDetail(row);
}

module.exports = {
  OPERATION_TYPES,
  STATUSES,
  createRun,
  markSuccess,
  markFailed,
  findRunningByType,
  updateProgress,
  listRuns,
  exportRuns,
  cleanupDryRun,
  archiveRuns,
  getRunDetail,
  serializeListRow,
  serializeDetail
};
