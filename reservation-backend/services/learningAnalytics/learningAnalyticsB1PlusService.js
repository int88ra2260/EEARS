'use strict';

const { Op } = require('sequelize');
const {
  LjAnalyticStudent,
  LjAnalyticExam,
  Student,
  EtStudentMaster,
  CourseEnrollment,
} = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const { getCurrentSemester } = require('../../utils/semesterConstants');
const {
  buildB1PlusWatch,
  buildCourseEngagementMap,
  summarizeB1PlusWatch,
  filterByEngagement,
  filterByHasPretest,
  filterByWeakPretestSkill,
  filterByKeyword,
  optionValues,
} = require('./b1PlusWatch');
const { getFilterOptions } = require('./learningAnalyticsFilterReferenceService');
const { WORKING_SET_CAP, studentIdAllowList } = require('./workingSetIds');

const PAGE_LIMIT_DEFAULT = 40;
const PAGE_LIMIT_MAX = 100;
const EXAM_ID_CHUNK = 800;
const ENROLLMENT_ID_CHUNK = 800;

const DEFINITION = Object.freeze({
  level: 'B1+',
  band: 'approaching_b2',
  attainment: 'B2',
  gseMin: 51,
  gseMax: 58,
  rule: '還沒達 B2，但目前最佳能力的 GSE 落在 51–58（B1+ 帶，接近 B2）。有原始分就換成 GSE；學測不算。前測是第一梯有效英檢。有修課＝有選課紀錄（退選不算）；當下學期有選課列視為修課中。活動仍用分析快照累積時數。',
});

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

function textFilter(value) {
  const raw = String(value || '').trim();
  return raw || null;
}

async function loadExams(snapshotVersion, studentIds) {
  const exams = [];
  for (let i = 0; i < studentIds.length; i += EXAM_ID_CHUNK) {
    const slice = studentIds.slice(i, i + EXAM_ID_CHUNK);
    const rows = await LjAnalyticExam.findAll({
      where: {
        snapshotVersion,
        studentId: { [Op.in]: slice },
        excludeFlag: false,
        registeredNoScoreFlag: false,
        instrument: { [Op.ne]: 'GSAT' },
      },
      attributes: [
        'studentId',
        'skill',
        'cefrLevel',
        'rawScore',
        'testPhase',
        'examRound',
        'examDate',
        'instrument',
        'excludeFlag',
        'registeredNoScoreFlag',
      ],
      raw: true,
    });
    exams.push(...rows);
  }
  return exams;
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

/**
 * 從選課表判斷有修課／當學期修課中（不依賴成績、不依賴快照時數）。
 */
async function loadCourseEngagement(studentIds, currentSemester) {
  if (!studentIds.length) return new Map();
  const rows = [];
  for (let i = 0; i < studentIds.length; i += ENROLLMENT_ID_CHUNK) {
    const slice = studentIds.slice(i, i + ENROLLMENT_ID_CHUNK);
    const chunk = await CourseEnrollment.findAll({
      where: {
        studentId: { [Op.in]: slice },
        enrollmentStatus: { [Op.ne]: 'withdrawn' },
      },
      attributes: ['studentId', 'semesterId', 'enrollmentStatus'],
      raw: true,
    });
    rows.push(...chunk);
  }
  return buildCourseEngagementMap(rows, currentSemester);
}

function emptyOptions() {
  return { departments: [], colleges: [], cohorts: [] };
}

async function resolveOptions(snapshotVersion) {
  if (!snapshotVersion) return emptyOptions();
  try {
    const filterOptions = await getFilterOptions(snapshotVersion);
    return {
      departments: optionValues(filterOptions.departments),
      colleges: optionValues(filterOptions.colleges),
      cohorts: optionValues(filterOptions.cohorts),
    };
  } catch {
    return emptyOptions();
  }
}

function appliedFrom(query) {
  return {
    snapshot_version: textFilter(query.snapshot_version || query.snapshotVersion) || '',
    department: textFilter(query.department) || '',
    college: textFilter(query.college) || '',
    cohort: textFilter(query.cohort) || '',
    engagement: textFilter(query.engagement) || 'any',
    has_pretest: textFilter(query.has_pretest || query.hasPretest) || 'any',
    weak_pretest_skill: textFilter(query.weak_pretest_skill || query.weakPretestSkill) || '',
    keyword: textFilter(query.keyword) || '',
  };
}

async function getB1PlusWatch(query = {}) {
  const requestedSnapshot = textFilter(query.snapshot_version || query.snapshotVersion);
  const snapshotVersion = requestedSnapshot || await resolveLatestSnapshotVersion();
  const { limit, offset } = parsePage(query);
  const applied = appliedFrom({ ...query, snapshot_version: snapshotVersion || '' });
  const options = await resolveOptions(snapshotVersion);

  if (!snapshotVersion) {
    return {
      snapshotVersion: null,
      definition: DEFINITION,
      summary: summarizeB1PlusWatch([]),
      options,
      appliedFilters: applied,
      items: [],
      handoff: { total: 0, truncated: false, studentIds: [] },
      pagination: { limit, offset, total: 0, returned: 0 },
    };
  }

  const students = await LjAnalyticStudent.findAll({
    where: {
      snapshotVersion,
      isB2plus: false,
    },
    attributes: [
      'studentId',
      'department',
      'college',
      'cohort',
      'isB2plus',
      'totalCourseHours',
      'totalActivityHours',
    ],
    raw: true,
  });
  const studentIds = students.map((row) => row.studentId);
  const currentSemester = getCurrentSemester();
  const [exams, courseEngagement] = await Promise.all([
    loadExams(snapshotVersion, studentIds),
    loadCourseEngagement(studentIds, currentSemester),
  ]);
  const watch = buildB1PlusWatch(students, exams, courseEngagement);
  const carried = studentIdAllowList(query.student_ids || query.studentIds);
  const carriedSet = carried ? new Set(carried) : null;
  let scoped = carriedSet
    ? watch.filter((row) => carriedSet.has(String(row.studentId || '').trim().toUpperCase()))
    : watch;
  scoped = scoped.filter((row) => (
    (!applied.department || row.department === applied.department)
    && (!applied.college || row.college === applied.college)
    && (!applied.cohort || row.cohort === applied.cohort)
  ));
  const summary = {
    ...summarizeB1PlusWatch(scoped),
    currentSemester: currentSemester || null,
  };
  let filtered = filterByEngagement(scoped, applied.engagement);
  filtered = filterByHasPretest(filtered, applied.has_pretest);
  filtered = filterByWeakPretestSkill(filtered, applied.weak_pretest_skill);

  // 關鍵字若要比對姓名，只對目前篩完的名單查名（人數通常遠小於全校）
  let namesForFilter = null;
  if (applied.keyword) {
    namesForFilter = await loadNames(filtered.map((row) => row.studentId));
    filtered = filterByKeyword(
      filtered.map((row) => ({
        ...row,
        studentName: namesForFilter.get(String(row.studentId).toUpperCase()) || null,
      })),
      applied.keyword,
    );
  }

  const page = filtered.slice(offset, offset + limit);
  const names = namesForFilter || await loadNames(page.map((row) => row.studentId));
  const handoffIds = filtered.slice(0, WORKING_SET_CAP).map((row) => row.studentId);

  return {
    snapshotVersion,
    definition: DEFINITION,
    summary,
    options,
    appliedFilters: applied,
    items: page.map((row) => ({
      ...row,
      studentName: names.get(String(row.studentId).toUpperCase()) || row.studentName || null,
    })),
    handoff: {
      total: filtered.length,
      truncated: filtered.length > handoffIds.length,
      studentIds: handoffIds,
    },
    pagination: {
      limit,
      offset,
      total: filtered.length,
      returned: page.length,
    },
  };
}

module.exports = {
  getB1PlusWatch,
};
