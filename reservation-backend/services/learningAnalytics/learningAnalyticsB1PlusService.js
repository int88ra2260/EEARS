'use strict';

const { Op } = require('sequelize');
const {
  LjAnalyticStudent,
  LjAnalyticExam,
  Student,
  EtStudentMaster,
  CourseEnrollment,
  LjStudentEvent,
  Course,
} = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const { parseCohortList } = require('./learningAnalyticsFilterUtils');
const { getCurrentSemester } = require('../../utils/semesterConstants');
const {
  buildB1PlusWatch,
  buildCourseEngagementMap,
  summarizeB1PlusWatch,
  filterByEngagement,
  filterByHasPretest,
  filterByWeakPretestSkill,
  filterByKeyword,
  sortB1PlusItems,
  shapeCourseList,
  shapeActivityList,
  shapeB1PlusStudentDetail,
  optionValues,
} = require('./b1PlusWatch');
const { getFilterOptions } = require('./learningAnalyticsFilterReferenceService');
const { studentIdAllowList } = require('./workingSetIds');

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

/**
 * 每位學生修過的課（課名、學期、是否修課中）。不含時數。
 * @returns {Promise<Map<string, { semesterId: string, courseName: string, inProgress: boolean }[]>>}
 */
async function loadStudentCourses(studentIds, currentSemester) {
  const ids = [...new Set((studentIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return new Map();
  const enrollments = [];
  for (let i = 0; i < ids.length; i += ENROLLMENT_ID_CHUNK) {
    const slice = ids.slice(i, i + ENROLLMENT_ID_CHUNK);
    const chunk = await CourseEnrollment.findAll({
      where: {
        studentId: { [Op.in]: slice },
        enrollmentStatus: { [Op.ne]: 'withdrawn' },
      },
      attributes: ['studentId', 'courseId', 'semesterId'],
      raw: true,
    });
    enrollments.push(...chunk);
  }
  const courseIds = [...new Set(enrollments.map((row) => row.courseId).filter((id) => id != null))];
  const courseRows = [];
  for (let i = 0; i < courseIds.length; i += ENROLLMENT_ID_CHUNK) {
    const slice = courseIds.slice(i, i + ENROLLMENT_ID_CHUNK);
    const chunk = await Course.findAll({
      where: { id: { [Op.in]: slice } },
      attributes: ['id', 'courseName'],
      raw: true,
    });
    courseRows.push(...chunk);
  }
  const courseNames = new Map(courseRows.map((row) => [row.id, row.courseName]));
  const grouped = new Map();
  for (const row of enrollments) {
    const id = String(row.studentId || '').trim().toUpperCase();
    if (!id) continue;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push({
      semesterId: row.semesterId,
      courseName: courseNames.get(row.courseId) || '',
    });
  }
  const shaped = new Map();
  for (const [id, rows] of grouped) {
    shaped.set(id, shapeCourseList(rows, currentSemester));
  }
  return shaped;
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
  const dir = String(query.dir || query.sortDir || 'desc').trim().toLowerCase();
  return {
    snapshot_version: textFilter(query.snapshot_version || query.snapshotVersion) || '',
    department: textFilter(query.department) || '',
    college: textFilter(query.college) || '',
    cohort: textFilter(query.cohort) || '',
    engagement: textFilter(query.engagement) || 'any',
    has_pretest: textFilter(query.has_pretest || query.hasPretest) || 'any',
    weak_pretest_skill: textFilter(query.weak_pretest_skill || query.weakPretestSkill) || '',
    keyword: textFilter(query.keyword) || '',
    sort: textFilter(query.sort || query.sortKey) || 'bestGse',
    dir: dir === 'asc' ? 'asc' : 'desc',
  };
}

async function loadFilteredB1Plus(query = {}) {
  const requestedSnapshot = textFilter(query.snapshot_version || query.snapshotVersion);
  const snapshotVersion = requestedSnapshot || await resolveLatestSnapshotVersion();
  const applied = appliedFrom({ ...query, snapshot_version: snapshotVersion || '' });
  const options = await resolveOptions(snapshotVersion);
  if (!snapshotVersion) {
    return {
      snapshotVersion: null,
      applied,
      options,
      summary: { ...summarizeB1PlusWatch([]), currentSemester: getCurrentSemester() || null },
      rows: [],
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
      'lastExamDate',
      'postExamCourseHours',
      'postExamActivityHours',
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
  const cohorts = parseCohortList(applied.cohort);
  scoped = scoped.filter((row) => (
    (!applied.department || row.department === applied.department)
    && (!applied.college || row.college === applied.college)
    && (!cohorts.length || cohorts.includes(String(row.cohort || '')))
  ));
  const summary = {
    ...summarizeB1PlusWatch(scoped),
    currentSemester: currentSemester || null,
  };
  let filtered = filterByEngagement(scoped, applied.engagement);
  filtered = filterByHasPretest(filtered, applied.has_pretest);
  filtered = filterByWeakPretestSkill(filtered, applied.weak_pretest_skill);
  if (applied.keyword) {
    const names = await loadNames(filtered.map((row) => row.studentId));
    filtered = filterByKeyword(
      filtered.map((row) => ({
        ...row,
        studentName: names.get(String(row.studentId).toUpperCase()) || null,
      })),
      applied.keyword,
    );
  }
  return {
    snapshotVersion,
    applied,
    options,
    summary,
    rows: sortB1PlusItems(filtered, applied.sort, applied.dir),
  };
}

async function getB1PlusWatch(query = {}) {
  const { limit, offset } = parsePage(query);
  const loaded = await loadFilteredB1Plus(query);
  if (!loaded.snapshotVersion) {
    return {
      snapshotVersion: null,
      definition: DEFINITION,
      summary: summarizeB1PlusWatch([]),
      options: loaded.options,
      appliedFilters: loaded.applied,
      items: [],
      handoff: { total: 0, truncated: false, studentIds: [] },
      pagination: { limit, offset, total: 0, returned: 0 },
    };
  }

  const page = loaded.rows.slice(offset, offset + limit);
  const needsNames = page.some((row) => !row.studentName);
  const [names, courseLists] = await Promise.all([
    needsNames ? loadNames(page.map((row) => row.studentId)) : Promise.resolve(new Map()),
    loadStudentCourses(page.map((row) => row.studentId), loaded.summary.currentSemester || ''),
  ]);
  const handoffIds = loaded.rows.map((row) => row.studentId);

  return {
    snapshotVersion: loaded.snapshotVersion,
    definition: DEFINITION,
    summary: loaded.summary,
    options: loaded.options,
    appliedFilters: loaded.applied,
    items: page.map((row) => {
      const id = String(row.studentId).toUpperCase();
      return {
        ...row,
        studentName: row.studentName || names.get(id) || null,
        courses: courseLists.get(id) || [],
      };
    }),
    handoff: {
      total: loaded.rows.length,
      truncated: false,
      studentIds: handoffIds,
    },
    pagination: {
      limit,
      offset,
      total: loaded.rows.length,
      returned: page.length,
    },
  };
}

/**
 * 接近 B2 名單的單人概略：修過的課、活動逐筆時數、考後活動。
 * @param {string} studentId
 * @param {string} [snapshotVersion]
 */
async function getPostExamEngagementDetail(studentId, snapshotVersion) {
  const version = snapshotVersion || (await resolveLatestSnapshotVersion());
  const sid = String(studentId || '').trim().toUpperCase();
  const currentSemester = getCurrentSemester() || '';
  if (!sid) {
    return shapeB1PlusStudentDetail({ currentSemester });
  }

  const student = version
    ? await LjAnalyticStudent.findOne({
      where: { snapshotVersion: version, studentId: sid },
      attributes: ['lastExamDate', 'totalActivityHours'],
      raw: true,
    })
    : null;

  const [activityEvents, courseLists] = await Promise.all([
    LjStudentEvent.findAll({
      where: {
        studentId: sid,
        eventType: 'activity_event',
        status: 'valid',
        excludeFlag: false,
      },
      attributes: ['eventDate', 'title', 'subtitle', 'hours'],
      raw: true,
    }),
    loadStudentCourses([sid], currentSemester),
  ]);

  return shapeB1PlusStudentDetail({
    lastExamDate: student?.lastExamDate || null,
    currentSemester,
    activityHours: student ? student.totalActivityHours : null,
    courses: courseLists.get(sid) || [],
    activities: shapeActivityList(activityEvents),
  });
}

module.exports = {
  getB1PlusWatch,
  getPostExamEngagementDetail,
  loadFilteredB1Plus,
  loadNames,
  loadStudentCourses,
  DEFINITION,
};
