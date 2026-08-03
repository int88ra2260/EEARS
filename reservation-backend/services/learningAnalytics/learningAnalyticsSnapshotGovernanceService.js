'use strict';

const { Op } = require('sequelize');
const sequelize = require('../../db');
const {
  LjAnalyticStudent,
  LjAnalyticExam,
  AnalyticsModelRun,
} = require('../../models');
const { summarizeSnapshotLabel } = require('./learningAnalyticsMetaService');

function isGlobalSnapshot(version) {
  return String(version || '').startsWith('global-');
}

async function listSnapshotInventory() {
  const [rows] = await sequelize.query(
    `SELECT snapshot_version AS snapshotVersion,
            COUNT(*) AS studentCount,
            MAX(derived_at) AS derivedAt
     FROM lj_analytic_students
     WHERE snapshot_version IS NOT NULL AND snapshot_version <> ''
     GROUP BY snapshot_version
     ORDER BY derivedAt DESC`
  );
  return rows.map((row) => ({
    snapshotVersion: row.snapshotVersion,
    studentCount: Number(row.studentCount) || 0,
    derivedAt: row.derivedAt,
    label: summarizeSnapshotLabel(row.snapshotVersion),
    scope: String(row.snapshotVersion).split('-')[0] || 'unknown',
  }));
}

function pickSnapshotsToKeep(inventory, { keepGlobalCount = 1 } = {}) {
  const keep = new Set();
  const globals = inventory
    .filter((row) => isGlobalSnapshot(row.snapshotVersion))
    .sort((a, b) => new Date(b.derivedAt || 0) - new Date(a.derivedAt || 0));

  const n = Math.max(1, Number(keepGlobalCount) || 1);
  globals.slice(0, n).forEach((row) => keep.add(row.snapshotVersion));

  if (!keep.size && inventory.length) {
    keep.add(inventory[0].snapshotVersion);
  }

  return keep;
}

async function countRowsForSnapshots(snapshotVersions) {
  if (!snapshotVersions.length) {
    return { students: 0, exams: 0, modelRuns: 0 };
  }
  const where = { snapshotVersion: { [Op.in]: snapshotVersions } };
  const [students, exams, modelRuns] = await Promise.all([
    LjAnalyticStudent.count({ where }),
    LjAnalyticExam.count({ where }),
    AnalyticsModelRun.count({ where }),
  ]);
  return { students, exams, modelRuns };
}

/**
 * 規劃要保留／刪除的成效分析資料版本。
 * 預設只保留最新 N 個 global-* 快照；course-import、學期版等過渡版本會列入刪除。
 */
async function planSnapshotPrune(opts = {}) {
  const inventory = await listSnapshotInventory();
  const keepSet = pickSnapshotsToKeep(inventory, opts);
  const keepVersions = [...keepSet];
  const deleteVersions = inventory
    .map((row) => row.snapshotVersion)
    .filter((version) => !keepSet.has(version));

  const [keepCounts, deleteCounts] = await Promise.all([
    countRowsForSnapshots(keepVersions),
    countRowsForSnapshots(deleteVersions),
  ]);

  return {
    inventory,
    keepVersions,
    deleteVersions,
    keepCounts,
    deleteCounts,
    keepGlobalCount: Math.max(1, Number(opts.keepGlobalCount) || 1),
  };
}

async function executeSnapshotPrune(plan, { dryRun = true } = {}) {
  if (!plan?.deleteVersions?.length) {
    return {
      dryRun,
      deleted: { students: 0, exams: 0, modelRuns: 0 },
      message: '沒有可刪除的舊資料版本。',
    };
  }

  if (dryRun) {
    return {
      dryRun: true,
      deleted: plan.deleteCounts,
      message: `dry-run：將刪除 ${plan.deleteVersions.length} 個舊版本（學生摘要 ${plan.deleteCounts.students} 列）。`,
    };
  }

  const where = { snapshotVersion: { [Op.in]: plan.deleteVersions } };
  const deletedExams = await LjAnalyticExam.destroy({ where });
  const deletedStudents = await LjAnalyticStudent.destroy({ where });
  const deletedModelRuns = await AnalyticsModelRun.destroy({ where });

  return {
    dryRun: false,
    deleted: {
      students: deletedStudents,
      exams: deletedExams,
      modelRuns: deletedModelRuns,
    },
    message: `已刪除 ${plan.deleteVersions.length} 個舊資料版本。`,
  };
}

async function pruneAnalyticsSnapshots(opts = {}) {
  const plan = await planSnapshotPrune(opts);
  const result = await executeSnapshotPrune(plan, { dryRun: opts.dryRun !== false });
  return { ...plan, result };
}

module.exports = {
  listSnapshotInventory,
  pickSnapshotsToKeep,
  planSnapshotPrune,
  executeSnapshotPrune,
  pruneAnalyticsSnapshots,
  isGlobalSnapshot,
};
