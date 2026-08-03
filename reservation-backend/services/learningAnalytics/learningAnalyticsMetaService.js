'use strict';

const { Op } = require('sequelize');
const sequelize = require('../../db');
const { LjAnalyticStudent, LjAnalyticExam } = require('../../models');
const { getFilterOptions } = require('./learningAnalyticsFilterReferenceService');
const { ensureLvaConfigLoaded, getLvaConfig } = require('./learningAnalyticsLvaConfigService');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');

const LJ_TABLES = [
  'lj_student_events',
  'lj_analytic_students',
  'lj_analytic_exams',
  'analytics_model_runs',
  'learning_growth_episodes',
  'resource_effect_estimates',
  'student_resource_exposures',
];

async function countTable(tableName) {
  try {
    const [[row]] = await sequelize.query(`SELECT COUNT(*) AS c FROM \`${tableName}\``);
    return Number(row.c);
  } catch {
    return null;
  }
}

async function listSnapshotVersions() {
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
  }));
}

async function countAnalyticRowsForSnapshot(snapshotVersion) {
  if (!snapshotVersion) return { students: 0, exams: 0 };
  const where = { snapshotVersion };
  const [students, exams] = await Promise.all([
    LjAnalyticStudent.count({ where }),
    LjAnalyticExam.count({ where }),
  ]);
  return { students, exams };
}

function summarizeSnapshotLabel(snapshotVersion) {
  const raw = String(snapshotVersion || '');
  if (raw.startsWith('global-')) return `全域分析（${raw.split('|')[0]}）`;
  if (raw.startsWith('course-import-')) return `課程匯入批次（${raw.split('|')[0]}）`;
  return raw.split('|')[0] || raw;
}

function pickRecommendedSnapshot(snapshots) {
  if (!snapshots.length) return null;
  const globals = snapshots
    .filter((s) => String(s.snapshotVersion).startsWith('global-'))
    .sort((a, b) => new Date(b.derivedAt || 0) - new Date(a.derivedAt || 0));
  if (globals.length) return globals[0].snapshotVersion;
  const sorted = [...snapshots].sort((a, b) => new Date(b.derivedAt || 0) - new Date(a.derivedAt || 0));
  return sorted[0]?.snapshotVersion || null;
}

/**
 * 學習成效分析模組：資料健康與可用 snapshot 中繼資料
 */
async function getLearningAnalyticsMeta() {
  const [tableCounts, snapshots, latestDerived] = await Promise.all([
    Promise.all(LJ_TABLES.map(async (table) => [table, await countTable(table)])).then(Object.fromEntries),
    listSnapshotVersions(),
    resolveLatestSnapshotVersion(),
  ]);

  const recommendedSnapshotVersion = pickRecommendedSnapshot(snapshots);
  const recommendedCounts = await countAnalyticRowsForSnapshot(recommendedSnapshotVersion);
  const recommendedRow = snapshots.find((s) => s.snapshotVersion === recommendedSnapshotVersion);
  const filterOptions = await getFilterOptions(recommendedSnapshotVersion);
  await ensureLvaConfigLoaded();
  const matchingCaliperDefault = getLvaConfig().matchingCaliper;

  const analyticStudents = tableCounts.lj_analytic_students || 0;
  const analyticExams = tableCounts.lj_analytic_exams || 0;
  const studentEvents = tableCounts.lj_student_events || 0;
  const snapshotVersionCount = snapshots.length;

  let eventTypeCounts = {};
  try {
    const [rows] = await sequelize.query(
      'SELECT event_type AS eventType, COUNT(*) AS c FROM lj_student_events GROUP BY event_type'
    );
    eventTypeCounts = Object.fromEntries(rows.map((r) => [r.eventType, Number(r.c)]));
  } catch {
    eventTypeCounts = {};
  }

  const warnings = [];
  if (!analyticStudents) {
    warnings.push('尚無分析摘要資料，請至「學習歷程維運」執行「背景重建（全部）」。');
  }
  if ((eventTypeCounts.activity_event || 0) < 50) {
    warnings.push('活動事件筆數偏少；請執行全域重建後再檢視資源效益。');
  }
  if (snapshotVersionCount > 1) {
    warnings.push(
      `偵測到 ${snapshotVersionCount} 個資料版本；圖表請選「資料版本」中的最新全域分析。`
      + ' 舊版（課程匯入、學期重建等）可至「學習歷程維運」清理，避免人數統計混淆。'
    );
  }
  if (recommendedSnapshotVersion && latestDerived !== recommendedSnapshotVersion) {
    warnings.push('系統預設最新版本與建議使用的全域分析版本不同，請在篩選器確認「資料版本」。');
  }
  if (snapshotVersionCount > 1 && recommendedCounts.students > 0 && analyticStudents > recommendedCounts.students) {
    warnings.push(
      `資料庫共有 ${analyticStudents} 筆分析摘要列（含舊版本重複）；`
      + ` 建議版本約 ${recommendedCounts.students} 位學生。`
    );
  }

  return {
    hasAnalyticData: analyticStudents > 0,
    recommendedSnapshotVersion,
    latestSnapshotVersion: latestDerived,
    snapshotVersionCount,
    recommendedSnapshot: {
      version: recommendedSnapshotVersion,
      label: recommendedRow?.label || summarizeSnapshotLabel(recommendedSnapshotVersion),
      studentCount: recommendedCounts.students,
      examCount: recommendedCounts.exams,
      derivedAt: recommendedRow?.derivedAt || null,
    },
    snapshots,
    filterOptions,
    matchingCaliperDefault,
    tableCounts,
    eventTypeCounts,
    warnings,
    rebuildHint: 'npm run lj:rebuild-analytics -- --scope=global',
    pruneHint: 'npm run lj:prune-analytics-snapshots:dry',
  };
}

module.exports = {
  getLearningAnalyticsMeta,
  pickRecommendedSnapshot,
  summarizeSnapshotLabel,
  countAnalyticRowsForSnapshot,
};
