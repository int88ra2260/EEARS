'use strict';

const { Op, fn, col } = require('sequelize');
const {
  LjAnalyticStudent,
  LjAnalyticExam,
  LjStudentEvent,
  Student,
  EtStudentMaster,
  sequelize,
} = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const { EVENT_TYPES, EVENT_STATUS } = require('../../constants/learningJourneyEventConstants');

const PAGE_LIMIT_DEFAULT = 40;
const PAGE_LIMIT_MAX = 100;
const EXPORT_ROW_LIMIT = 5000;
const KEYWORD_ID_LIMIT = 800;

/** 入學英文分級。學測成績只是這套分級的依據，不是英檢前測。 */
const PLACEMENT_LEVELS = Object.freeze(['初級', '中級', '中高級', '高級']);

const COURSE_TYPE_OPTIONS = Object.freeze([
  { value: 'GE', label: '通識英文（GE）' },
  { value: 'EAP', label: '學術英文（EAP）' },
  { value: 'ESP', label: '專業英文（ESP）' },
]);

/** 第一梯有效英檢（含只有一次檢定）。學測不在此列。 */
const PRE_TEST_PHASES = Object.freeze(['pre_test', 'single']);
const POST_TEST_PHASES = Object.freeze(['post_test']);

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

function matchPlacementLabel(text) {
  const value = String(text || '');
  if (!value) return null;
  if (value.includes('中高級')) return '中高級';
  if (value.includes('初級')) return '初級';
  if (value.includes('中級')) return '中級';
  if (value.includes('高級')) return '高級';
  return null;
}

function normalizeCourseType(value) {
  const key = String(value || '').trim().toUpperCase();
  return COURSE_TYPE_OPTIONS.some((option) => option.value === key) ? key : null;
}

function studentIdSubquery(sql) {
  return { studentId: { [Op.in]: sequelize.literal(`(${sql})`) } };
}

function studentIdNotSubquery(sql) {
  return { studentId: { [Op.notIn]: sequelize.literal(`(${sql})`) } };
}

function placementStudentSubquery(label) {
  const placement = matchPlacementLabel(label);
  if (!PLACEMENT_LEVELS.includes(placement)) return null;
  let subtitleSql = `subtitle LIKE '%${placement}%'`;
  if (placement === '中級' || placement === '高級') {
    subtitleSql = `(subtitle LIKE '%${placement}%' AND subtitle NOT LIKE '%中高級%')`;
  }
  return `SELECT DISTINCT student_id FROM lj_student_events
    WHERE event_type = 'baseline_score'
      AND exclude_flag = 0
      AND status = 'valid'
      AND (
        JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.englishPlacementLabel')) = '${placement}'
        OR ${subtitleSql}
      )`;
}

function courseTypeStudentSubquery(courseType) {
  const type = normalizeCourseType(courseType);
  if (!type) return null;
  return `SELECT DISTINCT student_id FROM lj_student_events
    WHERE event_type = 'course_event'
      AND exclude_flag = 0
      AND status = 'valid'
      AND (
        UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.resourceType'))) = '${type}'
        OR UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.courseType'))) = '${type}'
        OR UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.courseType'))) LIKE '${type}%'
        OR UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(raw_payload, '$.courseCode')), '')) LIKE '${type}%'
      )`;
}

function examPhaseSubquery(snapshotVersion, phases) {
  const snap = sequelize.escape(snapshotVersion);
  const list = phases.map((phase) => sequelize.escape(phase)).join(', ');
  return `SELECT DISTINCT student_id FROM lj_analytic_exams
    WHERE snapshot_version = ${snap}
      AND exclude_flag = 0
      AND registered_no_score_flag = 0
      AND UPPER(instrument) <> 'GSAT'
      AND test_phase IN (${list})`;
}

function buildWhere(query, snapshotVersion, keywordIds) {
  const where = { snapshotVersion };
  const and = [];
  if (keywordIds) {
    and.push({ studentId: { [Op.in]: keywordIds.length ? keywordIds : ['__none__'] } });
  }
  if (query.department) where.department = String(query.department);
  if (query.cohort) where.cohort = String(query.cohort);
  const minHours = parseOptionalNumber(query.min_activity_hours ?? query.minActivityHours);
  if (minHours != null) where.totalActivityHours = { [Op.gte]: minHours };
  const minCourseHours = parseOptionalNumber(query.min_course_hours ?? query.minCourseHours);
  if (minCourseHours != null) where.totalCourseHours = { [Op.gte]: minCourseHours };
  const hasExam = parseBool(query.has_valid_exam ?? query.hasValidExam);
  if (hasExam !== undefined) where.hasValidExam = hasExam;

  const placementSql = placementStudentSubquery(query.placement);
  if (placementSql) and.push(studentIdSubquery(placementSql));

  const courseSql = courseTypeStudentSubquery(query.course_type ?? query.courseType);
  if (courseSql) and.push(studentIdSubquery(courseSql));

  const hasPre = parseBool(query.has_pre_test ?? query.hasPreTest);
  if (hasPre === true) and.push(studentIdSubquery(examPhaseSubquery(snapshotVersion, PRE_TEST_PHASES)));
  if (hasPre === false) and.push(studentIdNotSubquery(examPhaseSubquery(snapshotVersion, PRE_TEST_PHASES)));

  const hasPost = parseBool(query.has_post_test ?? query.hasPostTest);
  if (hasPost === true) and.push(studentIdSubquery(examPhaseSubquery(snapshotVersion, POST_TEST_PHASES)));
  if (hasPost === false) and.push(studentIdNotSubquery(examPhaseSubquery(snapshotVersion, POST_TEST_PHASES)));

  if (and.length) where[Op.and] = and;
  return where;
}

function appliedFiltersFromQuery(query = {}) {
  const hasExam = parseBool(query.has_valid_exam ?? query.hasValidExam);
  const hasPre = parseBool(query.has_pre_test ?? query.hasPreTest);
  const hasPost = parseBool(query.has_post_test ?? query.hasPostTest);
  return {
    keyword: String(query.keyword || '').trim(),
    department: query.department ? String(query.department) : '',
    cohort: query.cohort ? String(query.cohort) : '',
    placement: matchPlacementLabel(query.placement) || '',
    hasValidExam: hasExam === undefined ? null : hasExam,
    hasPreTest: hasPre === undefined ? null : hasPre,
    hasPostTest: hasPost === undefined ? null : hasPost,
    minActivityHours: parseOptionalNumber(query.min_activity_hours ?? query.minActivityHours),
    courseType: normalizeCourseType(query.course_type ?? query.courseType) || '',
    minCourseHours: parseOptionalNumber(query.min_course_hours ?? query.minCourseHours),
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
    placements: [...PLACEMENT_LEVELS],
    courseTypes: COURSE_TYPE_OPTIONS.map((option) => ({ ...option })),
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

function readPlacementLabel(row) {
  const payload = row?.rawPayload && typeof row.rawPayload === 'object' ? row.rawPayload : {};
  return matchPlacementLabel(payload.englishPlacementLabel)
    || matchPlacementLabel(row?.subtitle)
    || matchPlacementLabel(row?.baselineLevel)
    || null;
}

async function loadPlacementLabels(studentIds) {
  if (!studentIds.length) return new Map();
  const rows = await LjStudentEvent.findAll({
    where: {
      studentId: { [Op.in]: studentIds },
      eventType: EVENT_TYPES.BASELINE,
      excludeFlag: false,
      status: EVENT_STATUS.VALID,
    },
    attributes: ['studentId', 'subtitle', 'rawPayload'],
    order: [['id', 'DESC']],
  });
  const labels = new Map();
  for (const row of rows) {
    const id = String(row.studentId || '').trim().toUpperCase();
    if (!id || labels.has(id)) continue;
    const label = readPlacementLabel(row);
    if (label) labels.set(id, label);
  }
  return labels;
}

async function loadExamPhases(snapshotVersion, studentIds) {
  const phases = new Map();
  if (!studentIds.length) return phases;
  const rows = await LjAnalyticExam.findAll({
    where: {
      snapshotVersion,
      studentId: { [Op.in]: studentIds },
      excludeFlag: false,
      registeredNoScoreFlag: false,
      instrument: { [Op.ne]: 'GSAT' },
      testPhase: { [Op.in]: [...PRE_TEST_PHASES, ...POST_TEST_PHASES] },
    },
    attributes: ['studentId', 'testPhase', 'instrument'],
    raw: true,
  });
  for (const row of rows) {
    if (String(row.instrument || '').toUpperCase() === 'GSAT') continue;
    const id = String(row.studentId || '').trim().toUpperCase();
    if (!id) continue;
    const current = phases.get(id) || { hasPreTest: false, hasPostTest: false };
    if (PRE_TEST_PHASES.includes(row.testPhase)) current.hasPreTest = true;
    if (POST_TEST_PHASES.includes(row.testPhase)) current.hasPostTest = true;
    phases.set(id, current);
  }
  return phases;
}

function mapItem(row, names, placements, phases) {
  const studentId = String(row.studentId || '');
  const key = studentId.toUpperCase();
  const phase = phases.get(key) || { hasPreTest: false, hasPostTest: false };
  return {
    studentId,
    studentName: names.get(key) || null,
    department: row.department || null,
    college: row.college || null,
    cohort: row.cohort || null,
    enrollmentTerm: row.enrollmentTerm || null,
    placementLabel: placements.get(key) || null,
    baselineEnglishScore: numOrNull(row.baselineEnglishScore),
    baselineCefr: row.baselineCefr || null,
    totalActivityHours: round1(row.totalActivityHours),
    totalCourseHours: round1(row.totalCourseHours),
    hasValidExam: !!row.hasValidExam,
    hasPreTest: phase.hasPreTest,
    hasPostTest: phase.hasPostTest,
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
        'totalCourseHours',
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
  const studentIds = rows.map((row) => row.studentId);
  const [placements, phases] = await Promise.all([
    loadPlacementLabels(studentIds),
    loadExamPhases(snapshotVersion, studentIds),
  ]);

  return {
    snapshotVersion,
    summary: {
      matched,
      withValidExam,
      averageActivityHours: matched > 0 ? round1(avgRow?.avgHours) : null,
    },
    options: {
      ...options,
      exportRowLimit: EXPORT_ROW_LIMIT,
    },
    appliedFilters,
    items: rows.map((row) => mapItem(row, names, placements, phases)),
    pagination: {
      limit,
      offset,
      total: matched,
      returned: rows.length,
    },
  };
}

const EXPLORER_ROW_ATTRIBUTES = [
  'studentId',
  'department',
  'college',
  'cohort',
  'enrollmentTerm',
  'baselineEnglishScore',
  'baselineCefr',
  'totalActivityHours',
  'totalCourseHours',
  'hasValidExam',
  'retestFlag',
  'isB2plus',
];

async function listStudentExplorerForExport(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const appliedFilters = appliedFiltersFromQuery(query);
  const keywordIds = await findKeywordStudentIds(appliedFilters.keyword);
  const where = buildWhere(query, snapshotVersion, keywordIds);
  const total = await LjAnalyticStudent.count({ where });
  const rows = await LjAnalyticStudent.findAll({
    where,
    attributes: EXPLORER_ROW_ATTRIBUTES,
    order: [['studentId', 'ASC']],
    limit: EXPORT_ROW_LIMIT,
    raw: true,
  });
  const studentIds = rows.map((row) => row.studentId);
  const [names, placements, phases] = await Promise.all([
    loadNames(studentIds),
    loadPlacementLabels(studentIds),
    loadExamPhases(snapshotVersion, studentIds),
  ]);

  return {
    snapshotVersion,
    appliedFilters,
    total,
    truncated: total > rows.length,
    maxRows: EXPORT_ROW_LIMIT,
    items: rows.map((row) => mapItem(row, names, placements, phases)),
  };
}

async function loadCurrentMetricsForStudents(studentIds = []) {
  const snapshotVersion = await resolveLatestSnapshotVersion();
  const ids = [...new Set(studentIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return { snapshotVersion, byId: new Map() };
  const rows = await LjAnalyticStudent.findAll({
    where: {
      snapshotVersion,
      studentId: { [Op.in]: ids },
    },
    attributes: EXPLORER_ROW_ATTRIBUTES,
    raw: true,
  });
  const foundIds = rows.map((row) => row.studentId);
  const [names, placements, phases] = await Promise.all([
    loadNames(foundIds),
    loadPlacementLabels(foundIds),
    loadExamPhases(snapshotVersion, foundIds),
  ]);
  const byId = new Map();
  for (const row of rows) {
    const item = mapItem(row, names, placements, phases);
    byId.set(String(item.studentId).toUpperCase(), item);
  }
  return { snapshotVersion, byId };
}

module.exports = {
  getStudentExplorer,
  listStudentExplorerForExport,
  loadCurrentMetricsForStudents,
  EXPORT_ROW_LIMIT,
  matchPlacementLabel,
  PLACEMENT_LEVELS,
  COURSE_TYPE_OPTIONS,
  placementStudentSubquery,
  courseTypeStudentSubquery,
  examPhaseSubquery,
};
