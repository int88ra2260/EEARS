'use strict';

const { getSemesterB2Report, getSemesterBreakdownReport } = require('../services/learningJourney/b2ReportService');
const {
  getSemesterStudents,
  getStudentProfile,
  getStudentTrends
} = require('../services/learningJourney/learningJourneyV3ReadService');
const { getLearningJourneyV3SemesterHealth } = require('../services/learningJourney/learningJourneyV3HealthService');
const { rebuildLearningJourneyV3Semester } = require('../services/learningJourney/learningJourneyV3RebuildWorkflowService');
const {
  OPERATION_TYPES,
  STATUSES,
  createRun: createLearningJourneyOperationRun,
  markSuccess: markLearningJourneyOperationRunSuccess,
  markFailed: markLearningJourneyOperationRunFailed,
  listRuns: listLearningJourneyOperationRuns,
  exportRuns: exportLearningJourneyOperationRuns,
  cleanupDryRun: cleanupLearningJourneyOperationRunsDryRun,
  archiveRuns: archiveLearningJourneyOperationRuns,
  getRunDetail: getLearningJourneyOperationRunDetail
} = require('../services/learningJourney/learningJourneyOperationRunService');
const { importEnrollment } = require('../services/learningJourney/importEnrollmentService');
const { importExam } = require('../services/learningJourney/importExamService');
const { importBaseline } = require('../services/learningJourney/importBaselineService');
const { syncEwlReservations } = require('../services/learningJourney/ewlSyncService');
const { rollbackImportHistoryRow } = require('../services/learningJourney/importRollbackService');
const { rebuildSemesterBestSkills } = require('../services/englishTestTracking/semesterBestSkillService');
const auditLogService = require('../services/auditLogService');
const { safeNormalizeFilename } = require('../services/learningJourney/utils/safeNormalizeFilename');
const { Op } = require('sequelize');
const { LearningJourneyImportHistory } = require('../models');
const {
  getUserLearningJourneyScope,
  isTeacher
} = require('../services/learningJourney/learningJourneyAccessService');
const { hasPermission } = require('../auth/accessProfile');
const { P } = require('../auth/permissions');

function denyLearningJourneyScope(res, req) {
  return res.status(403).json({
    success: false,
    errorCode: 'STUDENT_SCOPE_DENIED',
    error: '您沒有存取此學生資料的權限。',
    requestId: req.requestId,
  });
}

function canReadLearningJourneyScope(scope) {
  return scope && (scope.scope === 'all' || scope.scope === 'teacher');
}

function computeImportStatus(result) {
  const warningCount = Array.isArray(result?.warnings) ? result.warnings.length : 0;
  const conflictCount = Array.isArray(result?.conflicts) ? result.conflicts.length : 0;
  const quarantineCount = Array.isArray(result?.quarantine) ? result.quarantine.length : 0;
  if (warningCount > 0 || conflictCount > 0 || quarantineCount > 0) return 'partial';
  return 'success';
}

function importTypeLabel(importType) {
  if (importType === 'enrollment') return '名冊匯入';
  if (importType === 'external_exam') return '考試匯入';
  if (importType === 'baseline_gsat') return '學測 baseline 匯入';
  return importType || '匯入';
}

function normalizeImportType(importType) {
  if (importType === 'enrollment') return 'roster';
  if (importType === 'external_exam') return 'exam';
  if (importType === 'baseline_gsat') return 'baseline';
  return importType || 'unknown';
}

function getImportedBy(req) {
  return req.user?.name || req.user?.user || req.user?.username || null;
}

function newImportBatchId(type) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `ljv3:${type}:${ts}:${rand}`;
}

function buildEnrollmentImportResultSummary(result = {}) {
  return {
    semesterId: result.semesterId || null,
    batchId: result.batchId || null,
    imported: Number(result.imported || 0),
    skipped: Number(result.skipped || 0),
    warningsCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
    errorsCount: Array.isArray(result.quarantine) ? result.quarantine.length : 0
  };
}

function buildExamImportResultSummary(result = {}, rebuildResult = null) {
  return {
    batchId: result.batchId || result.sourceBatchId || null,
    totalRows: Number(result.totalRows || result.inserted || 0),
    inserted: Number(result.inserted || 0),
    replaced: Number(result.replaced || 0),
    skipped: Number(result.skipped || 0),
    autoMappedCefrCount: Number(result.autoMappedCefrCount || 0),
    warningsCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
    errorsCount: Array.isArray(result.conflicts) ? result.conflicts.length : (Array.isArray(result.quarantine) ? result.quarantine.length : 0),
    rebuildResult: rebuildResult ? {
      rosterStudentCount: Number(rebuildResult.rosterStudentCount || 0),
      processedStudentCount: Number(rebuildResult.processedStudentCount || 0),
      insertedCount: Number(rebuildResult.insertedCount || 0),
      skippedCount: Number(rebuildResult.skippedCount || 0),
      computeVersion: rebuildResult.computeVersion || null
    } : null
  };
}

function buildOperationRunWarnings(result = {}, existing = []) {
  return [
    ...existing,
    ...(Array.isArray(result.warnings) ? result.warnings.map((message) => ({ code: 'IMPORT_WARNING', message })) : [])
  ];
}

function canManageLearningJourney(req) {
  return hasPermission(req.user, P.CAN_MANAGE_ENGLISH_TEST_TRACKING);
}

function operationRunsQueryForUser(req) {
  const query = { ...(req.query || {}) };
  if (!canManageLearningJourney(req)) {
    delete query.includeArchived;
  }
  return query;
}

async function safeCreateImportRun({ operationType, semesterId, requestId, user, source = 'dashboard' }) {
  try {
    return {
      run: await createLearningJourneyOperationRun({
        operationType,
        semesterId,
        requestId,
        user,
        source,
        dryRun: false,
        confirm: true,
        startedAt: new Date()
      }),
      warnings: []
    };
  } catch (err) {
    return {
      run: null,
      warnings: [{
        code: 'OPERATION_RUN_CREATE_FAILED',
        message: 'operation run 建立失敗；匯入仍會繼續執行。',
        detail: err?.message || String(err)
      }]
    };
  }
}

async function recordImportHistory(payload) {
  try {
    await LearningJourneyImportHistory.create(payload);
  } catch (_) {
    // history 寫入失敗不影響主流程
  }
}

async function ensureStudentAccess(req, studentId, semesterId) {
  if (isTeacher(req.user) && !semesterId) {
    return { ok: false, status: 400, error: 'teacher 查詢學生歷程需提供 semesterId' };
  }
  const scope = await getUserLearningJourneyScope(req.user, semesterId);
  if (!canReadLearningJourneyScope(scope)) {
    return { ok: false, status: 403, error: '您沒有存取此學生資料的權限。', code: 'STUDENT_SCOPE_DENIED' };
  }
  if (scope.scope !== 'teacher') return { ok: true, scope };
  const sid = String(studentId || '').trim().toUpperCase();
  const allowSet = new Set((scope.allowedStudentIds || []).map((x) => String(x || '').trim().toUpperCase()));
  if (!allowSet.has(sid)) {
    return { ok: false, status: 403, error: '你沒有權限查看此學生的學習歷程' };
  }
  return { ok: true, scope };
}

async function getB2Report(req, res) {
  const semesterId = String(req.params.id || '').trim();
  if (!semesterId) {
    return res.status(400).json({ success: false, error: 'semesterId 必填', requestId: req.requestId });
  }
  try {
    const scope = await getUserLearningJourneyScope(req.user, semesterId);
    if (!canReadLearningJourneyScope(scope)) return denyLearningJourneyScope(res, req);
    const data = await getSemesterB2Report(semesterId, scope.scope === 'teacher' ? { allowedStudentIds: scope.allowedStudentIds } : {});
    return res.json({ success: true, data, warnings: [], requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getStudents(req, res) {
  const semesterId = String(req.params.id || '').trim();
  if (!semesterId) {
    return res.status(400).json({ success: false, error: 'semesterId 必填', requestId: req.requestId });
  }
  try {
    const scope = await getUserLearningJourneyScope(req.user, semesterId);
    if (!canReadLearningJourneyScope(scope)) return denyLearningJourneyScope(res, req);
    const {
      keyword,
      grade,
      department,
      b2Skill,
      sortBy,
      sortOrder,
      limit,
      offset
    } = req.query || {};
    const data = await getSemesterStudents(
      semesterId,
      scope.scope === 'teacher'
        ? { keyword, grade, department, b2Skill, sortBy, sortOrder, limit, offset, allowedStudentIds: scope.allowedStudentIds }
        : { keyword, grade, department, b2Skill, sortBy, sortOrder, limit, offset }
    );
    return res.json({ success: true, data, warnings: [], requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getBreakdown(req, res) {
  const semesterId = String(req.params.id || '').trim();
  const groupBy = String((req.query && req.query.groupBy) || '').trim().toLowerCase();
  if (!semesterId) {
    return res.status(400).json({ success: false, error: 'semesterId 必填', requestId: req.requestId });
  }
  if (!['grade', 'department', 'cohort'].includes(groupBy)) {
    return res.status(400).json({ success: false, error: 'groupBy 必須為 grade/department/cohort', requestId: req.requestId });
  }
  try {
    const scope = await getUserLearningJourneyScope(req.user, semesterId);
    if (!canReadLearningJourneyScope(scope)) return denyLearningJourneyScope(res, req);
    const data = await getSemesterBreakdownReport(
      semesterId,
      groupBy,
      scope.scope === 'teacher' ? { allowedStudentIds: scope.allowedStudentIds } : {}
    );
    return res.json({ success: true, data, warnings: [], requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getSemesterHealth(req, res) {
  const semesterId = String(req.params.id || '').trim();
  if (!semesterId) {
    return res.status(400).json({ success: false, error: 'semesterId 必填', requestId: req.requestId });
  }
  try {
    const canManage = hasPermission(req.user, P.CAN_MANAGE_ENGLISH_TEST_TRACKING);
    const data = await getLearningJourneyV3SemesterHealth(semesterId, { includeActions: canManage });
    return res.json({ success: true, data, warnings: data.warnings || [], requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postSemesterRebuild(req, res) {
  const semesterId = String(req.params.id || '').trim();
  if (!semesterId) {
    return res.status(400).json({ success: false, error: 'semesterId 必填', requestId: req.requestId });
  }
  try {
    const body = req.body || {};
    const data = await rebuildLearningJourneyV3Semester(semesterId, {
      dryRun: body.dryRun === false,
      confirm: body.confirm === true,
      reason: body.reason || 'MANUAL_REBUILD_FROM_HEALTH_CARD',
      requestId: req.requestId,
      user: req.user,
      req
    });
    return res.json({ success: true, data, warnings: data.warnings || [], requestId: req.requestId });
  } catch (e) {
    const status = Number(e.status || e.statusCode || 500);
    return res.status(status).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getOperationRuns(req, res) {
  try {
    const data = await listLearningJourneyOperationRuns(operationRunsQueryForUser(req));
    return res.json({ success: true, data, warnings: [], requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function yyyymmdd(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function buildOperationRunsCsv(exportData) {
  const headers = [
    'operationType',
    'semesterId',
    'status',
    'executedByUsername',
    'startedAt',
    'finishedAt',
    'durationMs',
    'requestId',
    'warningsCount',
    'errorCode',
    'errorMessage',
    'archivedAt',
    'archivedByUsername',
    'cleanupRequestId'
  ];
  const rows = Array.isArray(exportData?.items) ? exportData.items : [];
  const lines = [];
  if (exportData?.truncated) {
    lines.push(`# Export limited to ${exportData.limit} of ${exportData.total} matching operation runs`);
  }
  lines.push(headers.join(','));
  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape(row[key])).join(','));
  }
  return lines.join('\r\n');
}

async function exportOperationRunsCsv(req, res) {
  try {
    const query = operationRunsQueryForUser(req);
    const data = await exportLearningJourneyOperationRuns(query);
    auditLogService.logAuditAsync({
      module: 'learning_journey',
      action: 'LEARNING_JOURNEY_OPERATION_RUNS_EXPORT',
      entityType: 'LearningJourneyOperationRun',
      entityId: `export:${req.requestId || Date.now()}`,
      targetSummary: `operation runs export count=${data.items.length}`,
      afterData: {
        filters: {
          semesterId: req.query?.semesterId || null,
          operationType: req.query?.operationType || null,
          status: req.query?.status || null,
          requestId: req.query?.requestId || null,
          warningsOnly: req.query?.warningsOnly || null,
          startedFrom: req.query?.startedFrom || null,
          startedTo: req.query?.startedTo || null,
          includeArchived: query.includeArchived || null
        },
        exportedCount: data.items.length,
        matchedCount: data.total,
        limited: data.truncated === true,
        requestId: req.requestId
      },
      req
    });
    const csv = buildOperationRunsCsv(data);
    const filename = `learning-journey-operation-runs-${yyyymmdd()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (req.requestId) res.setHeader('X-Request-Id', req.requestId);
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postOperationRunsCleanupDryRun(req, res) {
  try {
    const data = await cleanupLearningJourneyOperationRunsDryRun(req.body || {});
    return res.json({ success: true, data, warnings: data.warnings || [], requestId: req.requestId });
  } catch (e) {
    const status = Number(e.status || e.statusCode || 500);
    return res.status(status).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postOperationRunsCleanupArchive(req, res) {
  try {
    const data = await archiveLearningJourneyOperationRuns({
      ...(req.body || {}),
      requestId: req.requestId,
      user: req.user
    });
    auditLogService.logAuditAsync({
      module: 'learning_journey',
      action: 'LEARNING_JOURNEY_OPERATION_RUNS_ARCHIVE',
      entityType: 'LearningJourneyOperationRun',
      entityId: data.cleanupRequestId || `archive:${req.requestId || Date.now()}`,
      targetSummary: `operation runs archive count=${data.archivedCount || 0}`,
      afterData: {
        criteria: data.criteria || {},
        archivedCount: data.archivedCount || 0,
        cleanupRequestId: data.cleanupRequestId || null,
        requestId: req.requestId
      },
      req
    });
    return res.json({ success: true, data, warnings: data.warnings || [], requestId: req.requestId });
  } catch (e) {
    const status = Number(e.status || e.statusCode || 500);
    return res.status(status).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getOperationRunDetail(req, res) {
  try {
    const data = await getLearningJourneyOperationRunDetail(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: '找不到操作紀錄', requestId: req.requestId });
    }
    if (data.archivedAt && !canManageLearningJourney(req)) {
      return res.status(404).json({ success: false, error: '找不到操作紀錄', requestId: req.requestId });
    }
    return res.json({ success: true, data, warnings: [], requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getStudent(req, res) {
  try {
    const studentId = String(req.params.studentId || '').trim();
    const semesterId = String((req.query && (req.query.semesterId || req.query.semester)) || '').trim();
    const access = await ensureStudentAccess(req, studentId, semesterId);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, errorCode: access.code || 'STUDENT_SCOPE_DENIED', error: access.error, requestId: req.requestId });
    }
    const data = await getStudentProfile(studentId, { semesterId });
    if (data.error) {
      return res.status(400).json({ success: false, error: data.error, requestId: req.requestId });
    }
    const warnings = Array.isArray(data.warnings) ? data.warnings : [];
    return res.json({ success: true, data, warnings, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getStudentTrendsHandler(req, res) {
  try {
    const studentId = String(req.params.studentId || '').trim();
    const semesterId = String((req.query && (req.query.semesterId || req.query.semester)) || '').trim();
    const access = await ensureStudentAccess(req, studentId, semesterId);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, errorCode: access.code || 'STUDENT_SCOPE_DENIED', error: access.error, requestId: req.requestId });
    }
    const data = await getStudentTrends(studentId);
    if (data.error) {
      return res.status(400).json({ success: false, error: data.error, requestId: req.requestId });
    }
    const warnings = Array.isArray(data.warnings) ? data.warnings : [];
    return res.json({ success: true, data, warnings, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postEnrollmentImport(req, res) {
  let operationRun = null;
  let operationRunCreateWarnings = [];
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: '請上傳 Excel（.xlsx/.xls）', requestId: req.requestId });
    }
    const semesterId = String((req.body && req.body.semesterId) || req.query.semesterId || '').trim();
    const runState = await safeCreateImportRun({
      operationType: OPERATION_TYPES.IMPORT_ENROLLMENT,
      semesterId,
      requestId: req.requestId,
      user: req.user
    });
    operationRun = runState.run;
    operationRunCreateWarnings = runState.warnings;
    const sourceFileName = safeNormalizeFilename(req.file.originalname);
    const batchId = newImportBatchId('enrollment');
    const result = await importEnrollment(req.file.buffer, semesterId, { batchId });
    if (!result.ok) {
      if (operationRun) {
        await markLearningJourneyOperationRunFailed(operationRun, {
          resultSummary: buildEnrollmentImportResultSummary(result),
          warnings: operationRunCreateWarnings,
          errorCode: result.errorCode || 'IMPORT_ENROLLMENT_FAILED',
          errorMessage: result.error || 'enrollment import failed'
        }).catch(() => {});
      }
      return res.status(400).json({ success: false, ...result, requestId: req.requestId });
    }
    await recordImportHistory({
      semesterId: semesterId || null,
      importType: 'enrollment',
      sourceFile: sourceFileName || null,
      status: computeImportStatus(result),
      importedCount: Number(result.imported || 0),
      updatedCount: 0,
      skippedCount: Number(result.skipped || 0),
      duplicateSkippedCount: Number(result.skipped || 0),
      conflictedCount: Array.isArray(result.conflicts) ? result.conflicts.length : (Array.isArray(result.quarantine) ? result.quarantine.length : 0),
      warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
      summaryJson: {
        batchId,
        importedBy: req.user?.name || req.user?.user || null,
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
        skippedDetails: Array.isArray(result.skippedDetails) ? result.skippedDetails : [],
        quarantine: Array.isArray(result.quarantine) ? result.quarantine : []
      }
    });
    if (operationRun) {
      await markLearningJourneyOperationRunSuccess(operationRun, {
        status: computeImportStatus(result) === 'partial' ? STATUSES.PARTIAL : STATUSES.SUCCESS,
        resultSummary: buildEnrollmentImportResultSummary(result),
        warnings: buildOperationRunWarnings(result, operationRunCreateWarnings)
      }).catch(() => {});
    }
    const responseWarnings = operationRunCreateWarnings.length ? operationRunCreateWarnings : undefined;
    return res.json({ success: true, data: result, warnings: responseWarnings, requestId: req.requestId });
  } catch (e) {
    if (operationRun) {
      await markLearningJourneyOperationRunFailed(operationRun, {
        warnings: operationRunCreateWarnings,
        errorCode: e.code || 'IMPORT_ENROLLMENT_FAILED',
        errorMessage: e.message
      }).catch(() => {});
    }
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postExamImport(req, res) {
  let operationRun = null;
  let operationRunCreateWarnings = [];
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: '請上傳 Excel（.xlsx/.xls）', requestId: req.requestId });
    }
    const semesterId = String((req.body && req.body.semesterId) || req.query.semesterId || '').trim();
    if (!semesterId) {
      return res.status(400).json({ success: false, error: 'semesterId 必填', requestId: req.requestId });
    }
    const runState = await safeCreateImportRun({
      operationType: OPERATION_TYPES.IMPORT_EXAM,
      semesterId,
      requestId: req.requestId,
      user: req.user
    });
    operationRun = runState.run;
    operationRunCreateWarnings = runState.warnings;
    const sourceFileName = safeNormalizeFilename(req.file.originalname);
    const replaceModeRaw = (req.body && req.body.replaceMode) ?? (req.query && req.query.replaceMode);
    const replaceMode = String(replaceModeRaw || '').toLowerCase() === 'true' || replaceModeRaw === true || replaceModeRaw === 1;
    const batchId = newImportBatchId('exam');
    const result = await importExam(req.file.buffer, { batchId, replaceMode });
    const historyRow = await LearningJourneyImportHistory.create({
      semesterId,
      importType: 'external_exam',
      sourceFile: sourceFileName || null,
      status: computeImportStatus(result),
      importedCount: Number(result.inserted || 0),
      updatedCount: Number(result.replaced || 0),
      skippedCount: Number(result.skipped || 0),
      duplicateSkippedCount: Number(result.skipped || 0),
      conflictedCount: Array.isArray(result.conflicts) ? result.conflicts.length : (Array.isArray(result.quarantine) ? result.quarantine.length : 0),
      warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
      summaryJson: {
        batchId,
        sourceBatchId: batchId,
        replaceMode,
        totalRows: Number(result.totalRows || result.inserted || 0),
        importedRows: Number(result.inserted || 0),
        failedRows: Array.isArray(result.conflicts) ? result.conflicts.length : (Array.isArray(result.quarantine) ? result.quarantine.length : 0),
        autoMappedCefrCount: Number(result.autoMappedCefrCount || 0),
        autoMappedCefrDetails: Array.isArray(result.autoMappedCefrDetails) ? result.autoMappedCefrDetails : [],
        importedBy: getImportedBy(req),
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
        skippedDetails: Array.isArray(result.skippedDetails) ? result.skippedDetails : [],
        quarantine: Array.isArray(result.quarantine) ? result.quarantine : []
      }
    });
    const rebuildResult = await rebuildSemesterBestSkills(semesterId);
    if (operationRun) {
      await markLearningJourneyOperationRunSuccess(operationRun, {
        status: computeImportStatus(result) === 'partial' ? STATUSES.PARTIAL : STATUSES.SUCCESS,
        resultSummary: buildExamImportResultSummary(result, rebuildResult),
        warnings: buildOperationRunWarnings(result, operationRunCreateWarnings)
      }).catch(() => {});
    }
    auditLogService.logAuditAsync({
      module: 'learning_journey',
      action: 'exam_import',
      entityType: 'LearningJourneyImportHistory',
      entityId: String(historyRow.id),
      targetSummary: `${semesterId} ${sourceFileName || ''}`.trim(),
      afterData: {
        semesterId,
        batchId,
        sourceFileName,
        inserted: Number(result.inserted || 0),
        replaced: Number(result.replaced || 0),
        skipped: Number(result.skipped || 0),
        autoMappedCefrCount: Number(result.autoMappedCefrCount || 0),
        status: computeImportStatus(result),
        rebuildResult
      },
      req
    });
    const responseWarnings = operationRunCreateWarnings.length ? operationRunCreateWarnings : undefined;
    return res.json({ success: true, data: result, warnings: responseWarnings, requestId: req.requestId });
  } catch (e) {
    if (operationRun) {
      await markLearningJourneyOperationRunFailed(operationRun, {
        warnings: operationRunCreateWarnings,
        errorCode: e.code || 'IMPORT_EXAM_FAILED',
        errorMessage: e.message
      }).catch(() => {});
    }
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postBaselineImport(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: '請上傳 Excel（.xlsx/.xls）', requestId: req.requestId });
    }
    const sourceFileName = safeNormalizeFilename(req.file.originalname);
    const batchId = newImportBatchId('baseline');
    const result = await importBaseline(req.file.buffer, { batchId });
    const historyRow = await LearningJourneyImportHistory.create({
      semesterId: null,
      importType: 'baseline_gsat',
      sourceFile: sourceFileName || null,
      status: computeImportStatus(result),
      importedCount: Number(result.imported || 0),
      updatedCount: 0,
      skippedCount: 0,
      duplicateSkippedCount: 0,
      conflictedCount: Array.isArray(result.quarantine) ? result.quarantine.length : 0,
      warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
      summaryJson: {
        batchId,
        totalRows: Number(result.imported || 0) + (Array.isArray(result.quarantine) ? result.quarantine.length : 0),
        importedBy: getImportedBy(req),
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        quarantine: Array.isArray(result.quarantine) ? result.quarantine : [],
        analyticsRebuild: result.analyticsRebuild || null,
      },
    });
    auditLogService.logAuditAsync({
      module: 'learning_journey',
      action: 'baseline_import',
      entityType: 'LearningJourneyImportHistory',
      entityId: String(historyRow.id),
      targetSummary: sourceFileName || 'baseline_gsat',
      afterData: {
        batchId,
        sourceFileName,
        imported: Number(result.imported || 0),
        quarantineCount: Array.isArray(result.quarantine) ? result.quarantine.length : 0,
        status: computeImportStatus(result),
        analyticsRebuild: result.analyticsRebuild || null,
      },
      req,
    });
    return res.json({ success: true, data: result, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function deleteImportHistory(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'history id 不合法', requestId: req.requestId });
    }
    const row = await LearningJourneyImportHistory.findByPk(id);
    if (!row) {
      return res.status(404).json({ success: false, error: '找不到匯入紀錄', requestId: req.requestId });
    }
    const requestedType = String((req.query && req.query.type) || (req.body && req.body.type) || '').trim();
    if (requestedType) {
      const rowType = normalizeImportType(row.importType);
      if (requestedType !== rowType && requestedType !== row.importType) {
        return res.status(409).json({
          success: false,
          error: `匯入類型不符：此紀錄為 ${rowType}`,
          requestId: req.requestId,
        });
      }
    }
    const batchId = String(row.summaryJson?.batchId || '').trim();
    if (!batchId) {
      return res.status(409).json({
        success: false,
        error: '此筆匯入紀錄缺少 batchId，無法安全回滾，已拒絕刪除',
        requestId: req.requestId,
      });
    }
    const semesterId = String(row.semesterId || '').trim();
    if (row.importType === 'external_exam' && !semesterId) {
      return res.status(409).json({
        success: false,
        error: '此筆考試匯入紀錄缺少 semesterId，無法安全重建 best skills，已拒絕回滾',
        requestId: req.requestId,
      });
    }

    const { rollback, rebuildResult, analyticsRebuild } = await rollbackImportHistoryRow(row, {
      rebuildBestSkills: row.importType === 'external_exam' ? rebuildSemesterBestSkills : null,
    });

    auditLogService.logAuditAsync({
      module: 'learning_journey',
      action: 'rollback_import_history',
      entityType: 'LearningJourneyImportHistory',
      entityId: String(row.id),
      targetSummary: `${importTypeLabel(row.importType)} ${semesterId || ''} ${row.sourceFile || ''}`.trim(),
      beforeData: {
        id: row.id,
        importType: row.importType,
        semesterId,
        batchId,
        sourceFile: row.sourceFile,
        status: row.status,
      },
      afterData: {
        rollback,
        rebuildResult,
        analyticsRebuild,
        softExclude: true,
      },
      req,
    });

    return res.json({
      success: true,
      data: {
        id: row.id,
        importType: row.importType,
        batchId,
        status: 'rolled_back',
        softRollback: rollback,
        rebuildResult,
        analyticsRebuild,
      },
      warnings: [],
      requestId: req.requestId,
    });
  } catch (e) {
    const status = Number(e.status || 500);
    return res.status(status).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getImportHistories(req, res) {
  try {
    const semesterId = String((req.query && req.query.semesterId) || '').trim();
    const limitRaw = Number((req.query && req.query.limit) || 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 20;
    const where = semesterId
      ? {
        [Op.or]: [
          { semesterId },
          { importType: 'baseline_gsat' },
        ],
      }
      : {};
    const rows = await LearningJourneyImportHistory.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit
    });
    const items = rows.map((r) => {
      const inserted = Number(r.importedCount || 0);
      const updated = Number(r.updatedCount || 0);
      const skipped = Number(r.skippedCount || 0);
      const warningsCount = Number(r.warningCount || 0);
      const conflictsCount = Number(r.conflictedCount || 0);
      const totalRows = Number(r.summaryJson?.totalRows || inserted + updated + skipped + conflictsCount);
      return {
        id: r.id,
        importedAt: r.createdAt,
        createdAt: r.createdAt,
        importType: r.importType,
        type: normalizeImportType(r.importType),
        typeLabel: importTypeLabel(r.importType),
        status: r.status,
        sourceFile: r.sourceFile,
        fileName: r.sourceFile,
        semesterId: r.semesterId,
        inserted,
        updated,
        skipped,
        totalRows,
        successRows: inserted + updated,
        failedRows: Number(r.summaryJson?.failedRows || conflictsCount),
        autoMappedCefrCount: Number(r.summaryJson?.autoMappedCefrCount || 0),
        warningsCount,
        conflictsCount,
        importedBy: r.summaryJson?.importedBy || null,
        createdBy: r.summaryJson?.importedBy || null,
        batchId: r.summaryJson?.batchId || null,
        sourceBatchId: r.summaryJson?.sourceBatchId || r.summaryJson?.batchId || null,
        details: {
          warnings: Array.isArray(r.summaryJson?.warnings) ? r.summaryJson.warnings : [],
          conflicts: Array.isArray(r.summaryJson?.conflicts) ? r.summaryJson.conflicts : [],
          skipped: Array.isArray(r.summaryJson?.skippedDetails) ? r.summaryJson.skippedDetails : [],
          quarantine: Array.isArray(r.summaryJson?.quarantine) ? r.summaryJson.quarantine : [],
          autoMappedCefr: Array.isArray(r.summaryJson?.autoMappedCefrDetails) ? r.summaryJson.autoMappedCefrDetails : []
        }
      };
    });
    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          limit,
          offset: 0,
          returned: items.length
        }
      },
      warnings: [],
      requestId: req.requestId
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

/**
 * POST /sync/ewl
 * body: { startDate?, endDate?, studentId?, dryRun?, lookbackDays?, lookaheadDays? }
 * dryRun 預設 true（安全）；要寫入需 dryRun:false 或 confirm:true
 */
async function postEwlSync(req, res) {
  const body = req.body || {};
  const dryRun = body.dryRun === true || (body.dryRun !== false && body.confirm !== true);
  const startDate = body.startDate ? String(body.startDate).slice(0, 10) : null;
  const endDate = body.endDate ? String(body.endDate).slice(0, 10) : null;
  if ((startDate && !endDate) || (!startDate && endDate)) {
    return res.status(400).json({
      success: false,
      error: 'startDate 與 endDate 需同時提供',
      requestId: req.requestId
    });
  }

  const { run, warnings: runWarnings } = await safeCreateImportRun({
    operationType: OPERATION_TYPES.SYNC_EWL,
    semesterId: null,
    requestId: req.requestId,
    user: req.user,
    source: 'dashboard'
  });

  try {
    const result = await syncEwlReservations({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      studentId: body.studentId || undefined,
      dryRun,
      lookbackDays: body.lookbackDays,
      lookaheadDays: body.lookaheadDays,
      rebuildAnalytics: false
    });

    // 寫入後背景重建時間軸，確保畫面用 EventDate 而非舊的報名日
    if (!dryRun && Array.isArray(result.affectedStudentIds) && result.affectedStudentIds.length) {
      const studentIds = [...result.affectedStudentIds];
      setImmediate(() => {
        (async () => {
          try {
            const { rebuildAnalyticsInBatches } = require('../services/learningJourney/analytics/analyticRebuildService');
            await rebuildAnalyticsInBatches({
              scope: 'ewl-sync',
              studentIds,
              batchSize: 50
            });
          } catch (_) {
            // 背景 rebuild 失敗不影響同步回應；可再手動 lj:rebuild-analytics
          }
        })();
      });
      result.analyticsRebuild = {
        deferred: true,
        studentCount: studentIds.length
      };
    }

    // 回應不回傳完整學號清單（可能上千筆），僅保留計數
    const responseData = { ...result };
    delete responseData.affectedStudentIds;

    if (run) {
      await markLearningJourneyOperationRunSuccess(run, {
        status: result.errorCount > 0 ? STATUSES.PARTIAL : STATUSES.SUCCESS,
        resultSummary: {
          dryRun: result.dryRun,
          startDate: result.startDate,
          endDate: result.endDate,
          fetched: result.fetched,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          errorCount: result.errorCount,
          affectedStudentCount: result.affectedStudentCount || 0,
          analyticsRebuild: result.analyticsRebuild || null
        },
        warnings: Array.isArray(result.errors) ? result.errors : []
      }).catch(() => {});
    }

    try {
      auditLogService.logAuditAsync({
        module: 'learning_journey',
        action: dryRun ? 'ewl_sync_dry_run' : 'ewl_sync_apply',
        entityType: 'ewl_api',
        entityId: `${result.startDate}_${result.endDate}`,
        targetSummary: `EWL sync ${result.startDate}~${result.endDate} fetched=${result.fetched}`,
        afterData: {
          dryRun: result.dryRun,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          errorCount: result.errorCount
        },
        req
      });
    } catch (_) {
      // audit 失敗不影響主流程
    }

    return res.json({
      success: true,
      data: responseData,
      warnings: runWarnings,
      requestId: req.requestId
    });
  } catch (e) {
    if (run) {
      await markLearningJourneyOperationRunFailed(run, {
        errorMessage: e.message,
        errorCode: e.code || 'EWL_SYNC_FAILED'
      }).catch(() => {});
    }
    return res.status(500).json({
      success: false,
      error: e.message || 'EWL 同步失敗',
      code: e.code || 'EWL_SYNC_FAILED',
      requestId: req.requestId
    });
  }
}

module.exports = {
  getB2Report,
  getBreakdown,
  getSemesterHealth,
  postSemesterRebuild,
  getOperationRuns,
  exportOperationRunsCsv,
  postOperationRunsCleanupDryRun,
  postOperationRunsCleanupArchive,
  getOperationRunDetail,
  getStudents,
  getStudent,
  getStudentTrendsHandler,
  getImportHistories,
  deleteImportHistory,
  postEnrollmentImport,
  postExamImport,
  postBaselineImport,
  postEwlSync,
};
