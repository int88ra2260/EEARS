'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  LearningJourneyImportHistory,
  LearningJourneyOperationRun,
  JobRun,
  ClassMembership,
  Reservation,
  EtEnrollmentSnapshot,
  EtExamAttempt,
  EtExamAttemptScore,
  EtExamAttemptSkillScore,
  BestepAttendance,
  BestepExamScore,
  AuditLog,
} = require('../models');
const { rebuildSemesterBestSkills } = require('./englishTestTracking/semesterBestSkillService');
const auditLogService = require('./auditLogService');
const importRollbackManifestService = require('./importRollbackManifestService');

const LEGACY_IMPORT_WINDOW_MS = 30 * 60 * 1000;

const LJ_IMPORT_OPERATION_TYPES = new Set(['IMPORT_ENROLLMENT', 'IMPORT_EXAM']);
const LJ_RECORD_ONLY_OPERATION_TYPES = new Set([
  'REBUILD_BEST_SKILL_PROJECTION',
  'REBUILD_ANALYTICS',
  'HEALTH_CHECK',
]);

function auditBestepImportType(row) {
  const action = String(row?.action || '').toLowerCase();
  const mod = String(row?.module || '').toLowerCase();
  const summary = String(row?.targetSummary || '').toLowerCase();
  const hay = `${action} ${mod} ${summary}`;
  if (hay.includes('bestep') && hay.includes('attendance')) return 'bestep_attendance_import';
  if (hay.includes('bestep') && hay.includes('score')) return 'bestep_score_import';
  if (mod === 'bestep' && action.includes('attendance')) return 'bestep_attendance_import';
  if (mod === 'bestep' && action.includes('score')) return 'bestep_score_import';
  return null;
}

function auditImportTypeFromRow(row) {
  const bestepType = auditBestepImportType(row);
  if (bestepType) return bestepType;
  const action = String(row?.action || '').toLowerCase();
  if (action === 'import_class_roster') return 'class_roster_import';
  if (action === 'import_card_excel') return 'event_card_excel_import';
  return null;
}

function parseBestepEntityId(entityId) {
  const parts = String(entityId || '').split(':');
  if (parts.length < 3) return null;
  const examDate = parts.pop();
  const examTypeRaw = parts.pop();
  const semester = parts.join(':');
  const examType =
    !examTypeRaw || examTypeRaw === 'null' || examTypeRaw === 'undefined' ? null : examTypeRaw;
  if (!semester || !examDate) return null;
  return { semester, examType, examDate };
}

function ljBatchIdFromRow(row) {
  return String(row?.summaryJson?.batchId || row?.summaryJson?.sourceBatchId || '').trim();
}

function ljOperationBatchIdFromRow(row) {
  return String(row?.resultSummary?.batchId || row?.resultSummary?.sourceBatchId || '').trim();
}

function isBestepImportType(importType) {
  return importType === 'bestep_attendance_import' || importType === 'bestep_score_import';
}

async function findLjImportHistoryByBatchId(batchId) {
  const bid = String(batchId || '').trim();
  if (!bid) return null;
  return LearningJourneyImportHistory.findOne({
    where: sequelize.where(
      sequelize.fn(
        'JSON_UNQUOTE',
        sequelize.fn('JSON_EXTRACT', sequelize.col('summary_json'), '$.batchId'),
      ),
      bid,
    ),
    order: [['id', 'DESC']],
  });
}

/**
 * @param {string} source
 * @param {object} row
 */
function resolveDeletable(source, row) {
  if (source === 'lj_import_history') {
    const batchId = ljBatchIdFromRow(row);
    if (!batchId) {
      return { deletable: false, deleteDisabledReason: '此筆紀錄缺少 batchId，無法安全回滾' };
    }
    if (row.importType === 'external_exam' && !String(row.semesterId || '').trim()) {
      return { deletable: false, deleteDisabledReason: '此筆考試匯入缺少學期，無法安全回滾' };
    }
    if (!['enrollment', 'external_exam'].includes(row.importType)) {
      return { deletable: false, deleteDisabledReason: `不支援的匯入類型：${row.importType}` };
    }
    return { deletable: true, deleteDisabledReason: null };
  }

  if (source === 'lj_operation_run') {
    const opType = String(row?.operationType || '').trim();
    if (LJ_IMPORT_OPERATION_TYPES.has(opType)) {
      const batchId = ljOperationBatchIdFromRow(row);
      if (!batchId) {
        return { deletable: false, deleteDisabledReason: '此操作紀錄缺少 batchId，無法安全回滾' };
      }
      return { deletable: true, deleteDisabledReason: null };
    }
    if (LJ_RECORD_ONLY_OPERATION_TYPES.has(opType)) {
      return {
        deletable: true,
        deleteDisabledReason: null,
        recordOnly: true,
      };
    }
    return { deletable: false, deleteDisabledReason: '此操作類型不支援從匯入紀錄中心刪除' };
  }

  if (source === 'job_run') {
    return {
      deletable: true,
      deleteDisabledReason: null,
      recordOnly: true,
    };
  }

  if (source === 'audit_log') {
    const importType = auditImportTypeFromRow(row);
    if (isBestepImportType(importType)) {
      const afterData = row.afterData || {};
      if (afterData.importBatchId) {
        return { deletable: true, deleteDisabledReason: null };
      }
      if (importType === 'bestep_attendance_import' && parseBestepEntityId(row.entityId)) {
        return { deletable: true, deleteDisabledReason: null, legacyRollback: true };
      }
      if (importType === 'bestep_score_import' && afterData.semester) {
        return { deletable: true, deleteDisabledReason: null, legacyRollback: true };
      }
      return { deletable: false, deleteDisabledReason: '缺少匯入批次資訊，無法安全回滾' };
    }
    if (importType === 'class_roster_import') {
      const afterData = row.afterData || {};
      if (!String(afterData.importBatchId || '').trim()) {
        return { deletable: false, deleteDisabledReason: '舊版班級名冊匯入缺少 importBatchId，無法安全回滾' };
      }
      return { deletable: true, deleteDisabledReason: null };
    }
    if (importType === 'event_card_excel_import') {
      const afterData = row.afterData || {};
      if (!String(afterData.importBatchId || '').trim()) {
        return { deletable: false, deleteDisabledReason: '舊版刷卡匯入缺少 importBatchId，無法安全回滾' };
      }
      return { deletable: true, deleteDisabledReason: null };
    }
    return { deletable: false, deleteDisabledReason: '此稽核摘要不支援從匯入紀錄中心刪除' };
  }

  return { deletable: false, deleteDisabledReason: '此來源紀錄不支援刪除' };
}

async function rollbackLjBatchData(row, batchId, options = {}) {
  let deletedSnapshots = 0;
  let deletedAttempts = 0;
  let deletedAttemptScores = 0;
  let deletedSkillScores = 0;
  let rebuildResult = null;
  const semesterId = String(row.semesterId || '').trim();
  const importType = row.importType;

  if (importType === 'enrollment') {
    deletedSnapshots = await EtEnrollmentSnapshot.destroy({
      where: { sourceBatchId: batchId },
      ...options,
    });
  } else if (importType === 'external_exam') {
    const attempts = await EtExamAttempt.findAll({
      where: { [Op.or]: [{ sourceBatchId: batchId }, { importBatchId: batchId }] },
      attributes: ['id'],
      ...options,
    });
    const attemptIds = attempts.map((x) => x.id);
    if (attemptIds.length) {
      deletedSkillScores = await EtExamAttemptSkillScore.destroy({
        where: { attemptId: { [Op.in]: attemptIds } },
        ...options,
      });
      deletedAttemptScores = await EtExamAttemptScore.destroy({
        where: { attemptId: { [Op.in]: attemptIds } },
        ...options,
      });
      deletedAttempts = await EtExamAttempt.destroy({
        where: { id: { [Op.in]: attemptIds } },
        ...options,
      });
    }
    if (semesterId) {
      rebuildResult = await rebuildSemesterBestSkills(semesterId, options);
    }
  }

  return {
    batchId,
    deletedSnapshots,
    deletedAttempts,
    deletedAttemptScores,
    deletedSkillScores,
    rebuildResult,
  };
}

async function deleteLjImportHistoryById(historyId) {
  const id = Number(historyId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, status: 400, error: 'history id 不合法' };
  }
  const row = await LearningJourneyImportHistory.findByPk(id);
  if (!row) {
    return { ok: false, status: 404, error: '找不到匯入紀錄' };
  }

  const deletable = resolveDeletable('lj_import_history', row);
  if (!deletable.deletable) {
    return { ok: false, status: 409, error: deletable.deleteDisabledReason };
  }

  const batchId = ljBatchIdFromRow(row);
  let rollbackResult = null;

  await sequelize.transaction(async (t) => {
    rollbackResult = await rollbackLjBatchData(row, batchId, { transaction: t });
    await row.destroy({ transaction: t });
  });

  return {
    ok: true,
    data: {
      source: 'lj_import_history',
      sourceId: String(id),
      ...rollbackResult,
    },
  };
}

async function rollbackClassRosterManifest(manifest, options = {}) {
  let restoredMemberships = 0;
  let deletedMemberships = 0;
  const updatedSnapshots = Array.isArray(manifest.updatedSnapshots) ? manifest.updatedSnapshots : [];
  const createdMembershipIds = Array.isArray(manifest.createdMembershipIds) ? manifest.createdMembershipIds : [];

  for (const snap of updatedSnapshots) {
    if (!snap?.id) continue;
    const [count] = await ClassMembership.update(
      {
        studentName: snap.studentName,
        department: snap.department,
        email: snap.email,
        grade: snap.grade,
      },
      { where: { id: snap.id, classId: manifest.classId, semester: manifest.semester }, ...options },
    );
    restoredMemberships += count;
  }

  if (createdMembershipIds.length) {
    deletedMemberships = await ClassMembership.destroy({
      where: {
        id: { [Op.in]: createdMembershipIds },
        classId: manifest.classId,
        semester: manifest.semester,
      },
      ...options,
    });
  }

  return { restoredMemberships, deletedMemberships };
}

async function rollbackEventCardExcelManifest(manifest, options = {}) {
  let restoredReservations = 0;
  const rollbacks = Array.isArray(manifest.reservationRollbacks) ? manifest.reservationRollbacks : [];
  for (const item of rollbacks) {
    if (!item?.id) continue;
    const [count] = await Reservation.update(
      {
        checkinStatus: item.checkinStatus || '未簽到',
        checkinTime: item.checkinTime || null,
      },
      { where: { id: item.id, eventId: manifest.eventId }, ...options },
    );
    restoredReservations += count;
  }
  return { restoredReservations };
}

async function deleteBestepFromAuditLog(row) {
  const importType = auditBestepImportType(row);
  const deletable = resolveDeletable('audit_log', row);
  if (!deletable.deletable) {
    return { ok: false, status: 409, error: deletable.deleteDisabledReason };
  }

  const afterData = row.afterData || {};
  const importBatchId = String(afterData.importBatchId || '').trim();
  let deletedRows = 0;
  let rollbackMode = 'batch';

  await sequelize.transaction(async (t) => {
    if (importType === 'bestep_attendance_import') {
      if (importBatchId) {
        deletedRows = await BestepAttendance.destroy({ where: { importBatchId }, transaction: t });
      } else {
        rollbackMode = 'legacy_time_window';
        deletedRows = await deleteBestepAttendanceLegacy(row, afterData, { transaction: t });
      }
    } else if (importBatchId) {
      deletedRows = await BestepExamScore.destroy({ where: { importBatchId }, transaction: t });
    } else {
      rollbackMode = 'legacy_time_window';
      deletedRows = await deleteBestepScoresLegacy(row, afterData, { transaction: t });
    }
    await row.destroy({ transaction: t });
  });

  return {
    ok: true,
    data: {
      source: 'audit_log',
      sourceId: String(row.id),
      importType,
      importBatchId: importBatchId || null,
      rollbackMode,
      deletedRows,
    },
  };
}

async function deleteClassRosterFromAuditLog(row) {
  const afterData = row.afterData || {};
  const importBatchId = String(afterData.importBatchId || '').trim();
  if (!importBatchId) {
    return { ok: false, status: 409, error: '缺少 importBatchId，無法安全回滾班級名冊匯入' };
  }
  const manifestRow = await importRollbackManifestService.findByBatchId(importBatchId);
  if (!manifestRow) {
    return { ok: false, status: 409, error: '找不到班級名冊回滾清單，已拒絕刪除' };
  }
  const manifest = manifestRow.manifestJson || {};
  let rollbackResult = null;

  await sequelize.transaction(async (t) => {
    rollbackResult = await rollbackClassRosterManifest(manifest, { transaction: t });
    await importRollbackManifestService.deleteByBatchId(importBatchId, { transaction: t });
    await row.destroy({ transaction: t });
  });

  return {
    ok: true,
    data: {
      source: 'audit_log',
      sourceId: String(row.id),
      importType: 'class_roster_import',
      importBatchId,
      rollbackMode: 'manifest',
      ...rollbackResult,
    },
  };
}

async function deleteEventCardExcelFromAuditLog(row) {
  const afterData = row.afterData || {};
  const importBatchId = String(afterData.importBatchId || '').trim();
  if (!importBatchId) {
    return { ok: false, status: 409, error: '缺少 importBatchId，無法安全回滾刷卡匯入' };
  }
  const manifestRow = await importRollbackManifestService.findByBatchId(importBatchId);
  if (!manifestRow) {
    return { ok: false, status: 409, error: '找不到刷卡匯入回滾清單，已拒絕刪除' };
  }
  const manifest = manifestRow.manifestJson || {};
  let rollbackResult = null;

  await sequelize.transaction(async (t) => {
    rollbackResult = await rollbackEventCardExcelManifest(manifest, { transaction: t });
    await importRollbackManifestService.deleteByBatchId(importBatchId, { transaction: t });
    await row.destroy({ transaction: t });
  });

  return {
    ok: true,
    data: {
      source: 'audit_log',
      sourceId: String(row.id),
      importType: 'event_card_excel_import',
      importBatchId,
      rollbackMode: 'manifest',
      ...rollbackResult,
    },
  };
}

async function deleteFromAuditLog(auditId) {
  const id = Number(auditId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, status: 400, error: 'audit id 不合法' };
  }
  const row = await AuditLog.findByPk(id);
  if (!row) {
    return { ok: false, status: 404, error: '找不到稽核匯入紀錄' };
  }

  const importType = auditImportTypeFromRow(row);
  if (isBestepImportType(importType)) {
    return deleteBestepFromAuditLog(row);
  }
  if (importType === 'class_roster_import') {
    return deleteClassRosterFromAuditLog(row);
  }
  if (importType === 'event_card_excel_import') {
    return deleteEventCardExcelFromAuditLog(row);
  }

  return { ok: false, status: 409, error: '此稽核紀錄不是可回滾的匯入' };
}

async function deleteLjOperationRunById(runId) {
  const id = Number(runId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, status: 400, error: 'operation run id 不合法' };
  }
  const row = await LearningJourneyOperationRun.findByPk(id);
  if (!row) {
    return { ok: false, status: 404, error: '找不到操作紀錄' };
  }

  const deletable = resolveDeletable('lj_operation_run', row);
  if (!deletable.deletable) {
    return { ok: false, status: 409, error: deletable.deleteDisabledReason };
  }

  if (deletable.recordOnly) {
    await row.destroy();
    return {
      ok: true,
      data: {
        source: 'lj_operation_run',
        sourceId: String(id),
        operationType: row.operationType,
        rollbackMode: 'record_only',
        deletedRows: 0,
      },
    };
  }

  const batchId = ljOperationBatchIdFromRow(row);
  const history = await findLjImportHistoryByBatchId(batchId);
  if (!history) {
    return { ok: false, status: 409, error: '找不到對應的學習歷程匯入紀錄，無法安全回滾' };
  }

  const historyDeletable = resolveDeletable('lj_import_history', history);
  if (!historyDeletable.deletable) {
    return { ok: false, status: 409, error: historyDeletable.deleteDisabledReason };
  }

  let rollbackResult = null;
  await sequelize.transaction(async (t) => {
    rollbackResult = await rollbackLjBatchData(history, ljBatchIdFromRow(history) || batchId, { transaction: t });
    await history.destroy({ transaction: t });
    await row.destroy({ transaction: t });
  });

  return {
    ok: true,
    data: {
      source: 'lj_operation_run',
      sourceId: String(id),
      batchId,
      importHistoryId: history.id,
      operationType: row.operationType,
      rollbackMode: 'import_batch',
      ...rollbackResult,
    },
  };
}

async function deleteJobRunById(runId) {
  const id = Number(runId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, status: 400, error: 'job run id 不合法' };
  }
  const row = await JobRun.findByPk(id);
  if (!row) {
    return { ok: false, status: 404, error: '找不到 job 執行紀錄' };
  }

  await row.destroy();
  return {
    ok: true,
    data: {
      source: 'job_run',
      sourceId: String(id),
      jobName: row.jobName,
      rollbackMode: 'record_only',
      deletedRows: 0,
    },
  };
}

async function deleteBestepAttendanceLegacy(auditRow, afterData, options = {}) {
  const parsed = parseBestepEntityId(auditRow.entityId);
  if (!parsed) {
    throw new Error('無法解析 BESTEP 出席匯入的 entityId');
  }
  const semester = afterData.semester || parsed.semester;
  const examDate = afterData.examDate || parsed.examDate;
  const auditTime = new Date(auditRow.createdAt).getTime();
  if (!Number.isFinite(auditTime)) {
    throw new Error('稽核紀錄時間無效');
  }
  const from = new Date(auditTime - LEGACY_IMPORT_WINDOW_MS);
  const to = new Date(auditTime + LEGACY_IMPORT_WINDOW_MS);
  return BestepAttendance.destroy({
    where: {
      semester,
      examDate,
      importBatchId: { [Op.is]: null },
      importedAt: { [Op.between]: [from, to] },
    },
    ...options,
  });
}

async function deleteBestepScoresLegacy(auditRow, afterData, options = {}) {
  const semester = afterData.semester;
  if (!semester) {
    throw new Error('缺少學期資訊，無法回滾 BESTEP 成績匯入');
  }
  const auditTime = new Date(auditRow.createdAt).getTime();
  if (!Number.isFinite(auditTime)) {
    throw new Error('稽核紀錄時間無效');
  }
  const from = new Date(auditTime - LEGACY_IMPORT_WINDOW_MS);
  const to = new Date(auditTime + LEGACY_IMPORT_WINDOW_MS);
  return BestepExamScore.destroy({
    where: {
      semester,
      importBatchId: { [Op.is]: null },
      importedAt: { [Op.between]: [from, to] },
    },
    ...options,
  });
}

/**
 * @param {string} source
 * @param {string|number} sourceId
 */
async function deleteImportRun(source, sourceId) {
  const src = String(source || '').trim();
  const sid = String(sourceId || '').trim();
  if (!src || !sid) {
    return { ok: false, status: 400, error: 'source 或 sourceId 不可為空' };
  }

  if (src === 'lj_import_history') {
    return deleteLjImportHistoryById(sid);
  }
  if (src === 'audit_log') {
    return deleteFromAuditLog(sid);
  }
  if (src === 'lj_operation_run') {
    return deleteLjOperationRunById(sid);
  }
  if (src === 'job_run') {
    return deleteJobRunById(sid);
  }

  return { ok: false, status: 400, error: `不支援刪除的 source：${src}` };
}

function auditDeleteImportRun(req, payload) {
  auditLogService.logAuditAsync({
    module: payload.module || 'import_center',
    action: 'delete_import_run',
    entityType: 'ImportRun',
    entityId: `${payload.source}:${payload.sourceId}`,
    targetSummary: payload.summary || 'delete import run',
    afterData: payload.data || null,
    req,
  });
}

module.exports = {
  resolveDeletable,
  deleteImportRun,
  auditDeleteImportRun,
  parseBestepEntityId,
  auditImportTypeFromRow,
  rollbackClassRosterManifest,
  rollbackEventCardExcelManifest,
  LEGACY_IMPORT_WINDOW_MS,
};
