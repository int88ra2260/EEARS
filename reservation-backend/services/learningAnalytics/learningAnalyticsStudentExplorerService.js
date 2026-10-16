'use strict';

const { Op, fn, col } = require('sequelize');
const { LjAnalyticStudent, Student, EtStudentMaster } = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');

const PAGE_LIMIT_DEFAULT = 40;
const PAGE_LIMIT_MAX = 100;
const KEYWORD_ID_LIMIT = 800;

/** 畫面可顯示、但快照尚不能拿來縮小名單的條件。 */
const UNAVAILABLE_FILTERS = Object.freeze([
  {
    id: 'placement',
    label: '起始分級',
    reason: '分析快照只有 CEFR（baselineCefr），沒有初級／中級／中高級／高級這套分級。',
  },
  {
    id: 'eap_esp',
    label: 'EAP／ESP 修課',
    reason: '修課類型在修課紀錄裡，學生快照沒有「已修畢 EAP／ESP」旗標。',
  },
  {
    id: 'exam_pairing',
    label: '英檢配對',
    reason: '快照只有是否重測，不能判斷「有前測、尚無後測」，也不能判斷指定技能是否進步。',
  },
]);

function parseOptionalNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseBool(value) {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

function parsePage(query = {}) {
  const limitRaw = Number(query.limit);
  const offsetRaw = Number(query.offset);
  const limit = Math.min(
    PAGE_LIMIT_MAX,
    Math.max(1, Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : PAGE_LIMIT_DEFAULT),
  );
  const offset = Math.max(0, Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0);
  return { limit, offset };
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(value) {
  const n = numOrNull(value);
  if (n == null) return null;
  return Math.round(n * 10) / 10;
}

function addId(set, value) {
  const raw = String(value || '').trim();
  if (!raw) return;
  set.add(raw);
  set.add(raw.toUpperCase());
}

async function findKeywordStudentIds(keyword) {
  const raw = String(keyword || '').trim();
  if (!raw) return null;
  const like = `%${raw.replace(/[\\%_]/g, '')}%`;
  const [roster, masters] = await Promise.all([
    Student.findAll({
      where: {
        [Op.or]: [
          { studentId: { [Op.like]: like } },
          { nameZh: { [Op.like]: like } },
        ],
      },
      attributes: ['studentId'],
      limit: KEYWORD_ID_LIMIT,
    }),
    EtStudentMaster.findAll({
      where: {
        [Op.or]: [
          { studentId: { [Op.like]: like } },
          { name: { [Op.like]: like } },
        ],
      },
      attributes: ['studentId'],
      limit: KEYWORD_ID_LIMIT,
    }),
  ]);
  const ids = new Set();
  addId(ids, raw);
  for (const row of [...roster, ...masters]) addId(ids, row.studentId);
  return [...ids];
}

function buildWhere(query, snapshotVersion, keywordIds) {
  const where = { snapshotVersion };
  if (keywordIds) where.studentId = { [Op.in]: keywordIds.length ? keywordIds : ['__none__'] };
  if (query.department) where.department = String(query.department);
  if (query.cohort) where.cohort = String(query.cohort);
  const minScore = parseOptionalNumber(query.min_baseline_score ?? query.minBaselineScore);
  if (minScore != null) where.baselineEnglishScore = { [Op.gte]: minScore };
  const minHours = parseOptionalNumber(query.min_activity_hours ?? query.minActivityHours);
  if (minHours != null) where.totalActivityHours = { [Op.gte]: minHours };
  const hasExam = parseBool(query.has_valid_exam ?? query.hasValidExam);
  if (hasExam !== undefined) where.hasValidExam = hasExam;
  return where;
}

function appliedFiltersFromQuery(query = {}) {
  const hasExam = parseBool(query.has_valid_exam ?? query.hasValidExam);
  return {
    keyword: String(query.keyword || '').trim(),
    department: query.department ? String(query.department) : '',
    cohort: query.cohort ? String(query.cohort) : '',
    minBaselineScore: parseOptionalNumber(query.min_baseline_score ?? query.minBaselineScore),
    minActivityHours: parseOptionalNumber(query.min_activity_hours ?? query.minActivityHours),
    hasValidExam: hasExam === undefined ? null : hasExam,
  };
}

async function loadFilterOptions(snapshotVersion) {
  const rows = await LjAnalyticStudent.findAll({
    where: { snapshotVersion },
    attributes: ['department', 'cohort'],
    raw: true,
  });
  const departments = new Set();
  const cohorts = new Set();
  for (const row of rows) {
    if (row.department) departments.add(String(row.department));
    if (row.cohort) cohorts.add(String(row.cohort));
  }
  return {
    departments: [...departments].sort((a, b) => a.localeCompare(b, 'zh-Hant')),
    cohorts: [...cohorts].sort((a, b) => a.localeCompare(b, 'zh-Hant')),
  };
}

async function loadNames(studentIds) {
  if (!studentIds.length) return new Map();
  const [roster, masters] = await Promise.all([
    Student.findAll({
      where: { studentId: { [Op.in]: studentIds } },
      attributes: ['studentId', 'nameZh'],
    }),
    EtStudentMaster.findAll({
      where: { studentId: { [Op.in]: studentIds } },
      attributes: ['studentId', 'name'],
    }),
  ]);
  const names = new Map();
  for (const row of masters) {
    const id = String(row.studentId || '').trim().toUpperCase();
    if (id && row.name) names.set(id, row.name);
  }
  for (const row of roster) {
    const id = String(row.studentId || '').trim().toUpperCase();
    if (id && row.nameZh) names.set(id, row.nameZh);
  }
  return names;
}

function mapItem(row, names) {
  const studentId = String(row.studentId || '');
  return {
    studentId,
    studentName: names.get(studentId.toUpperCase()) || null,
    department: row.department || null,
    college: row.college || null,
    cohort: row.cohort || null,
    enrollmentTerm: row.enrollmentTerm || null,
    baselineEnglishScore: numOrNull(row.baselineEnglishScore),
    baselineCefr: row.baselineCefr || null,
    totalActivityHours: round1(row.totalActivityHours),
    hasValidExam: !!row.hasValidExam,
    retestFlag: !!row.retestFlag,
    isB2plus: !!row.isB2plus,
  };
}

async function getStudentExplorer(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const { limit, offset } = parsePage(query);
  const appliedFilters = appliedFiltersFromQuery(query);
  const keywordIds = await findKeywordStudentIds(appliedFilters.keyword);
  const where = buildWhere(query, snapshotVersion, keywordIds);

  const [options, matched, withValidExam, avgRow, rows] = await Promise.all([
    loadFilterOptions(snapshotVersion),
    LjAnalyticStudent.count({ where }),
    LjAnalyticStudent.count({ where: { ...where, hasValidExam: true } }),
    LjAnalyticStudent.findOne({
      where,
      attributes: [[fn('AVG', col('total_activity_hours')), 'avgHours']],
      raw: true,
    }),
    LjAnalyticStudent.findAll({
      where,
      attributes: [
        'studentId',
        'department',
        'college',
        'cohort',
        'enrollmentTerm',
        'baselineEnglishScore',
        'baselineCefr',
        'totalActivityHours',
        'hasValidExam',
        'retestFlag',
        'isB2plus',
      ],
      order: [['studentId', 'ASC']],
      limit,
      offset,
      raw: true,
    }),
  ]);

  const names = await loadNames(rows.map((row) => row.studentId));

  return {
    snapshotVersion,
    summary: {
      matched,
      withValidExam,
      averageActivityHours: matched > 0 ? round1(avgRow?.avgHours) : null,
    },
    options,
    appliedFilters,
    unavailableFilters: UNAVAILABLE_FILTERS,
    items: rows.map((row) => mapItem(row, names)),
    pagination: {
      limit,
      offset,
      total: matched,
      returned: rows.length,
    },
  };
}

module.exports = {
  getStudentExplorer,
  UNAVAILABLE_FILTERS,
};
