'use strict';

const { Op } = require('sequelize');
const {
  LearningJourneyImportHistory,
  LearningJourneyOperationRun,
  JobRun,
  AuditLog,
} = require('../models');
const { resolveDeletable } = require('./importRunDeleteService');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** 匯入紀錄中心不應顯示的稽核動作（刪除／回滾等維運紀錄，非匯入本身） */
const IMPORT_RUN_EXCLUDED_AUDIT_ACTIONS = new Set([
  'delete_import_run',
  'rollback_import_history',
]);

function isExcludedImportRunAudit(row) {
  const action = String(row?.action || '').trim().toLowerCase();
  return IMPORT_RUN_EXCLUDED_AUDIT_ACTIONS.has(action);
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function inferLJImportType(row) {
  const type = String(row?.importType || '').toLowerCase();
  if (type === 'enrollment') return 'lj_enrollment_import';
  if (type === 'external_exam') return 'lj_exam_import';
  return 'lj_import';
}

function inferJobImportType(jobName) {
  const name = String(jobName || '').toLowerCase();
  if (name.includes('sync')) return 'job_sync';
  if (name.includes('reconcile')) return 'job_reconcile';
  if (name.includes('governance')) return 'job_governance';
  return 'job_sync';
}

/** @param {{ action?: string, targetSummary?: string, module?: string, entityType?: string }} row */
function auditImportSemanticsHaystack(row) {
  return [
    row?.action,
    row?.targetSummary,
    row?.module,
    row?.entityType,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * P13-4a：稽核列是否具匯入／上傳語意（後端二次過濾，避免 SQL 誤撈）。
 * @param {{ action?: string, targetSummary?: string, module?: string, entityType?: string }} row
 */
function auditRowHasImportSemantics(row) {
  if (isExcludedImportRunAudit(row)) return false;
  const hay = auditImportSemanticsHaystack(row);
  if (!hay) return false;
  const tokens = [
    'import',
    'upload',
    'roster',
    'card_excel',
    'card excel',
    '匯入',
    '上傳',
    '刷卡',
  ];
  return tokens.some((t) => hay.includes(t));
}

/**
 * P13-4a：audit_logs 查詢條件（僅 action／targetSummary 具匯入語意，不以 module 單獨納入）。
 */
function buildAuditLogImportWhere(dateFrom, dateTo) {
  const semanticOr = [
    { action: { [Op.like]: '%import%' } },
    { action: { [Op.like]: '%upload%' } },
    { action: { [Op.like]: '%card_excel%' } },
    { action: { [Op.like]: '%roster%' } },
    { targetSummary: { [Op.like]: '%import%' } },
    { targetSummary: { [Op.like]: '%upload%' } },
    { targetSummary: { [Op.like]: '%card_excel%' } },
    { targetSummary: { [Op.like]: '%roster%' } },
    { targetSummary: { [Op.like]: '%匯入%' } },
    { targetSummary: { [Op.like]: '%上傳%' } },
    { targetSummary: { [Op.like]: '%刷卡%' } },
    { action: { [Op.like]: '%匯入%' } },
    { action: { [Op.like]: '%上傳%' } },
    { action: { [Op.like]: '%刷卡%' } },
  ];
  const where = {
    [Op.and]: [
      { [Op.or]: semanticOr },
      { action: { [Op.notIn]: Array.from(IMPORT_RUN_EXCLUDED_AUDIT_ACTIONS) } },
    ],
  };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = dateFrom;
    if (dateTo) where.createdAt[Op.lte] = dateTo;
  }
  return where;
}

/**
 * P13-4a：集中 audit importType 映射。
 * @param {{ action?: string, targetSummary?: string, module?: string, entityType?: string }} row
 */
function normalizeAuditImportType(row) {
  const hay = auditImportSemanticsHaystack(row);
  const action = String(row?.action || '').toLowerCase();

  if (hay.includes('class') && hay.includes('roster')) return 'class_roster_import';
  if (hay.includes('bestep') && hay.includes('attendance')) return 'bestep_attendance_import';
  if (hay.includes('bestep') && (hay.includes('score') || hay.includes('scores'))) {
    return 'bestep_score_import';
  }
  const mod = String(row?.module || '').toLowerCase();
  if (mod === 'bestep' && action.includes('attendance')) return 'bestep_attendance_import';
  if (mod === 'bestep' && action.includes('score')) return 'bestep_score_import';
  if (
    hay.includes('card') &&
    (hay.includes('excel') || hay.includes('card_excel') || action.includes('card_excel'))
  ) {
    return 'event_card_excel_import';
  }
  if (
    action.includes('import_enrollment') ||
    (hay.includes('enrollment') && hay.includes('import')) ||
    (hay.includes('learning_journey') && hay.includes('enrollment'))
  ) {
    return 'lj_enrollment_import';
  }
  if (
    action.includes('import_exam') ||
    (hay.includes('external_exam') && hay.includes('import')) ||
    (hay.includes('learning_journey') && hay.includes('exam') && hay.includes('import'))
  ) {
    return 'lj_exam_import';
  }
  if (hay.includes('import') || hay.includes('upload') || hay.includes('匯入') || hay.includes('上傳')) {
    return 'unknown_import';
  }
  return 'unknown_import';
}

/**
 * P13-4a：穩定 status 輸出。
 * @param {string|null|undefined} status
 */
function normalizeStatus(status) {
  const s = String(status == null ? '' : status).trim().toLowerCase();
  if (!s) return 'unknown';
  if (s === 'success' || s === 'ok' || s === 'completed' || s === 'done') return 'success';
  if (s === 'partial' || s === 'partial_success' || s === 'warning' || s === 'warn') {
    return 'partial_success';
  }
  if (s === 'failed' || s === 'failure' || s === 'error' || s === 'fail') return 'failed';
  if (s === 'running' || s === 'in_progress' || s === 'processing' || s === 'pending') {
    return 'running';
  }
  if (s === 'skipped' || s === 'skip') return 'skipped';
  return 'unknown';
}

/**
 * P13-4a：穩定 module 輸出。
 * @param {string} source
 * @param {object} row
 * @param {string|null} importType
 */
function normalizeModule(source, row, importType) {
  const type = String(importType || '').toLowerCase();
  if (source === 'lj_import_history') return 'learning_journey';
  if (source === 'lj_operation_run') return 'operations';
  if (source === 'job_run') {
    const jobName = String(row?.jobName || '').toLowerCase();
    if (jobName.includes('learning_journey')) return 'learning_journey';
    return 'jobs';
  }
  if (source === 'audit_log') {
    if (type.startsWith('lj_')) return 'learning_journey';
    if (type === 'class_roster_import') return 'classes';
    if (type.startsWith('bestep_')) return 'bestep';
    if (type === 'event_card_excel_import') return 'operations';
    const mod = String(row?.module || '').toLowerCase();
    if (mod.includes('learning_journey')) return 'learning_journey';
    if (mod.includes('bestep')) return 'bestep';
    if (mod.includes('class')) return 'classes';
    if (mod.includes('reservation') || mod.includes('event')) return 'operations';
    return 'unknown';
  }
  return 'unknown';
}

function buildDto(source, data) {
  const importType = data.importType || null;
  const module = data.module != null ? data.module : normalizeModule(source, data.rawSourceRow || {}, importType);
  const status = normalizeStatus(data.status);
  const createdAt = data.createdAt || null;
  const startedAt = data.startedAt || null;
  const finishedAt = data.finishedAt || null;
  const sourceId = data.sourceId == null ? null : String(data.sourceId);
  const id = sourceId ? `${source}:${sourceId}` : `${source}:${Date.now()}:${Math.random()}`;
  const rawSource = {
    ...(data.rawSource || {}),
    statusRaw: data.status == null ? null : String(data.status),
  };
  return {
    id,
    source,
    sourceId,
    importType,
    module,
    status,
    title: data.title || null,
    fileName: data.fileName || null,
    totalCount: toNumberOrNull(data.totalCount),
    successCount: toNumberOrNull(data.successCount),
    failedCount: toNumberOrNull(data.failedCount),
    skippedCount: toNumberOrNull(data.skippedCount),
    warningCount: toNumberOrNull(data.warningCount),
    executedByUserId: data.executedByUserId == null ? null : String(data.executedByUserId),
    executedByUsername: data.executedByUsername || null,
    startedAt,
    finishedAt,
    createdAt,
    detailAvailable: data.detailAvailable === true,
    deletable: data.deletable === true,
    deleteDisabledReason: data.deleteDisabledReason || null,
    rawSource,
  };
}

function attachDeletable(source, data) {
  const row = data.rawSourceRow || data;
  const meta = resolveDeletable(source, row);
  return {
    ...data,
    deletable: meta.deletable === true,
    deleteDisabledReason: meta.deleteDisabledReason || null,
  };
}

function inDateRange(item, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const timeRaw = item.startedAt || item.createdAt || item.finishedAt;
  if (!timeRaw) return false;
  const time = new Date(timeRaw).getTime();
  if (!Number.isFinite(time)) return false;
  if (dateFrom && time < dateFrom.getTime()) return false;
  if (dateTo && time > dateTo.getTime()) return false;
  return true;
}

function matchesKeyword(item, keyword) {
  if (!keyword) return true;
  const q = keyword.toLowerCase();
  const bag = [
    item.title,
    item.fileName,
    item.importType,
    item.module,
    item.status,
    item.executedByUsername,
    item.executedByUserId,
    item.sourceId,
    item.rawSource && item.rawSource.requestId,
    item.rawSource && item.rawSource.action,
    item.rawSource && item.rawSource.module,
    item.rawSource && item.rawSource.statusRaw,
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase())
    .join(' ');
  return bag.includes(q);
}

function matchesStatusFilter(item, statusFilter) {
  const normalizedFilter = normalizeStatus(statusFilter);
  if (String(item.status || '') === normalizedFilter) return true;
  if (normalizedFilter === 'partial_success' && String(item.rawSource?.statusRaw || '').toLowerCase() === 'partial') {
    return true;
  }
  return false;
}

function parseSourceFilter(source) {
  if (!source) return null;
  const list = String(source)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return new Set(list);
}

async function fetchLJImportHistories({ dateFrom, dateTo, limit }, warnings) {
  try {
    const where = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = dateFrom;
      if (dateTo) where.createdAt[Op.lte] = dateTo;
    }
    const rows = await LearningJourneyImportHistory.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limit * 4,
    });
    return rows.map((row) => {
      const summary = row.summaryJson || {};
      const importedCount = Number(row.importedCount || 0);
      const updatedCount = Number(row.updatedCount || 0);
      const skippedCount = Number(row.skippedCount || 0);
      const conflictedCount = Number(row.conflictedCount || 0);
      const totalCount = toNumberOrNull(summary.totalRows) ?? (importedCount + updatedCount + skippedCount + conflictedCount);
      const importType = inferLJImportType(row);
      return buildDto(
        'lj_import_history',
        attachDeletable('lj_import_history', {
          sourceId: row.id,
          importType,
          module: normalizeModule('lj_import_history', row, importType),
          status: row.status || null,
          title: row.importType === 'enrollment' ? 'Learning Journey 名冊匯入' : 'Learning Journey 英檢匯入',
          fileName: row.sourceFile || null,
          totalCount,
          successCount: importedCount + updatedCount,
          failedCount: toNumberOrNull(summary.failedRows) ?? conflictedCount,
          skippedCount,
          warningCount: Number(row.warningCount || 0),
          executedByUserId: null,
          executedByUsername: summary.importedBy || null,
          startedAt: null,
          finishedAt: null,
          createdAt: row.createdAt || null,
          detailAvailable: true,
          rawSourceRow: row,
          rawSource: {
            requestId: summary.requestId || null,
            sourceBatchId: summary.sourceBatchId || summary.batchId || null,
          },
        }),
      );
    });
  } catch (error) {
    warnings.push({
      source: 'lj_import_history',
      message: `讀取 learning_journey_import_histories 失敗：${error.message || String(error)}`,
    });
    return [];
  }
}

async function fetchLJOperationRuns({ dateFrom, dateTo, limit }, warnings) {
  try {
    const where = {};
    if (dateFrom || dateTo) {
      where.startedAt = {};
      if (dateFrom) where.startedAt[Op.gte] = dateFrom;
      if (dateTo) where.startedAt[Op.lte] = dateTo;
    }
    const rows = await LearningJourneyOperationRun.findAll({
      where,
      order: [['startedAt', 'DESC'], ['id', 'DESC']],
      limit: limit * 4,
    });
    return rows.map((row) => {
      const resultSummary = row.resultSummary || {};
      const successCount = toNumberOrNull(resultSummary.imported) ?? toNumberOrNull(resultSummary.inserted);
      const skippedCount = toNumberOrNull(resultSummary.skipped);
      const warningCount = Array.isArray(row.warnings) ? row.warnings.length : toNumberOrNull(resultSummary.warningCount);
      const importType = 'lj_operation';
      return buildDto('lj_operation_run', attachDeletable('lj_operation_run', {
        sourceId: row.id,
        importType,
        module: normalizeModule('lj_operation_run', row, importType),
        status: row.status || null,
        title: `Learning Journey 操作：${row.operationType || 'UNKNOWN'}`,
        fileName: null,
        totalCount: toNumberOrNull(resultSummary.totalRows) ?? null,
        successCount,
        failedCount: toNumberOrNull(resultSummary.failedCount),
        skippedCount,
        warningCount,
        executedByUserId: row.executedByUserId,
        executedByUsername: row.executedByUsername || null,
        startedAt: row.startedAt || null,
        finishedAt: row.finishedAt || null,
        createdAt: row.createdAt || row.startedAt || null,
        detailAvailable: true,
        rawSourceRow: row,
        rawSource: {
          requestId: row.requestId || null,
          operationType: row.operationType || null,
          errorCode: row.errorCode || null,
          batchId: resultSummary.batchId || null,
        },
      }));
    });
  } catch (error) {
    warnings.push({
      source: 'lj_operation_run',
      message: `讀取 learning_journey_operation_runs 失敗：${error.message || String(error)}`,
    });
    return [];
  }
}

async function fetchJobRuns({ dateFrom, dateTo, limit }, warnings) {
  try {
    const where = {};
    if (dateFrom || dateTo) {
      where.startedAt = {};
      if (dateFrom) where.startedAt[Op.gte] = dateFrom;
      if (dateTo) where.startedAt[Op.lte] = dateTo;
    }
    const rows = await JobRun.findAll({
      where,
      order: [['startedAt', 'DESC'], ['id', 'DESC']],
      limit: limit * 3,
    });
    return rows.map((row) => {
      const summary = row.summaryJson || {};
      const importType = inferJobImportType(row.jobName);
      return buildDto('job_run', attachDeletable('job_run', {
        sourceId: row.id,
        importType,
        module: normalizeModule('job_run', row, importType),
        status: row.status || null,
        title: `Job：${row.jobName || 'unknown'}`,
        fileName: null,
        totalCount: toNumberOrNull(summary.totalRows),
        successCount: toNumberOrNull(summary.importedRows),
        failedCount: toNumberOrNull(summary.failedRows),
        skippedCount: toNumberOrNull(summary.skippedRows),
        warningCount: null,
        executedByUserId: null,
        executedByUsername: row.triggeredBy || null,
        startedAt: row.startedAt || null,
        finishedAt: row.finishedAt || null,
        createdAt: row.createdAt || row.startedAt || null,
        detailAvailable: true,
        rawSourceRow: row,
        rawSource: {
          requestId: row.requestId || null,
          jobName: row.jobName || null,
          triggeredBy: row.triggeredBy || null,
        },
      }));
    });
  } catch (error) {
    warnings.push({
      source: 'job_run',
      message: `讀取 job_runs 失敗：${error.message || String(error)}`,
    });
    return [];
  }
}

async function fetchAuditLogs({ dateFrom, dateTo, limit }, warnings) {
  try {
    const where = buildAuditLogImportWhere(dateFrom, dateTo);
    const rows = await AuditLog.findAll({
      where,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: limit * 6,
      attributes: [
        'id',
        'module',
        'action',
        'entityType',
        'entityId',
        'operatorId',
        'operatorName',
        'status',
        'requestId',
        'targetSummary',
        'afterData',
        'entityId',
        'createdAt',
      ],
    });
    return rows
      .filter(auditRowHasImportSemantics)
      .map((row) => {
        const afterData = row.afterData || {};
        const importType = normalizeAuditImportType(row);
        return buildDto(
          'audit_log',
          attachDeletable('audit_log', {
            sourceId: row.id,
            importType,
            module: normalizeModule('audit_log', row, importType),
            status: row.status || null,
            title: row.targetSummary || `${row.module || 'audit'}:${row.action || 'import'}`,
            fileName: afterData.sourceFile || null,
            totalCount: null,
            successCount: toNumberOrNull(afterData.imported) ?? toNumberOrNull(afterData.successCount) ?? null,
            failedCount: toNumberOrNull(afterData.errorCount) ?? null,
            skippedCount: toNumberOrNull(afterData.skipped) ?? null,
            warningCount: toNumberOrNull(afterData.warningsCount) ?? null,
            executedByUserId: row.operatorId,
            executedByUsername: row.operatorName || null,
            startedAt: null,
            finishedAt: null,
            createdAt: row.createdAt || null,
            detailAvailable: false,
            rawSourceRow: row,
            rawSource: {
              requestId: row.requestId || null,
              action: row.action || null,
              module: row.module || null,
              entityType: row.entityType || null,
              entityId: row.entityId || null,
              importBatchId: afterData.importBatchId || null,
            },
          }),
        );
      });
  } catch (error) {
    warnings.push({
      source: 'audit_log',
      message: `讀取 audit_logs 失敗：${error.message || String(error)}`,
    });
    return [];
  }
}

function sortByTimeDesc(items) {
  return items.sort((a, b) => {
    const ta = new Date(a.startedAt || a.createdAt || a.finishedAt || 0).getTime();
    const tb = new Date(b.startedAt || b.createdAt || b.finishedAt || 0).getTime();
    return tb - ta;
  });
}

async function listImportRuns(params = {}) {
  const limit = clamp(toInt(params.limit, DEFAULT_LIMIT), 1, MAX_LIMIT);
  const offset = Math.max(toInt(params.offset, 0), 0);
  const sourceFilter = parseSourceFilter(params.source);
  const moduleFilter = normalizeText(params.module);
  const importTypeFilter = normalizeText(params.importType);
  const statusFilter = normalizeText(params.status);
  const keyword = normalizeText(params.keyword);
  const dateFrom = parseDate(params.dateFrom, false);
  const dateTo = parseDate(params.dateTo, true);
  const warnings = [];

  const sourceQuery = { dateFrom, dateTo, limit: Math.min(limit + offset, MAX_LIMIT) };
  const groups = await Promise.all([
    fetchLJImportHistories(sourceQuery, warnings),
    fetchLJOperationRuns(sourceQuery, warnings),
    fetchJobRuns(sourceQuery, warnings),
    fetchAuditLogs(sourceQuery, warnings),
  ]);

  let items = groups.flat();
  if (sourceFilter) items = items.filter((x) => sourceFilter.has(x.source));
  if (moduleFilter) items = items.filter((x) => String(x.module || '') === moduleFilter);
  if (importTypeFilter) items = items.filter((x) => String(x.importType || '') === importTypeFilter);
  if (statusFilter) items = items.filter((x) => matchesStatusFilter(x, statusFilter));
  items = items.filter((x) => inDateRange(x, dateFrom, dateTo));
  items = items.filter((x) => matchesKeyword(x, keyword));

  sortByTimeDesc(items);
  const sliced = items.slice(offset, offset + limit);

  return {
    items: sliced,
    pagination: {
      limit,
      offset,
      returned: sliced.length,
      totalApprox: items.length,
    },
    warnings,
  };
}

module.exports = {
  listImportRuns,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  normalizeStatus,
  normalizeAuditImportType,
  normalizeModule,
  auditRowHasImportSemantics,
  isExcludedImportRunAudit,
  buildAuditLogImportWhere,
  getImportRunDetail,
};

function normalizeDetailArray(value, max = 200) {
  if (!value) return [];
  if (Array.isArray(value)) return value.slice(0, max);
  return [value].slice(0, max);
}

function ensurePlain(row) {
  if (!row) return null;
  if (typeof row.get === 'function') return row.get({ plain: true });
  return row;
}

function buildDetailDto(base, extra) {
  return {
    id: base.id,
    source: base.source,
    sourceId: base.sourceId,
    importType: base.importType,
    module: base.module,
    status: base.status,
    title: base.title,
    fileName: base.fileName,
    totalCount: base.totalCount,
    successCount: base.successCount,
    failedCount: base.failedCount,
    skippedCount: base.skippedCount,
    warningCount: base.warningCount,
    executedByUserId: base.executedByUserId,
    executedByUsername: base.executedByUsername,
    startedAt: base.startedAt,
    finishedAt: base.finishedAt,
    createdAt: base.createdAt,
    summary: extra.summary || null,
    warnings: normalizeDetailArray(extra.warnings),
    errors: normalizeDetailArray(extra.errors),
    skippedDetails: normalizeDetailArray(extra.skippedDetails),
    conflicts: normalizeDetailArray(extra.conflicts),
    detailAvailable: base.detailAvailable === true,
    deletable: base.deletable === true,
    deleteDisabledReason: base.deleteDisabledReason || null,
    rawSource: extra.rawSource || base.rawSource || {},
  };
}

async function getImportRunDetail(source, sourceId) {
  const src = String(source || '').trim();
  const sid = String(sourceId || '').trim();
  if (!src || !sid) {
    return { ok: false, status: 400, error: 'source 或 sourceId 不可為空' };
  }

  if (src === 'audit_log') {
    const base = buildDto('audit_log', {
      sourceId: sid,
      importType: 'unknown_import',
      module: 'unknown',
      status: 'unknown',
      title: '稽核摘要（無完整明細）',
      fileName: null,
      totalCount: null,
      successCount: null,
      failedCount: null,
      skippedCount: null,
      warningCount: null,
      executedByUserId: null,
      executedByUsername: null,
      startedAt: null,
      finishedAt: null,
      createdAt: null,
      detailAvailable: false,
      rawSource: { sourceId: sid },
    });
    return {
      ok: true,
      detail: buildDetailDto(base, {
        summary: '此紀錄來自 audit log 摘要，第一版不提供完整匯入明細。',
        rawSource: { ...base.rawSource, sourceId: sid },
      }),
    };
  }

  if (src !== 'lj_import_history' && src !== 'lj_operation_run' && src !== 'job_run') {
    return { ok: false, status: 400, error: `不支援的 source：${src}` };
  }

  if (src === 'lj_import_history') {
    const id = Number(sid);
    if (!Number.isFinite(id)) return { ok: false, status: 400, error: 'lj_import_history sourceId 必須為數字' };
    const row = await LearningJourneyImportHistory.findByPk(id).catch(() => null);
    if (!row) return { ok: false, status: 404, error: '找不到該筆 learning_journey_import_histories' };
    const r = ensurePlain(row);
    const summary = r.summaryJson || {};
    const importedCount = Number(r.importedCount || 0);
    const updatedCount = Number(r.updatedCount || 0);
    const skippedCount = Number(r.skippedCount || 0);
    const conflictedCount = Number(r.conflictedCount || 0);
    const totalCount =
      toNumberOrNull(summary.totalRows) ??
      (importedCount + updatedCount + skippedCount + conflictedCount);
    const importType = inferLJImportType(r);
    const base = buildDto(
      'lj_import_history',
      attachDeletable('lj_import_history', {
        sourceId: r.id,
        importType,
        module: normalizeModule('lj_import_history', r, importType),
        status: r.status || null,
        title: r.importType === 'enrollment' ? 'Learning Journey 名冊匯入' : 'Learning Journey 英檢匯入',
        fileName: r.sourceFile || null,
        totalCount,
        successCount: importedCount + updatedCount,
        failedCount: toNumberOrNull(summary.failedRows) ?? conflictedCount,
        skippedCount,
        warningCount: Number(r.warningCount || 0),
        executedByUserId: null,
        executedByUsername: summary.importedBy || null,
        startedAt: null,
        finishedAt: null,
        createdAt: r.createdAt || null,
        detailAvailable: true,
        rawSourceRow: r,
        rawSource: {
          requestId: summary.requestId || null,
          sourceBatchId: summary.sourceBatchId || summary.batchId || null,
        },
      }),
    );
    return {
      ok: true,
      detail: buildDetailDto(base, {
        summary: summary.summary || summary.message || null,
        warnings: summary.warnings || [],
        errors: summary.errors || [],
        skippedDetails: summary.skipped || summary.skippedDetails || [],
        conflicts: summary.conflicts || summary.conflicted || [],
        rawSource: { ...base.rawSource, summaryJson: summary },
      }),
    };
  }

  if (src === 'lj_operation_run') {
    const id = Number(sid);
    if (!Number.isFinite(id)) return { ok: false, status: 400, error: 'lj_operation_run sourceId 必須為數字' };
    const row = await LearningJourneyOperationRun.findByPk(id).catch(() => null);
    if (!row) return { ok: false, status: 404, error: '找不到該筆 learning_journey_operation_runs' };
    const r = ensurePlain(row);
    const resultSummary = r.resultSummary || {};
    const importType = 'lj_operation';
    const base = buildDto('lj_operation_run', {
      sourceId: r.id,
      importType,
      module: normalizeModule('lj_operation_run', r, importType),
      status: r.status || null,
      title: `Learning Journey 操作：${r.operationType || 'UNKNOWN'}`,
      fileName: null,
      totalCount: toNumberOrNull(resultSummary.totalRows) ?? null,
      successCount: toNumberOrNull(resultSummary.imported) ?? toNumberOrNull(resultSummary.inserted),
      failedCount: toNumberOrNull(resultSummary.failedCount),
      skippedCount: toNumberOrNull(resultSummary.skipped),
      warningCount: Array.isArray(r.warnings) ? r.warnings.length : toNumberOrNull(resultSummary.warningCount),
      executedByUserId: r.executedByUserId,
      executedByUsername: r.executedByUsername || null,
      startedAt: r.startedAt || null,
      finishedAt: r.finishedAt || null,
      createdAt: r.createdAt || r.startedAt || null,
      detailAvailable: true,
      rawSourceRow: r,
      rawSource: {
        requestId: r.requestId || null,
        operationType: r.operationType || null,
        errorCode: r.errorCode || null,
      },
    });
    return {
      ok: true,
      detail: buildDetailDto(base, {
        summary: r.errorMessage ? `error: ${r.errorMessage}` : null,
        warnings: r.warnings || [],
        errors: r.errorMessage ? [{ code: r.errorCode || 'ERROR', message: r.errorMessage }] : [],
        rawSource: {
          ...base.rawSource,
          beforeSummary: r.beforeSummary || null,
          afterSummary: r.afterSummary || null,
          diffSummary: r.diffSummary || null,
          resultSummary: r.resultSummary || null,
          durationMs: r.durationMs || null,
          dryRun: r.dryRun || false,
          confirm: r.confirm || false,
        },
      }),
    };
  }

  // job_run
  const id = Number(sid);
  if (!Number.isFinite(id)) return { ok: false, status: 400, error: 'job_run sourceId 必須為數字' };
  const row = await JobRun.findByPk(id).catch(() => null);
  if (!row) return { ok: false, status: 404, error: '找不到該筆 job_runs' };
  const r = ensurePlain(row);
  const summary = r.summaryJson || {};
  const importType = inferJobImportType(r.jobName);
  const base = buildDto('job_run', {
    sourceId: r.id,
    importType,
    module: normalizeModule('job_run', r, importType),
    status: r.status || null,
    title: `Job：${r.jobName || 'unknown'}`,
    fileName: null,
    totalCount: toNumberOrNull(summary.totalRows),
    successCount: toNumberOrNull(summary.importedRows),
    failedCount: toNumberOrNull(summary.failedRows),
    skippedCount: toNumberOrNull(summary.skippedRows),
    warningCount: null,
    executedByUserId: null,
    executedByUsername: r.triggeredBy || null,
    startedAt: r.startedAt || null,
    finishedAt: r.finishedAt || null,
    createdAt: r.createdAt || r.startedAt || null,
    detailAvailable: true,
    rawSourceRow: r,
    rawSource: {
      requestId: r.requestId || null,
      jobName: r.jobName || null,
      triggeredBy: r.triggeredBy || null,
    },
  });
  return {
    ok: true,
    detail: buildDetailDto(base, {
      summary: r.errorMessage ? `error: ${r.errorMessage}` : null,
      errors: r.errorMessage ? [{ message: r.errorMessage }] : [],
      rawSource: { ...base.rawSource, summaryJson: summary, durationMs: r.durationMs || null },
    }),
  };
}
