'use strict';

const { Op } = require('sequelize');
const {
  LjStudentEvent,
  EtEnrollmentSnapshot,
  EtExamAttempt,
} = require('../../models');
const {
  EVENT_STATUS,
  REASON_CODES,
} = require('../../constants/learningJourneyEventConstants');
const { rebuildAnalytics } = require('./analytics/analyticRebuildService');

/**
 * 匯入回滾：軟排除，不物理刪除研究資料。
 */
async function softRollbackImportBatch({
  importType,
  batchId,
  semesterId,
  transaction,
}) {
  const t = transaction;
  const result = {
    importType,
    batchId,
    deactivatedSnapshots: 0,
    excludedAttempts: 0,
    excludedEvents: 0,
    studentIds: new Set(),
  };

  if (importType === 'enrollment') {
    const [count] = await EtEnrollmentSnapshot.update(
      { isActive: false },
      { where: { sourceBatchId: batchId }, transaction: t }
    );
    result.deactivatedSnapshots = count;
    const snaps = await EtEnrollmentSnapshot.findAll({
      where: { sourceBatchId: batchId },
      attributes: ['studentId'],
      transaction: t,
    });
    snaps.forEach((s) => result.studentIds.add(String(s.studentId).toUpperCase()));
  } else if (importType === 'external_exam') {
    const attempts = await EtExamAttempt.findAll({
      where: { [Op.or]: [{ sourceBatchId: batchId }, { importBatchId: batchId }] },
      attributes: ['id', 'studentId'],
      transaction: t,
    });
    if (attempts.length) {
      const attemptIds = attempts.map((a) => a.id);
      await EtExamAttempt.update(
        { status: 'excluded' },
        { where: { id: { [Op.in]: attemptIds } }, transaction: t }
      );
      result.excludedAttempts = attempts.length;
      attempts.forEach((a) => result.studentIds.add(String(a.studentId).toUpperCase()));

      const eventWhere = {
        sourceSystem: 'et_exam_attempts',
        [Op.or]: attemptIds.flatMap((id) => [
          { sourceRecordId: String(id) },
          { sourceRecordId: { [Op.like]: `${id}:%` } },
        ]),
      };
      const [eventCount] = await LjStudentEvent.update(
        {
          excludeFlag: true,
          reasonCode: REASON_CODES.IMPORT_ROLLBACK,
          status: EVENT_STATUS.EXCLUDED,
        },
        { where: eventWhere, transaction: t }
      );
      result.excludedEvents += eventCount;
    }
  } else if (importType === 'baseline_gsat') {
    const [eventCount] = await LjStudentEvent.update(
      {
        excludeFlag: true,
        reasonCode: REASON_CODES.IMPORT_ROLLBACK,
        status: EVENT_STATUS.EXCLUDED,
      },
      {
        where: {
          sourceSystem: 'baseline_import',
          sourceRecordId: { [Op.like]: `%:${batchId}` },
        },
        transaction: t,
      }
    );
    result.excludedEvents = eventCount;
    const events = await LjStudentEvent.findAll({
      where: {
        sourceSystem: 'baseline_import',
        sourceRecordId: { [Op.like]: `%:${batchId}` },
      },
      attributes: ['studentId'],
      transaction: t,
    });
    events.forEach((e) => result.studentIds.add(String(e.studentId).toUpperCase()));
  } else {
    const err = new Error(`不支援的 importType: ${importType}`);
    err.status = 400;
    throw err;
  }

  return {
    ...result,
    studentIds: [...result.studentIds],
    semesterId: semesterId || null,
  };
}

async function rollbackImportHistoryRow(row, { rebuildBestSkills, transaction } = {}) {
  const batchId = String(row.summaryJson?.batchId || '').trim();
  if (!batchId) {
    const err = new Error('缺少 batchId，無法回滾');
    err.status = 409;
    throw err;
  }
  if (row.status === 'rolled_back') {
    const err = new Error('此匯入紀錄已回滾');
    err.status = 409;
    throw err;
  }

  const runInTx = async (t) => {
    const rollback = await softRollbackImportBatch({
      importType: row.importType,
      batchId,
      semesterId: row.semesterId,
      transaction: t,
    });

    let rebuildResult = null;
    if (typeof rebuildBestSkills === 'function' && row.semesterId && row.importType === 'external_exam') {
      rebuildResult = await rebuildBestSkills(String(row.semesterId), { transaction: t });
    }

    let analyticsRebuild = null;
    if (rollback.studentIds.length) {
      analyticsRebuild = await rebuildAnalytics({
        scope: `rollback-${row.id}`,
        studentIds: rollback.studentIds,
      });
    }

    await row.update(
      {
        status: 'rolled_back',
        summaryJson: {
          ...(row.summaryJson || {}),
          rolledBackAt: new Date().toISOString(),
          rollback: {
            deactivatedSnapshots: rollback.deactivatedSnapshots,
            excludedAttempts: rollback.excludedAttempts,
            excludedEvents: rollback.excludedEvents,
          },
        },
      },
      { transaction: t }
    );

    return { rollback, rebuildResult, analyticsRebuild };
  };

  if (transaction) return runInTx(transaction);
  const { sequelize } = require('../../models');
  return sequelize.transaction(runInTx);
}

module.exports = {
  softRollbackImportBatch,
  rollbackImportHistoryRow,
};
