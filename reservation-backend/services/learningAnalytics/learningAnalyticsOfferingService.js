'use strict';

const { Op } = require('sequelize');
const {
  LjAnalyticStudent,
  LjAnalyticExam,
  LjStudentEvent,
  CourseEnrollment,
  Course,
} = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const { resourceKeyForEvent, computeAdjustedGrowthEpisodes } = require('../learningJourney/analytics/lvaAnalyticsService');
const {
  buildStudentWhere,
  buildExamWhere,
  applyEvidenceQualityFilter,
} = require('./learningAnalyticsFilterUtils');
const {
  isAdmin,
  isExecutive,
  isTeacher,
  getUserLearningJourneyScope,
} = require('../learningJourney/learningJourneyAccessService');

const CONTRACT_VERSION = 'learning-analytics.offerings.v2';
const MIN_GROWTH_SAMPLE = 10;
const MAIN_SKILLS = ['listening', 'reading', 'speaking', 'writing'];

const OFFERING_DIMENSIONS = Object.freeze(['course', 'instructor', 'activity', 'resource_category']);
const INSTRUCTOR_GROUPINGS = Object.freeze(['by_semester', 'merged']);

const RESOURCE_LABELS = Object.freeze({
  GE: '通識英文',
  EAP: 'EAP',
  ESP: 'ESP',
  ENGLISH_TABLE: 'English Table',
  ENGLISH_CLUB: 'English Club',
  JOB_TALK: 'Job Talk',
  INTERNATIONAL_FORUM: 'International Forum',
  WORKSHOP: '工作坊',
  TUTOR_IN_PERSON: '實體一對一諮詢',
  TUTOR_ONLINE: '線上一對一諮詢',
  ACTIVITY_OTHER: '其他活動',
  COURSE_OTHER: '其他課程',
});

const SKILL_LABELS = Object.freeze({
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
});

const IMPROVEMENT_DEFINITIONS = Object.freeze([
  { key: 'any', label: '任一前後測有進步' },
  { key: 'allSkills', label: '所有技能都進步' },
  { key: 'avgPositive', label: '整體平均 > 0' },
]);

function buildCautions() {
  return [
    '本頁為描述性統計：參與某課程／活動的學生之前後測進步趨勢，不代表該課程或教師造成進步。',
    '同一學生若修多門課或參加多場活動，會被重複計入各細項的人數與進步率。',
    '平均原始分進步：先計算每位學生可計算前後測的平均 delta，再對群體取平均（與「資源效益」頁口徑一致）。',
    `可計算成長人數少於 ${MIN_GROWTH_SAMPLE} 人時，不顯示平均進步與進步率，以避免小樣本誤判。`,
    '「任一前後測有進步」：至少一筆前後測 delta > 0；「所有技能都進步」：每位學生有資料的所有技能皆 delta > 0；「整體平均 > 0」：該學生所有前後測 delta 的平均值 > 0。',
  ];
}

function round(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return round(nums.reduce((sum, v) => sum + v, 0) / nums.length, 2);
}

function normalizeDimension(raw) {
  const value = String(raw || 'course').trim().toLowerCase();
  return OFFERING_DIMENSIONS.includes(value) ? value : 'course';
}

function normalizeInstructorGrouping(raw) {
  const value = String(raw || 'by_semester').trim().toLowerCase();
  return INSTRUCTOR_GROUPINGS.includes(value) ? value : 'by_semester';
}

function normText(value) {
  return String(value || '').trim();
}

function normInstructor(value) {
  return normText(value) || '未標示教師';
}

function normLower(value) {
  return normText(value).toLowerCase();
}

function isImprovedDelta(delta) {
  return Number(delta) > 0;
}

function buildStudentGrowthMap(exams = []) {
  const map = new Map();
  for (const exam of exams) {
    if (!exam.retestFlag || exam.deltaRawScore == null) continue;
    const sid = String(exam.studentId || '').toUpperCase();
    if (!sid) continue;
    if (!map.has(sid)) {
      map.set(sid, {
        deltas: [],
        episodeCount: 0,
        skillDeltas: new Map(),
      });
    }
    const row = map.get(sid);
    const delta = Number(exam.deltaRawScore);
    row.deltas.push(delta);
    row.episodeCount += 1;
    const skill = normText(exam.skill) || 'unknown';
    if (!row.skillDeltas.has(skill)) row.skillDeltas.set(skill, []);
    row.skillDeltas.get(skill).push(delta);
  }
  return map;
}

function studentImprovedAny(row) {
  return row.deltas.some(isImprovedDelta);
}

function studentImprovedAllSkills(row) {
  if (!row.skillDeltas.size) return false;
  for (const deltas of row.skillDeltas.values()) {
    if (!deltas.length) return false;
    if (deltas.some((delta) => !isImprovedDelta(delta))) return false;
  }
  return true;
}

function studentImprovedAvgPositive(row) {
  const avg = mean(row.deltas);
  return avg != null && avg > 0;
}

function buildImprovementMetrics(withGrowth, growthMap, privacySuppressed) {
  const buildOne = (predicate) => {
    const studentCount = withGrowth.filter((id) => predicate(growthMap.get(id))).length;
    return {
      studentCount: privacySuppressed ? null : studentCount,
      rate: privacySuppressed || !withGrowth.length
        ? null
        : round(studentCount / withGrowth.length, 4),
    };
  };
  return {
    any: { ...buildOne(studentImprovedAny), label: IMPROVEMENT_DEFINITIONS[0].label },
    allSkills: { ...buildOne(studentImprovedAllSkills), label: IMPROVEMENT_DEFINITIONS[1].label },
    avgPositive: { ...buildOne(studentImprovedAvgPositive), label: IMPROVEMENT_DEFINITIONS[2].label },
  };
}

function buildGrowthEpisodeMap(episodes = []) {
  const map = new Map();
  for (const episode of episodes) {
    const sid = String(episode.studentId || '').toUpperCase();
    if (!sid) continue;
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid).push(episode);
  }
  return map;
}

function buildSkillBreakdown(participantIds, growthMap, growthEpisodeMap) {
  const ids = [...participantIds];
  return MAIN_SKILLS.map((skill) => {
    const rawDeltas = [];
    const actualGse = [];
    const adjustedGse = [];
    const improvedAny = [];
    for (const sid of ids) {
      const studentGrowth = growthMap.get(sid);
      const skillDeltas = studentGrowth?.skillDeltas?.get(skill) || [];
      if (skillDeltas.length) rawDeltas.push(...skillDeltas);
      const episodes = (growthEpisodeMap.get(sid) || []).filter((ep) => ep.skill === skill);
      if (episodes.length) {
        actualGse.push(mean(episodes.map((ep) => ep.actualGseGrowth)));
        adjustedGse.push(mean(episodes.map((ep) => ep.adjustedGseGrowth)));
        improvedAny.push(skillDeltas.some(isImprovedDelta));
      }
    }
    const growthSampleSize = ids.filter((sid) => (growthMap.get(sid)?.skillDeltas?.get(skill) || []).length > 0).length;
    if (!growthSampleSize) return null;
    const privacySuppressed = growthSampleSize < MIN_GROWTH_SAMPLE;
    return {
      skill,
      label: SKILL_LABELS[skill] || skill,
      growthSampleSize,
      avgRawDelta: privacySuppressed ? null : mean(rawDeltas),
      avgActualGseGrowth: privacySuppressed ? null : mean(actualGse.filter((v) => v != null)),
      avgAdjustedGseGrowth: privacySuppressed ? null : mean(adjustedGse.filter((v) => v != null)),
      improvedRateAny: privacySuppressed ? null : round(
        improvedAny.filter(Boolean).length / growthSampleSize,
        4
      ),
      privacySuppressed,
    };
  }).filter(Boolean);
}

function aggregateOfferingMetrics(participantIds, growthMap, growthEpisodeMap = new Map()) {
  const ids = [...participantIds];
  const withGrowth = ids.filter((id) => growthMap.has(id));
  const studentAvgs = withGrowth
    .map((id) => mean(growthMap.get(id).deltas))
    .filter((v) => v != null);
  const growthSampleSize = withGrowth.length;
  const privacySuppressed = growthSampleSize > 0 && growthSampleSize < MIN_GROWTH_SAMPLE;

  const actualGseStudentAvgs = withGrowth
    .map((id) => mean((growthEpisodeMap.get(id) || []).map((ep) => ep.actualGseGrowth)))
    .filter((v) => v != null);
  const adjustedGseStudentAvgs = withGrowth
    .map((id) => mean((growthEpisodeMap.get(id) || []).map((ep) => ep.adjustedGseGrowth)))
    .filter((v) => v != null);

  const improvement = buildImprovementMetrics(withGrowth, growthMap, privacySuppressed);

  return {
    participantCount: ids.length,
    growthSampleSize,
    growthEpisodeCount: withGrowth.reduce((sum, id) => sum + growthMap.get(id).episodeCount, 0),
    improvement,
    improvedStudentCount: improvement.any.studentCount,
    improvedRate: improvement.any.rate,
    avgRawDelta: privacySuppressed ? null : mean(studentAvgs),
    avgActualGseGrowth: privacySuppressed ? null : mean(actualGseStudentAvgs),
    avgAdjustedGseGrowth: privacySuppressed ? null : mean(adjustedGseStudentAvgs),
    privacySuppressed,
    suppressionReason: privacySuppressed
      ? `可計算成長人數少於 ${MIN_GROWTH_SAMPLE} 人，不顯示平均進步與進步率`
      : null,
    causalClaimAllowed: false,
  };
}

function finalizeOfferingRow(base, participantIds, growthMap, growthEpisodeMap) {
  const metrics = aggregateOfferingMetrics(participantIds, growthMap, growthEpisodeMap);
  return {
    ...base,
    ...metrics,
    skillBreakdown: buildSkillBreakdown(participantIds, growthMap, growthEpisodeMap),
  };
}

function buildCourseOfferings(enrollments, growthMap, growthEpisodeMap) {
  const buckets = new Map();
  for (const row of enrollments) {
    const course = row.course || {};
    const semesterId = normText(row.semesterId || course.semesterId);
    const courseId = row.courseId;
    if (!semesterId || courseId == null) continue;
    const offeringKey = `${semesterId}::${courseId}`;
    if (!buckets.has(offeringKey)) {
      const instructorName = normInstructor(course.instructorName);
      const courseName = normText(course.courseName) || normText(course.courseCode) || '未命名課程';
      buckets.set(offeringKey, {
        offeringKey,
        label: instructorName === '未標示教師' ? courseName : `${courseName}（${instructorName}）`,
        semesterId,
        courseId,
        courseCode: normText(course.courseCode) || null,
        courseName,
        instructorName,
        courseType: normText(course.courseType) || null,
        participantIds: new Set(),
      });
    }
    buckets.get(offeringKey).participantIds.add(String(row.studentId || '').toUpperCase());
  }
  return [...buckets.values()]
    .map((bucket) => finalizeOfferingRow({
      offeringKey: bucket.offeringKey,
      label: bucket.label,
      semesterId: bucket.semesterId,
      courseId: bucket.courseId,
      courseCode: bucket.courseCode,
      courseName: bucket.courseName,
      instructorName: bucket.instructorName,
      courseType: bucket.courseType,
    }, bucket.participantIds, growthMap, growthEpisodeMap))
    .sort((a, b) => b.participantCount - a.participantCount);
}

function buildInstructorOfferings(enrollments, growthMap, growthEpisodeMap, instructorGrouping = 'by_semester') {
  const buckets = new Map();
  for (const row of enrollments) {
    const course = row.course || {};
    const semesterId = normText(row.semesterId || course.semesterId);
    if (!semesterId && instructorGrouping === 'by_semester') continue;
    const instructorName = normInstructor(course.instructorName);
    const offeringKey = instructorGrouping === 'merged'
      ? `instructor::${instructorName}`
      : `${semesterId}::${instructorName}`;
    if (!buckets.has(offeringKey)) {
      buckets.set(offeringKey, {
        offeringKey,
        label: instructorName,
        semesterId: instructorGrouping === 'merged' ? null : semesterId,
        semesterLabel: instructorGrouping === 'merged' ? '跨學期' : semesterId,
        instructorName,
        semesterIds: new Set(),
        courseCount: 0,
        courseNames: new Set(),
        participantIds: new Set(),
      });
    }
    const bucket = buckets.get(offeringKey);
    bucket.participantIds.add(String(row.studentId || '').toUpperCase());
    if (semesterId) bucket.semesterIds.add(semesterId);
    const courseName = normText(course.courseName);
    if (courseName) bucket.courseNames.add(courseName);
  }
  return [...buckets.values()]
    .map((bucket) => finalizeOfferingRow({
      offeringKey: bucket.offeringKey,
      label: bucket.label,
      semesterId: bucket.semesterId,
      semesterLabel: bucket.semesterLabel,
      instructorName: bucket.instructorName,
      semesterIds: [...bucket.semesterIds].sort(),
      courseCount: bucket.courseNames.size,
    }, bucket.participantIds, growthMap, growthEpisodeMap))
    .sort((a, b) => b.participantCount - a.participantCount);
}

function resolveActivityOfferingKey(event) {
  const payload = event.rawPayload && typeof event.rawPayload === 'object' ? event.rawPayload : {};
  const eventId = payload.eventId != null ? String(payload.eventId) : '';
  if (eventId) return `event:${eventId}`;
  const eventDate = normText(event.eventDate);
  const title = normText(event.title) || '活動';
  return `session:${eventDate}::${title}`;
}

function buildActivityOfferings(events, growthMap, growthEpisodeMap) {
  const buckets = new Map();
  for (const event of events) {
    const sid = String(event.studentId || '').toUpperCase();
    if (!sid) continue;
    const offeringKey = resolveActivityOfferingKey(event);
    if (!buckets.has(offeringKey)) {
      const payload = event.rawPayload && typeof event.rawPayload === 'object' ? event.rawPayload : {};
      buckets.set(offeringKey, {
        offeringKey,
        label: normText(event.title) || '活動',
        semesterId: normText(event.academicTerm) || null,
        eventDate: normText(event.eventDate) || null,
        activityType: normText(payload.activityType) || null,
        eventId: payload.eventId != null ? String(payload.eventId) : null,
        participantIds: new Set(),
      });
    }
    buckets.get(offeringKey).participantIds.add(sid);
  }
  return [...buckets.values()]
    .map((bucket) => finalizeOfferingRow({
      offeringKey: bucket.offeringKey,
      label: bucket.label,
      semesterId: bucket.semesterId,
      eventDate: bucket.eventDate,
      activityType: bucket.activityType,
      eventId: bucket.eventId,
    }, bucket.participantIds, growthMap, growthEpisodeMap))
    .sort((a, b) => {
      const dateCmp = String(b.eventDate || '').localeCompare(String(a.eventDate || ''));
      if (dateCmp !== 0) return dateCmp;
      return b.participantCount - a.participantCount;
    });
}

function buildResourceCategoryOfferings(events, growthMap, growthEpisodeMap) {
  const buckets = new Map();
  for (const event of events) {
    const sid = String(event.studentId || '').toUpperCase();
    if (!sid) continue;
    const resourceType = resourceKeyForEvent(event);
    if (!buckets.has(resourceType)) {
      buckets.set(resourceType, {
        offeringKey: resourceType,
        label: RESOURCE_LABELS[resourceType] || resourceType,
        resourceType,
        participantIds: new Set(),
      });
    }
    buckets.get(resourceType).participantIds.add(sid);
  }
  return [...buckets.values()]
    .map((bucket) => finalizeOfferingRow({
      offeringKey: bucket.offeringKey,
      label: bucket.label,
      resourceType: bucket.resourceType,
    }, bucket.participantIds, growthMap, growthEpisodeMap))
    .sort((a, b) => b.participantCount - a.participantCount);
}

function filterRowsForTeacher(rows, dimension, teacherNameLower) {
  if (!teacherNameLower) return rows;
  if (dimension === 'instructor') {
    return rows.filter((row) => normLower(row.instructorName) === teacherNameLower);
  }
  if (dimension === 'course') {
    return rows.filter((row) => normLower(row.instructorName) === teacherNameLower);
  }
  return rows;
}

async function resolveTeacherScope(user, semesterId) {
  if (!user || isAdmin(user) || isExecutive(user)) return null;
  if (!isTeacher(user)) return { blocked: true };
  const teacherNameLower = normLower(user.name);
  if (semesterId) {
    const scope = await getUserLearningJourneyScope(user, semesterId);
    const allowedStudentIds = new Set(
      (scope.allowedStudentIds || []).map((sid) => String(sid || '').toUpperCase()).filter(Boolean)
    );
    return { teacherNameLower, allowedStudentIds };
  }

  const enrollments = await CourseEnrollment.findAll({
    where: { enrollmentStatus: { [Op.notIn]: ['withdrawn'] } },
    include: [{ model: Course, as: 'course', required: true }],
    attributes: ['studentId'],
  });
  const allowedStudentIds = new Set();
  for (const enr of enrollments) {
    if (normLower(enr.course?.instructorName) !== teacherNameLower) continue;
    const sid = String(enr.studentId || '').toUpperCase();
    if (sid) allowedStudentIds.add(sid);
  }
  return { teacherNameLower, allowedStudentIds };
}

async function loadScopedStudents(query, snapshotVersion, teacherScope) {
  const studentsRaw = await LjAnalyticStudent.findAll({
    where: buildStudentWhere(query, snapshotVersion),
    attributes: [
      'studentId',
      'department',
      'cohort',
      'enrollmentTerm',
      'baselineEnglishScore',
      'baselineCefr',
      'baselineLevel',
      'retestFlag',
      'hasValidExam',
      'totalResourceHours',
      'exposureLevel',
    ],
  });
  let students = applyEvidenceQualityFilter(studentsRaw, query);
  if (teacherScope?.allowedStudentIds?.size) {
    students = students.filter((s) => teacherScope.allowedStudentIds.has(String(s.studentId || '').toUpperCase()));
  }
  return students;
}

async function loadGrowthExams(query, snapshotVersion, studentIds) {
  if (!studentIds.length) return [];
  return LjAnalyticExam.findAll({
    where: buildExamWhere(query, snapshotVersion, studentIds),
  });
}

async function loadCourseEnrollments(studentIds, semesterId, teacherScope) {
  if (!studentIds.length) return [];
  const where = {
    studentId: { [Op.in]: studentIds },
    enrollmentStatus: { [Op.notIn]: ['withdrawn'] },
  };
  if (semesterId) where.semesterId = semesterId;
  const enrollments = await CourseEnrollment.findAll({
    where,
    include: [{
      model: Course,
      as: 'course',
      required: true,
    }],
    order: [['semesterId', 'DESC'], ['courseId', 'ASC']],
  });
  if (!teacherScope?.teacherNameLower) return enrollments;
  return enrollments.filter((row) => normLower(row.course?.instructorName) === teacherScope.teacherNameLower);
}

async function loadParticipationEvents(studentIds, semesterId) {
  if (!studentIds.length) return [];
  const where = {
    studentId: { [Op.in]: studentIds },
    eventType: { [Op.in]: ['course_event', 'activity_event'] },
    excludeFlag: false,
    status: { [Op.in]: ['valid', 'registered_no_score'] },
  };
  if (semesterId) where.academicTerm = semesterId;
  return LjStudentEvent.findAll({ where });
}

function resolveOfferingParticipantIds(dimension, offeringKey, { enrollments = [], events = [] } = {}) {
  const participantIds = new Set();
  if (dimension === 'course') {
    for (const enr of enrollments) {
      const key = `${normText(enr.semesterId)}::${enr.courseId}`;
      if (key === offeringKey) participantIds.add(String(enr.studentId).toUpperCase());
    }
    return participantIds;
  }
  if (dimension === 'instructor') {
    if (offeringKey.startsWith('instructor::')) {
      const instructorName = offeringKey.slice('instructor::'.length);
      for (const enr of enrollments) {
        if (normInstructor(enr.course?.instructorName) === instructorName) {
          participantIds.add(String(enr.studentId).toUpperCase());
        }
      }
      return participantIds;
    }
    const sep = offeringKey.indexOf('::');
    const semesterId = offeringKey.slice(0, sep);
    const instructorName = offeringKey.slice(sep + 2);
    for (const enr of enrollments) {
      if (normText(enr.semesterId) === semesterId
        && normInstructor(enr.course?.instructorName) === instructorName) {
        participantIds.add(String(enr.studentId).toUpperCase());
      }
    }
    return participantIds;
  }
  if (dimension === 'activity') {
    for (const event of events.filter((e) => e.eventType === 'activity_event')) {
      if (resolveActivityOfferingKey(event) === offeringKey) {
        participantIds.add(String(event.studentId).toUpperCase());
      }
    }
    return participantIds;
  }
  for (const event of events) {
    if (resourceKeyForEvent(event) === offeringKey) {
      participantIds.add(String(event.studentId).toUpperCase());
    }
  }
  return participantIds;
}

function buildStudentDetailRows(participantIds, growthMap, growthEpisodeMap) {
  return [...participantIds]
    .map((studentId) => {
      const growth = growthMap.get(studentId);
      if (!growth) {
        return {
          studentId,
          growthSampleSize: 0,
          growthEpisodeCount: 0,
          avgRawDelta: null,
          avgActualGseGrowth: null,
          avgAdjustedGseGrowth: null,
          improvement: null,
          skillBreakdown: [],
        };
      }
      const withGrowth = [studentId];
      const privacySuppressed = false;
      const improvement = buildImprovementMetrics(withGrowth, growthMap, privacySuppressed);
      const episodes = growthEpisodeMap.get(studentId) || [];
      return {
        studentId,
        growthSampleSize: 1,
        growthEpisodeCount: growth.episodeCount,
        avgRawDelta: mean(growth.deltas),
        avgActualGseGrowth: mean(episodes.map((ep) => ep.actualGseGrowth)),
        avgAdjustedGseGrowth: mean(episodes.map((ep) => ep.adjustedGseGrowth)),
        improvement,
        skillBreakdown: buildSkillBreakdown(new Set([studentId]), growthMap, growthEpisodeMap),
      };
    })
    .sort((a, b) => (b.avgRawDelta ?? -Infinity) - (a.avgRawDelta ?? -Infinity));
}

async function buildOfferingContext(query = {}, options = {}) {
  const dimension = normalizeDimension(query.dimension);
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const semesterId = normText(query.semester || query.semester_id || query.semesterId) || null;
  const instructorGrouping = normalizeInstructorGrouping(
    query.instructor_grouping || query.instructorGrouping
  );
  const teacherScope = await resolveTeacherScope(options.user, semesterId);
  if (teacherScope?.blocked) {
    return { blocked: true };
  }

  const students = await loadScopedStudents(query, snapshotVersion, teacherScope);
  const studentById = new Map(students.map((student) => [String(student.studentId).toUpperCase(), student]));
  const studentIds = [...studentById.keys()];
  const exams = await loadGrowthExams(query, snapshotVersion, studentIds);
  const growthMap = buildStudentGrowthMap(exams);
  const growthEpisodes = computeAdjustedGrowthEpisodes(exams, studentById);
  const growthEpisodeMap = buildGrowthEpisodeMap(growthEpisodes);

  let rows = [];
  let enrollments = [];
  let events = [];
  if (dimension === 'course' || dimension === 'instructor') {
    enrollments = await loadCourseEnrollments(studentIds, semesterId, teacherScope);
    rows = dimension === 'course'
      ? buildCourseOfferings(enrollments, growthMap, growthEpisodeMap)
      : buildInstructorOfferings(enrollments, growthMap, growthEpisodeMap, instructorGrouping);
  } else {
    events = await loadParticipationEvents(studentIds, semesterId);
    rows = dimension === 'activity'
      ? buildActivityOfferings(events.filter((e) => e.eventType === 'activity_event'), growthMap, growthEpisodeMap)
      : buildResourceCategoryOfferings(events, growthMap, growthEpisodeMap);
  }

  if (teacherScope?.teacherNameLower) {
    rows = filterRowsForTeacher(rows, dimension, teacherScope.teacherNameLower);
  }

  return {
    dimension,
    snapshotVersion,
    semesterId,
    instructorGrouping,
    teacherScope,
    growthMap,
    growthEpisodeMap,
    enrollments,
    events,
    rows,
  };
}

/**
 * 課程／教師／活動／資源類別細項成效（描述性）
 */
async function getLearningAnalyticsOfferings(query = {}, options = {}) {
  const ctx = await buildOfferingContext(query, options);
  if (ctx.blocked) {
    return {
      contractVersion: CONTRACT_VERSION,
      dimension: normalizeDimension(query.dimension),
      rowCount: 0,
      rows: [],
      teacherScope: 'denied',
      cautions: [...buildCautions()],
      causalClaimAllowed: false,
    };
  }

  return {
    contractVersion: CONTRACT_VERSION,
    snapshotVersion: ctx.snapshotVersion,
    dimension: ctx.dimension,
    semester: ctx.semesterId,
    instructorGrouping: ctx.instructorGrouping,
    teacherScope: ctx.teacherScope ? 'teacher' : 'all',
    rowCount: ctx.rows.length,
    minGrowthSample: MIN_GROWTH_SAMPLE,
    improvementDefinitions: IMPROVEMENT_DEFINITIONS,
    rows: ctx.rows,
    cautions: [...buildCautions()],
    causalClaimAllowed: false,
  };
}

/**
 * 單一細項的學生名單與成長明細
 */
async function getLearningAnalyticsOfferingDetail(query = {}, options = {}) {
  const offeringKey = normText(query.offering_key || query.offeringKey);
  if (!offeringKey) {
    const err = new Error('offering_key 為必填');
    err.status = 400;
    throw err;
  }

  const ctx = await buildOfferingContext(query, options);
  if (ctx.blocked) {
    return {
      contractVersion: CONTRACT_VERSION,
      offeringKey,
      students: [],
      teacherScope: 'denied',
      causalClaimAllowed: false,
    };
  }

  const row = ctx.rows.find((item) => item.offeringKey === offeringKey) || null;
  if (!row) {
    const err = new Error('找不到指定的細項');
    err.status = 404;
    throw err;
  }

  const participantIds = resolveOfferingParticipantIds(ctx.dimension, offeringKey, {
    enrollments: ctx.enrollments,
    events: ctx.events,
  });
  const students = buildStudentDetailRows(participantIds, ctx.growthMap, ctx.growthEpisodeMap);

  return {
    contractVersion: CONTRACT_VERSION,
    snapshotVersion: ctx.snapshotVersion,
    dimension: ctx.dimension,
    offeringKey,
    offering: {
      label: row.label,
      semesterId: row.semesterId,
      semesterLabel: row.semesterLabel,
      participantCount: row.participantCount,
      growthSampleSize: row.growthSampleSize,
      improvement: row.improvement,
      avgRawDelta: row.avgRawDelta,
      avgActualGseGrowth: row.avgActualGseGrowth,
      avgAdjustedGseGrowth: row.avgAdjustedGseGrowth,
      skillBreakdown: row.skillBreakdown,
    },
    students,
    improvementDefinitions: IMPROVEMENT_DEFINITIONS,
    causalClaimAllowed: false,
  };
}

module.exports = {
  CONTRACT_VERSION,
  MIN_GROWTH_SAMPLE,
  OFFERING_DIMENSIONS,
  INSTRUCTOR_GROUPINGS,
  IMPROVEMENT_DEFINITIONS,
  RESOURCE_LABELS,
  SKILL_LABELS,
  normalizeDimension,
  normalizeInstructorGrouping,
  buildStudentGrowthMap,
  aggregateOfferingMetrics,
  buildCourseOfferings,
  buildInstructorOfferings,
  buildActivityOfferings,
  buildResourceCategoryOfferings,
  buildStudentDetailRows,
  resolveOfferingParticipantIds,
  buildOfferingContext,
  getLearningAnalyticsOfferings,
  getLearningAnalyticsOfferingDetail,
};
