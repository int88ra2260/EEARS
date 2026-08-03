'use strict';

const { Op } = require('sequelize');
const sequelize = require('../../db');
const { LearningAnalyticsFilterReference, Semester } = require('../../models');

const REF_TYPES = Object.freeze(['semester', 'cohort', 'college', 'department']);
const DISTINCT_FIELDS = Object.freeze({
  cohort: 'cohort',
  college: 'college',
  department: 'department',
});

const FALLBACK_SEMESTERS = ['115-2', '115-1', '114-2', '114-1', '113-2', '113-1'];

function normalizeValue(value) {
  return String(value || '').trim();
}

function mergeOptionLists(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const item of list || []) {
      const value = normalizeValue(typeof item === 'string' ? item : item.value);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      const label = typeof item === 'object' && item.label ? item.label : value;
      out.push({ value, label });
    }
  }
  return out;
}

async function distinctFromAnalytics(field, snapshotVersion) {
  if (!field || !snapshotVersion) return [];
  try {
    const [rows] = await sequelize.query(
      `SELECT DISTINCT \`${field}\` AS value
       FROM lj_analytic_students
       WHERE snapshot_version = :snapshotVersion
         AND \`${field}\` IS NOT NULL AND \`${field}\` <> ''
       ORDER BY \`${field}\` ASC
       LIMIT 500`,
      { replacements: { snapshotVersion } }
    );
    return rows.map((row) => normalizeValue(row.value)).filter(Boolean);
  } catch {
    return [];
  }
}

async function listConfiguredReferences(refType) {
  try {
    const rows = await LearningAnalyticsFilterReference.findAll({
      where: { refType, isActive: true },
      order: [['sortOrder', 'ASC'], ['value', 'ASC']],
    });
    return rows.map((row) => ({
      value: row.value,
      label: row.label || row.value,
      source: 'configured',
    }));
  } catch (error) {
    const code = error?.original?.code || error?.parent?.code;
    if (code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(error.message || '')) return [];
    throw error;
  }
}

async function listSemesterOptions() {
  const configured = await listConfiguredReferences('semester');
  let dbSemesters = [];
  try {
    const rows = await Semester.findAll({ order: [['startDate', 'DESC']], limit: 30 });
    dbSemesters = rows.map((row) => ({
      value: row.code,
      label: row.name || `${row.code}學期`,
      source: 'semester_table',
    }));
  } catch {
    dbSemesters = [];
  }
  const fallback = FALLBACK_SEMESTERS.map((code) => ({
    value: code,
    label: `${code}學期`,
    source: 'fallback',
  }));
  return mergeOptionLists(configured, dbSemesters, fallback);
}

async function getFilterOptions(snapshotVersion) {
  const [semesters, cohortConfigured, collegeConfigured, departmentConfigured] = await Promise.all([
    listSemesterOptions(),
    listConfiguredReferences('cohort'),
    listConfiguredReferences('college'),
    listConfiguredReferences('department'),
  ]);

  const [cohortDistinct, collegeDistinct, departmentDistinct] = snapshotVersion
    ? await Promise.all([
      distinctFromAnalytics(DISTINCT_FIELDS.cohort, snapshotVersion),
      distinctFromAnalytics(DISTINCT_FIELDS.college, snapshotVersion),
      distinctFromAnalytics(DISTINCT_FIELDS.department, snapshotVersion),
    ])
    : [[], [], []];

  return {
    semesters,
    cohorts: mergeOptionLists(
      cohortConfigured,
      cohortDistinct.map((value) => ({ value, label: value, source: 'analytics' }))
    ),
    colleges: mergeOptionLists(
      collegeConfigured,
      collegeDistinct.map((value) => ({ value, label: value, source: 'analytics' }))
    ),
    departments: mergeOptionLists(
      departmentConfigured,
      departmentDistinct.map((value) => ({ value, label: value, source: 'analytics' }))
    ),
    notes: {
      cohort: '選項來自分析資料中的入學年度，以及模組設定中手動新增的項目。',
      college: '選項來自分析資料中的學院，以及模組設定中手動新增的項目。',
      department: '選項來自分析資料中的系所，以及模組設定中手動新增的項目。',
      semester: '選項來自系統學期、模組設定與內建清單；若下拉沒有目標學期，請至模組設定新增。',
    },
  };
}

async function listFilterReferencesAdmin() {
  try {
    const rows = await LearningAnalyticsFilterReference.findAll({
      order: [['refType', 'ASC'], ['sortOrder', 'ASC'], ['value', 'ASC']],
    });
    return REF_TYPES.reduce((acc, refType) => {
      acc[refType] = rows
        .filter((row) => row.refType === refType)
        .map((row) => row.toJSON());
      return acc;
    }, {});
  } catch (error) {
    const code = error?.original?.code || error?.parent?.code;
    if (code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(error.message || '')) {
      return REF_TYPES.reduce((acc, refType) => { acc[refType] = []; return acc; }, {});
    }
    throw error;
  }
}

async function replaceFilterReferences(refType, items = [], { user } = {}) {
  const type = normalizeValue(refType).toLowerCase();
  if (!REF_TYPES.includes(type)) {
    throw new Error(`不支援的參照類型：${refType}`);
  }
  const createdBy = user?.username || user?.account || user?.email || String(user?.id || '');
  const cleaned = items
    .map((item, index) => {
      const value = normalizeValue(item.value);
      if (!value) return null;
      return {
        refType: type,
        value,
        label: normalizeValue(item.label) || null,
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
        isActive: item.isActive !== false,
        createdBy,
      };
    })
    .filter(Boolean);

  const seen = new Set();
  for (const row of cleaned) {
    if (seen.has(row.value)) throw new Error(`重複的 ${type} 值：${row.value}`);
    seen.add(row.value);
  }

  await sequelize.transaction(async (transaction) => {
    await LearningAnalyticsFilterReference.destroy({
      where: { refType: type },
      transaction,
    });
    if (cleaned.length) {
      await LearningAnalyticsFilterReference.bulkCreate(cleaned, { transaction });
    }
  });

  return listFilterReferencesAdmin();
}

module.exports = {
  REF_TYPES,
  getFilterOptions,
  listFilterReferencesAdmin,
  replaceFilterReferences,
};
