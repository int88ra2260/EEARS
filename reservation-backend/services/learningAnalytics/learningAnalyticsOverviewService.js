'use strict';

const { Op } = require('sequelize');
const {
  LjAnalyticStudent,
  LjAnalyticExam,
  Student,
  EtStudentMaster,
  EtEnrollmentSnapshot,
} = require('../../models');
const { getAnalyticsSummary } = require('../learningJourney/analytics/analyticsSummaryService');
const { getLvaAnalytics } = require('../learningJourney/analytics/lvaAnalyticsService');
const { getSemesterB2Report } = require('../learningJourney/b2ReportService');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const {
  buildStudentWhere,
  buildExamWhere,
  applyEvidenceQualityFilter,
  stripEmptyQueryParams,
  parseCohortList,
} = require('./learningAnalyticsFilterUtils');
const { studentIdAllowList } = require('./workingSetIds');
const { resolveBaselineCefrBand } = require('./baselineAbilityUtils');
const { getCefrRank } = require('../learningJourney/utils/cefr');
const { gseBandForScore } = require('./gseScoreMappingService');
const { examGse } = require('./b1PlusWatch');
const { getCurrentSemester } = require('../../utils/semesterConstants');
const { parseSemesterId } = require('../learningJourney/utils/semIndexCalculator');

const CONTRACT_VERSION = 'learning-analytics.overview.v3';

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

const CEFR_ORDER = ['BELOW_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILL_KEYS = ['listening', 'reading', 'speaking', 'writing'];
const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};
const PRE_TEST_PHASES = new Set(['pre_test', 'single']);
const POST_TEST_PHASES = new Set(['post_test']);
const LIST_SLICES = new Set([
  'overall_b2',
  'skill_b2',
  'department_b2',
  'baseline',
  'coverage_pre',
  'coverage_post',
  'coverage_both',
  'comparable',
  'cohort_b1',
  'cohort_b1_plus',
  'cohort_no_exam',
]);
const COHORT_LEVEL_SLICES = new Set(['cohort_b1', 'cohort_b1_plus', 'cohort_no_exam']);
const ABILITY_ROSTER_SLICES = new Set(['overall_b2', 'skill_b2', 'department_b2']);
const MISSING_COHORT = '未提供';
const LIST_LIMIT_DEFAULT = 40;
const LIST_LIMIT_MAX = 100;

function resolveOverviewSemesterId(query = {}) {
  const raw = String(query.semester || query.semesterId || '').trim();
  if (raw) return raw;
  return String(getCurrentSemester() || '').trim();
}

function parseGradeNumber(raw) {
  if (raw == null || raw === '') return null;
  const digit = String(raw).match(/(\d+)/);
  if (digit) {
    const n = Number(digit[1]);
    return Number.isFinite(n) ? n : null;
  }
  const map = { 一: 1, 二: 2, 三: 3, 四: 4 };
  for (const [ch, n] of Object.entries(map)) {
    if (String(raw).includes(ch)) return n;
  }
  return null;
}

function resolveEnrollmentCohortFromRoster({ enrollmentYear, studentId, grade, semesterId }) {
  if (enrollmentYear != null && enrollmentYear !== '') {
    const n = Number(String(enrollmentYear).match(/\d+/)?.[0]);
    if (Number.isFinite(n) && n > 100) return String(n);
  }
  const parsed = parseSemesterId(semesterId);
  const gradeNum = parseGradeNumber(grade);
  if (parsed && gradeNum >= 1) {
    return String(parsed.year - (gradeNum - 1));
  }
  const m = String(studentId || '').match(/^[A-Za-z](\d{3})/);
  if (m) return m[1];
  return MISSING_COHORT;
}

function cohortFilterAllows(cohort, query) {
  const allowed = parseCohortList(query?.cohort);
  if (!allowed.length) return true;
  return allowed.includes(String(cohort));
}

function normalizeCefrKey(raw) {
  const value = String(raw || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (!value) return 'UNKNOWN';
  if (value === 'PRE_A1' || value === '未達_A1') return 'BELOW_A1';
  return CEFR_ORDER.includes(value) ? value : 'UNKNOWN';
}

async function computeCefrDistribution(query, snapshotVersion) {
  let students = await LjAnalyticStudent.findAll({
    where: buildStudentWhere(query, snapshotVersion),
    attributes: ['baselineCefr', 'bestCefr', 'retestFlag', 'hasValidExam', 'baselineEnglishScore', 'totalResourceHours'],
  });
  students = applyEvidenceQualityFilter(students, query);

  const baseline = Object.fromEntries(CEFR_ORDER.map((k) => [k, 0]));
  baseline.UNKNOWN = 0;
  const current = { ...baseline };

  for (const student of students) {
    const baseKey = normalizeCefrKey(resolveBaselineCefrBand(student));
    baseline[baseKey] = (baseline[baseKey] || 0) + 1;
    const bestKey = normalizeCefrKey(student.bestCefr);
    current[bestKey] = (current[bestKey] || 0) + 1;
  }

  const toChart = (dist) => CEFR_ORDER
    .map((level) => ({ level, count: dist[level] || 0 }))
    .concat(dist.UNKNOWN ? [{ level: 'UNKNOWN', count: dist.UNKNOWN }] : []);

  return {
    baseline: toChart(baseline),
    currentBest: toChart(current),
    note: 'CEFR 為對外顯示等級；內部分析使用 GSE（Global Scale of English）標準化分數。',
  };
}

function labelResource(type) {
  return RESOURCE_LABELS[type] || type;
}

function mapResourceParticipation(skillExposure) {
  const byResource = skillExposure?.byResource || [];
  return byResource
    .map((row) => ({
      resourceType: row.resourceType,
      label: labelResource(row.resourceType),
      events: row.events,
      hours: Math.round(Number(row.hours || 0) * 10) / 10,
      participantProxy: row.events,
    }))
    .sort((a, b) => b.hours - a.hours);
}

function mapResourceRanking(rows) {
  return (rows || []).slice(0, 10).map((row) => ({
    resourceType: row.resourceType,
    label: labelResource(row.resourceType),
    participantCount: row.participantCount,
    growthSampleSize: row.growthSampleSize,
    rawGrowthAverage: row.rawGrowthAverage,
    mainSkills: row.mainSkills || [],
    evidenceLevel: row.evidenceLevel,
    interpretation: row.interpretation,
    causalClaimAllowed: false,
  }));
}

function mapSkillGrowth(adjustedGrowth, growthEpisodes) {
  const adjusted = adjustedGrowth?.bySkill || [];
  const raw = growthEpisodes?.bySkill || [];
  const rawBySkill = new Map(raw.map((row) => [row.skill, row]));

  return adjusted.map((row) => {
    const rawRow = rawBySkill.get(row.skill) || {};
    return {
      skill: row.skill,
      adjustedGrowthAverage: row.adjustedGseGrowthAverage,
      rawGrowthAverage: rawRow.rawGrowthAverage ?? null,
      sampleSize: row.sampleSize,
      confidenceInterval: row.confidenceInterval,
      estimateType: row.estimateType,
      causalClaimAllowed: false,
    };
  });
}

function mapEvidenceQuality(gseSummary) {
  const quality = gseSummary?.evidenceQuality || {};
  const total = Object.values(quality).reduce((sum, n) => sum + Number(n || 0), 0);
  const labels = {
    high: '高',
    medium: '中',
    medium_low: '中低',
    low: '低',
  };
  return Object.entries(quality).map(([key, count]) => ({
    level: key,
    label: labels[key] || key,
    count: Number(count) || 0,
    rate: total ? Number(((Number(count) || 0) / total).toFixed(4)) : 0,
  }));
}

function studentKey(studentId) {
  return String(studentId || '').trim().toUpperCase();
}

function departmentLabel(student) {
  const value = String(student?.department || '').trim();
  return value || '未提供';
}

const B2_RANK = 4;

function isCountableExam(exam) {
  if (!exam || exam.excludeFlag) return false;
  if (exam.registeredNoScoreFlag) return false;
  const status = String(exam.status || '').toLowerCase();
  if (status && status !== 'valid') return false;
  if (String(exam.instrument || '').toUpperCase() === 'GSAT') return false;
  return true;
}

function skillKey(exam) {
  return String(exam?.skill || '').toLowerCase();
}

function bestRawScoreExam(exams, skill) {
  const rows = (exams || []).filter((exam) => (
    isCountableExam(exam)
    && skillKey(exam) === skill
    && exam.rawScore != null
    && exam.rawScore !== ''
  ));
  rows.sort((a, b) => {
    const scoreDiff = Number(b.rawScore) - Number(a.rawScore);
    if (scoreDiff) return scoreDiff;
    return String(b.examDate || '').localeCompare(String(a.examDate || ''));
  });
  return rows[0] || null;
}

function examIsB2(exam) {
  return getCefrRank(exam?.cefrLevel) >= B2_RANK;
}

function bestSkillEvidence(exams) {
  const chosen = SKILL_KEYS
    .map((skill) => bestRawScoreExam(exams, skill))
    .filter(Boolean);
  chosen.sort((a, b) => {
    const rankDiff = (getCefrRank(b.cefrLevel) || 0) - (getCefrRank(a.cefrLevel) || 0);
    if (rankDiff) return rankDiff;
    return String(b.examDate || '').localeCompare(String(a.examDate || ''));
  });
  return chosen[0] || null;
}

function describeEvidence(exam) {
  if (!exam) return null;
  return {
    skill: skillKey(exam),
    skillLabel: SKILL_LABELS[skillKey(exam)] || skillKey(exam),
    cefrLevel: exam.cefrLevel || null,
    instrument: exam.instrument || null,
    examDate: exam.examDate || null,
    rawScore: exam.rawScore != null ? Number(exam.rawScore) : null,
  };
}

function rateOf(count, total) {
  const n = Number(count) || 0;
  const d = Number(total) || 0;
  return d ? Number((n / d).toFixed(4)) : 0;
}

function examsByStudent(exams) {
  const map = new Map();
  for (const exam of exams || []) {
    const id = studentKey(exam.studentId);
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(exam);
  }
  return map;
}

function buildAbilitySummary(students, exams) {
  const total = students.length;
  const grouped = examsByStudent(exams);
  const skillSets = Object.fromEntries(SKILL_KEYS.map((skill) => [skill, new Set()]));
  for (const student of students) {
    const id = studentKey(student.studentId);
    const ownExams = grouped.get(id) || [];
    for (const skill of SKILL_KEYS) {
      const best = bestRawScoreExam(ownExams, skill);
      if (examIsB2(best)) skillSets[skill].add(id);
    }
  }
  const overallCount = students.filter((student) => student.isB2plus).length;
  return {
    total,
    overall: { count: overallCount, total, rate: rateOf(overallCount, total) },
    skills: SKILL_KEYS.map((skill) => {
      const count = skillSets[skill].size;
      return {
        skill,
        label: SKILL_LABELS[skill],
        count,
        total,
        rate: rateOf(count, total),
      };
    }),
  };
}

function buildDepartmentB2(students) {
  const groups = new Map();
  for (const student of students) {
    const label = departmentLabel(student);
    if (!groups.has(label)) groups.set(label, { department: label, total: 0, count: 0 });
    const row = groups.get(label);
    row.total += 1;
    if (student.isB2plus) row.count += 1;
  }
  return [...groups.values()]
    .map((row) => ({ ...row, rate: rateOf(row.count, row.total) }))
    .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department, 'zh-Hant'));
}

function coverageBucket(students, idSet) {
  const total = students.length;
  const count = students.filter((student) => idSet.has(studentKey(student.studentId))).length;
  return { count, total, rate: rateOf(count, total) };
}

function buildCoverage(students, exams) {
  const pre = new Set();
  const post = new Set();
  for (const exam of exams || []) {
    if (!isCountableExam(exam)) continue;
    const id = studentKey(exam.studentId);
    const phase = String(exam.testPhase || '');
    if (PRE_TEST_PHASES.has(phase)) pre.add(id);
    if (POST_TEST_PHASES.has(phase)) post.add(id);
  }
  const both = new Set([...pre].filter((id) => post.has(id)));
  return {
    pretest: coverageBucket(students, pre),
    posttest: coverageBucket(students, post),
    both: coverageBucket(students, both),
  };
}

function buildGrowthView(totalStudents, bySkill) {
  const rows = Array.isArray(bySkill) ? bySkill : [];
  return SKILL_KEYS.map((skill) => {
    const row = rows.find((item) => item.skill === skill) || {};
    const sampleSize = Number(row.pairedStudentCount ?? row.sampleSize ?? 0);
    const average = row.actualGseGrowthAverage;
    const comparable = Number.isFinite(sampleSize) && sampleSize > 0 && average != null && Number.isFinite(Number(average));
    const pairedStudents = comparable ? sampleSize : 0;
    return {
      skill,
      label: SKILL_LABELS[skill],
      average: comparable ? Number(average) : null,
      sampleSize: pairedStudents,
      episodeCount: Number(row.sampleSize || 0),
      unavailable: Math.max(0, totalStudents - pairedStudents),
      status: comparable ? 'ok' : 'insufficient',
    };
  });
}

function flagged(value) {
  return value === true || value === 1 || value === '1';
}

function cohortLabel(student) {
  const value = String(student?.cohort ?? '').trim();
  return value || MISSING_COHORT;
}

function bestMappedGse(exams) {
  let best = null;
  for (const exam of exams || []) {
    if (!exam || flagged(exam.excludeFlag) || flagged(exam.registeredNoScoreFlag)) continue;
    if (String(exam.instrument || '').toUpperCase() === 'GSAT') continue;
    const skill = String(exam.skill || '').toLowerCase();
    if (!SKILL_KEYS.includes(skill)) continue;
    const gse = examGse(exam);
    if (!Number.isFinite(gse)) continue;
    if (best == null || gse > best) best = gse;
  }
  return best;
}

function cohortLevelOf(student, exams) {
  if (!student?.hasValidExam) return 'no_exam';
  const band = gseBandForScore(bestMappedGse(exams));
  if (band?.subLevel === 'B1') return 'b1';
  if (band?.subLevel === 'B1_PLUS') return 'b1_plus';
  return 'other';
}

function compareCohortRows(a, b) {
  const aMissing = a.cohort === MISSING_COHORT;
  const bMissing = b.cohort === MISSING_COHORT;
  if (aMissing !== bMissing) return aMissing ? 1 : -1;
  const aNum = Number(a.cohort);
  const bNum = Number(b.cohort);
  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return bNum - aNum;
  return String(a.cohort).localeCompare(String(b.cohort), 'zh-Hant');
}

function buildCohortLevelTable(students, exams) {
  const grouped = examsByStudent(exams);
  const rows = new Map();
  for (const student of students || []) {
    const cohort = cohortLabel(student);
    if (!rows.has(cohort)) {
      rows.set(cohort, { cohort, total: 0, b1: 0, b1Plus: 0, noExam: 0 });
    }
    const row = rows.get(cohort);
    row.total += 1;
    const level = cohortLevelOf(student, grouped.get(studentKey(student.studentId)) || []);
    if (level === 'b1') row.b1 += 1;
    else if (level === 'b1_plus') row.b1Plus += 1;
    else if (level === 'no_exam') row.noExam += 1;
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      b1Rate: rateOf(row.b1, row.total),
      b1PlusRate: rateOf(row.b1Plus, row.total),
      noExamRate: rateOf(row.noExam, row.total),
    }))
    .sort(compareCohortRows);
}

function buildDashboard({
  students,
  exams,
  abilityStudents,
  abilityExams,
  abilityMeta,
  baseline,
  growthBySkill,
  resourceParticipation,
  resourceRanking,
  byCohortLevel,
  byCohortLevelMeta,
}) {
  const abilitySource = abilityStudents || students;
  const abilityExamSource = abilityExams || exams;
  const ability = buildAbilitySummary(abilitySource, abilityExamSource);
  return {
    ability: {
      ...ability,
      population: abilityMeta?.population || 'analytics_snapshot',
      populationMeta: abilityMeta || null,
      byDepartment: buildDepartmentB2(abilitySource),
      byCohortLevel: byCohortLevel || [],
      byCohortLevelMeta: byCohortLevelMeta || null,
    },
    growth: {
      baseline: baseline || [],
      coverage: buildCoverage(students, exams),
      skills: buildGrowthView(students.length, growthBySkill),
    },
    resources: {
      participation: resourceParticipation || [],
      ranking: resourceRanking || [],
    },
  };
}

/**
 * 學期在學名冊母體：英語能力摘要、系所 B2、各入學年度 B1／B1+／尚無英檢共用。
 * 英檢能力仍對齊選定分析快照；學測不算英檢。
 */
async function loadEnrollmentRosterScopedStudents(query, snapshotVersion) {
  const semesterId = resolveOverviewSemesterId(query);
  const empty = (note) => ({
    students: [],
    exams: [],
    meta: {
      semesterId: semesterId || null,
      population: 'enrollment_roster',
      rosterTotal: 0,
      note,
    },
  });

  if (!semesterId) {
    return empty('請選擇學期，才能以學期在學名冊計算英語能力摘要與各入學年度分布。');
  }

  const snaps = await EtEnrollmentSnapshot.findAll({
    where: { semesterId, isActive: true },
    attributes: ['studentId', 'grade', 'department', 'college'],
  });

  const seen = new Set();
  let roster = [];
  for (const snap of snaps) {
    const id = studentKey(snap.studentId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    roster.push({
      studentId: id,
      grade: snap.grade,
      department: snap.department || null,
      college: snap.college || null,
    });
  }

  const allow = studentIdAllowList(query.student_ids || query.studentIds);
  if (allow) {
    const allowSet = new Set(allow);
    roster = roster.filter((row) => allowSet.has(row.studentId));
  }

  if (!roster.length) {
    return empty('此學期尚無有效的學期在學名冊。請先於學習歷程匯入「學期在學名冊」。');
  }

  const ids = roster.map((row) => row.studentId);
  const [masters, analyticStudents, exams] = await Promise.all([
    Student.findAll({
      where: { studentId: { [Op.in]: ids } },
      attributes: ['studentId', 'enrollmentYear'],
    }),
    LjAnalyticStudent.findAll({
      where: { snapshotVersion, studentId: { [Op.in]: ids } },
      attributes: [
        'studentId', 'department', 'college', 'cohort', 'isB2plus',
        'hasValidExam', 'baselineCefr', 'baselineEnglishScore', 'retestFlag', 'totalResourceHours',
      ],
    }),
    LjAnalyticExam.findAll({
      where: buildExamWhere(query, snapshotVersion, ids),
      attributes: [
        'id', 'studentId', 'skill', 'isB2plus', 'testPhase', 'instrument',
        'excludeFlag', 'registeredNoScoreFlag', 'cefrLevel', 'retestFlag', 'status',
        'deltaRawScore', 'previousRawScore', 'rawScore', 'examDate',
        'previousExamEventId', 'resourceHoursBeforeExam',
      ],
    }),
  ]);

  const yearById = new Map(
    masters.map((row) => [studentKey(row.studentId), row.enrollmentYear]),
  );
  const analyticById = new Map(
    analyticStudents.map((row) => [studentKey(row.studentId), row]),
  );
  const students = [];
  for (const row of roster) {
    const cohort = resolveEnrollmentCohortFromRoster({
      enrollmentYear: yearById.get(row.studentId),
      studentId: row.studentId,
      grade: row.grade,
      semesterId,
    });
    if (!cohortFilterAllows(cohort, query)) continue;
    const analytic = analyticById.get(row.studentId);
    students.push({
      studentId: row.studentId,
      cohort,
      department: row.department || analytic?.department || null,
      college: row.college || analytic?.college || null,
      isB2plus: analytic ? !!analytic.isB2plus : false,
      hasValidExam: analytic ? !!analytic.hasValidExam : false,
      baselineCefr: analytic?.baselineCefr ?? null,
      baselineEnglishScore: analytic?.baselineEnglishScore ?? null,
      retestFlag: analytic ? !!analytic.retestFlag : false,
      totalResourceHours: analytic?.totalResourceHours ?? null,
    });
  }

  return {
    students,
    exams,
    meta: {
      semesterId,
      population: 'enrollment_roster',
      rosterTotal: students.length,
      note: '分母為該學期在學名冊。英檢能力對齊選定分析快照；學測不算。',
    },
  };
}

/**
 * 各入學年度 B1／B1+／尚無英檢：分母為學期在學名冊（EtEnrollmentSnapshot）。
 */
async function buildEnrollmentRosterCohortLevelTable(query, snapshotVersion) {
  const { students, exams, meta } = await loadEnrollmentRosterScopedStudents(query, snapshotVersion);
  if (!meta.semesterId) {
    return {
      rows: [],
      meta: {
        ...meta,
        note: '請選擇學期，才能以學期在學名冊計算各入學年度的 B1、B1+ 與尚無英檢。',
      },
    };
  }
  if (!students.length) {
    return {
      rows: [],
      meta: {
        ...meta,
        note: meta.rosterTotal === 0 && meta.note
          ? meta.note
          : '此學期尚無有效的學期在學名冊。請先於學習歷程匯入「學期在學名冊」。',
      },
    };
  }
  return {
    rows: buildCohortLevelTable(students, exams),
    meta: {
      ...meta,
      note: '分母為該學期在學名冊。B1／B1+ 依目前最佳能力 GSE；尚無英檢＝名冊內沒有有效英檢（學測不算）。',
    },
  };
}

async function loadScopedAnalytics(query, snapshotVersion) {
  const filters = stripEmptyQueryParams({ ...query, snapshot_version: snapshotVersion });
  delete filters.skill;
  let students = await LjAnalyticStudent.findAll({
    where: buildStudentWhere(filters, snapshotVersion),
    attributes: [
      'studentId', 'department', 'college', 'cohort', 'isB2plus',
      'baselineCefr', 'baselineEnglishScore', 'retestFlag', 'hasValidExam', 'totalResourceHours',
    ],
  });
  students = applyEvidenceQualityFilter(students, filters);
  const studentIds = students.map((student) => student.studentId);
  const exams = studentIds.length
    ? await LjAnalyticExam.findAll({
      where: buildExamWhere(filters, snapshotVersion, studentIds),
      attributes: [
        'id', 'studentId', 'skill', 'isB2plus', 'testPhase', 'instrument',
        'excludeFlag', 'registeredNoScoreFlag', 'cefrLevel', 'retestFlag', 'status',
        'deltaRawScore', 'previousRawScore', 'rawScore', 'examDate',
        'previousExamEventId', 'resourceHoursBeforeExam',
      ],
    })
    : [];
  return { filters, students, exams };
}

function hasPhase(exams, phases) {
  return (exams || []).some((exam) => isCountableExam(exam) && phases.has(String(exam.testPhase || '')));
}

function matchesSlice(student, exams, slice, query) {
  if (slice === 'overall_b2') return !!student.isB2plus;
  if (slice === 'skill_b2') {
    const skill = String(query.skill || '');
    return examIsB2(bestRawScoreExam(exams, skill));
  }
  if (slice === 'department_b2') {
    return departmentLabel(student) === String(query.department || '') && !!student.isB2plus;
  }
  if (slice === 'baseline') {
    const level = String(query.level || '').trim().toUpperCase();
    const band = resolveBaselineCefrBand(student);
    if (level === 'UNKNOWN') return !band;
    return band === level;
  }
  if (slice === 'coverage_pre') return hasPhase(exams, PRE_TEST_PHASES);
  if (slice === 'coverage_post') return hasPhase(exams, POST_TEST_PHASES);
  if (slice === 'coverage_both') return hasPhase(exams, PRE_TEST_PHASES) && hasPhase(exams, POST_TEST_PHASES);
  if (COHORT_LEVEL_SLICES.has(slice)) {
    if (cohortLabel(student) !== String(query.grade || '').trim()) return false;
    const level = cohortLevelOf(student, exams);
    if (slice === 'cohort_b1') return level === 'b1';
    if (slice === 'cohort_b1_plus') return level === 'b1_plus';
    return level === 'no_exam';
  }
  return false;
}

async function comparableStudentIds(students, exams, skill) {
  const { buildAdjustedGrowthEpisodeRows, buildExamById } = require('../learningJourney/analytics/lvaAdjustedGrowthService');
  const studentById = new Map(students.map((student) => [student.studentId, student]));
  const rows = buildAdjustedGrowthEpisodeRows(exams, studentById, buildExamById(exams));
  return new Set(
    rows
      .filter((row) => row.skill === skill && Number.isFinite(Number(row.actualGseGrowth)))
      .map((row) => studentKey(row.studentId))
  );
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
    const id = studentKey(row.studentId);
    if (id && row.name) names.set(id, row.name);
  }
  for (const row of roster) {
    const id = studentKey(row.studentId);
    if (id && row.nameZh) names.set(id, row.nameZh);
  }
  return names;
}

/**
 * 主管 Demo 用中心成效總覽（整合 LJ 分析讀模型 + LVA 描述性指標）
 */
async function getLearningAnalyticsOverview(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const filters = stripEmptyQueryParams({ ...query, snapshot_version: snapshotVersion });

  const overviewSemesterId = resolveOverviewSemesterId(filters);
  const filtersWithSemester = overviewSemesterId
    ? { ...filters, semester: overviewSemesterId }
    : filters;

  const [summary, lva, cefrDistribution, b2Report, unfilteredSummary, scoped, rosterScoped] = await Promise.all([
    getAnalyticsSummary(filtersWithSemester),
    getLvaAnalytics(filtersWithSemester),
    computeCefrDistribution(filtersWithSemester, snapshotVersion),
    overviewSemesterId
      ? getSemesterB2Report(String(overviewSemesterId)).catch(() => null)
      : Promise.resolve(null),
    getAnalyticsSummary({ snapshot_version: snapshotVersion }),
    loadScopedAnalytics(filtersWithSemester, snapshotVersion),
    loadEnrollmentRosterScopedStudents(filtersWithSemester, snapshotVersion),
  ]);

  const rosterCohort = {
    rows: rosterScoped.students.length
      ? buildCohortLevelTable(rosterScoped.students, rosterScoped.exams)
      : [],
    meta: {
      ...rosterScoped.meta,
      note: !rosterScoped.meta?.semesterId
        ? '請選擇學期，才能以學期在學名冊計算各入學年度的 B1、B1+ 與尚無英檢。'
        : (rosterScoped.students.length
          ? '分母為該學期在學名冊。B1／B1+ 依目前最佳能力 GSE；尚無英檢＝名冊內沒有有效英檢（學測不算）。'
          : (rosterScoped.meta?.note
            || '此學期尚無有效的學期在學名冊。請先於學習歷程匯入「學期在學名冊」。')),
    },
  };

  const totals = summary.totals || {};
  const adjustedSkills = lva.adjustedGrowth?.bySkill || [];
  const overallAdjusted = adjustedSkills.length
    ? adjustedSkills.reduce((sum, row) => sum + Number(row.adjustedGseGrowthAverage || 0), 0) / adjustedSkills.length
    : null;

  const headline = {
    studentsInAnalysis: totals.students || 0,
    studentsWithBaseline: totals.withBaseline || 0,
    studentsWithValidExam: totals.studentsWithValidExam || 0,
    studentsWithSingleExam: totals.singleExamStudents || 0,
    studentsWithMultipleExams: totals.multiExamStudents || 0,
    studentsWithRetest: totals.retestStudents || 0,
    b2plusCount: totals.b2plusCount || 0,
    b2plusRate: totals.b2plusRate || 0,
    averageAdjustedGseGrowth: overallAdjusted == null ? null : Number(overallAdjusted.toFixed(2)),
    improvedExamRows: totals.improvedExamRows || 0,
  };

  const certification = b2Report
    ? {
        semesterId: b2Report.semesterId,
        totalStudents: b2Report.totalStudents,
        skills: b2Report.skills,
        note: '認證通過率依學期在學名冊與歷史最佳技能 CEFR 達 B2+ 計算。',
      }
    : {
        semesterId: overviewSemesterId || null,
        totalStudents: null,
        skills: null,
        note: overviewSemesterId
          ? '本學期在學名冊資料不足，無法計算 B2+ 認證率。'
          : '請選擇學期以顯示學期認證通過率。',
      };
  const hasData = headline.studentsInAnalysis > 0;
  const hasSnapshotData = (unfilteredSummary.totals?.students || 0) > 0;
  const hasActiveStudentFilters = Object.keys(filters).some((key) => (
    key !== 'snapshot_version'
    && key !== 'snapshotVersion'
    && key !== 'semester'
    && filters[key] != null
    && filters[key] !== ''
  ));

  return {
    contractVersion: CONTRACT_VERSION,
    module: 'EEARS-LVA',
    snapshotVersion,
    filters: filtersWithSemester,
    headline,
    certification,
    cefrDistribution,
    skillGrowth: mapSkillGrowth(lva.adjustedGrowth, lva.growthEpisodes),
    resourceParticipation: mapResourceParticipation(lva.skillExposure),
    resourceRanking: mapResourceRanking(lva.resourceEffectiveness),
    evidenceQuality: mapEvidenceQuality(lva.gse),
    dashboard: buildDashboard({
      students: scoped.students,
      exams: scoped.exams,
      abilityStudents: rosterScoped.students,
      abilityExams: rosterScoped.exams,
      abilityMeta: {
        ...rosterScoped.meta,
        note: rosterScoped.meta?.note
          || '分母為選定學期的學期在學名冊。英檢能力對齊選定分析快照；學測不算。',
      },
      baseline: cefrDistribution.baseline,
      growthBySkill: lva.adjustedGrowth?.bySkill || [],
      resourceParticipation: mapResourceParticipation(lva.skillExposure),
      resourceRanking: mapResourceRanking(lva.resourceEffectiveness),
      byCohortLevel: rosterCohort.rows,
      byCohortLevelMeta: rosterCohort.meta,
    }),
    exposureDistribution: summary.distributions?.exposure || {},
    cohortDistribution: summary.distributions?.cohort || {},
    dataTraceability: {
      recordCounts: lva.rawData?.recordCounts || {},
      missingDataReport: lva.rawData?.missingDataReport || {},
      exclusionPolicy: lva.rawData?.exclusionPolicy || null,
    },
    estimatePolicy: lva.estimatePolicy,
    disclaimers: [
      '本模組呈現的是觀察資料與修正後趨勢，不代表課程或活動的因果效果。',
      '資源頁先看參與覆蓋與可算成長樣本；進階觀察估計僅作研究附錄。',
      '所有指標皆可回溯至 lj_analytic_* 與 lj_student_events 原始投影資料。',
    ],
    hasData,
    emptyStateHint: hasData
      ? null
      : (hasSnapshotData && hasActiveStudentFilters
        ? '目前篩選條件下無符合學生。請放寬「起始能力」等條件，或確認已匯入學測 baseline。'
        : '尚無分析資料。請先於「英語學習歷程 → 學習歷程維運」執行分析重建（analytics rebuild）。'),
  };
}

async function listOverviewStudents(query = {}) {
  const slice = String(query.slice || '').trim();
  if (!LIST_SLICES.has(slice)) {
    const err = new Error('不支援的名單條件');
    err.status = 400;
    throw err;
  }
  if ((slice === 'skill_b2' || slice === 'comparable') && !SKILL_KEYS.includes(String(query.skill || ''))) {
    const err = new Error('請指定技能');
    err.status = 400;
    throw err;
  }
  if (slice === 'department_b2' && !String(query.department || '').trim()) {
    const err = new Error('請指定系所');
    err.status = 400;
    throw err;
  }
  if (slice === 'baseline' && !String(query.level || '').trim()) {
    const err = new Error('請指定起始等級');
    err.status = 400;
    throw err;
  }
  if (COHORT_LEVEL_SLICES.has(slice) && !String(query.grade || '').trim()) {
    const err = new Error('請指定入學年度');
    err.status = 400;
    throw err;
  }

  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const overviewSemesterId = resolveOverviewSemesterId(query);
  const scopedQuery = overviewSemesterId ? { ...query, semester: overviewSemesterId } : query;

  let matched;
  let exams;
  if (COHORT_LEVEL_SLICES.has(slice) || ABILITY_ROSTER_SLICES.has(slice)) {
    if (!overviewSemesterId) {
      const err = new Error('請選擇學期（學期在學名冊）');
      err.status = 400;
      throw err;
    }
    const rosterScoped = await loadEnrollmentRosterScopedStudents(scopedQuery, snapshotVersion);
    exams = rosterScoped.exams;
    const groupedRoster = examsByStudent(exams);
    if (COHORT_LEVEL_SLICES.has(slice)) {
      const wantCohort = String(query.grade || '').trim();
      const wantLevel = slice === 'cohort_b1'
        ? 'b1'
        : (slice === 'cohort_b1_plus' ? 'b1_plus' : 'no_exam');
      matched = rosterScoped.students.filter((student) => {
        if (cohortLabel(student) !== wantCohort) return false;
        return cohortLevelOf(student, groupedRoster.get(studentKey(student.studentId)) || []) === wantLevel;
      });
    } else {
      matched = rosterScoped.students.filter((student) => (
        matchesSlice(student, groupedRoster.get(studentKey(student.studentId)) || [], slice, query)
      ));
    }
  } else {
    const scoped = await loadScopedAnalytics(scopedQuery, snapshotVersion);
    exams = scoped.exams;
    const students = scoped.students;
    const grouped = examsByStudent(exams);
    if (slice === 'comparable') {
      const ids = await comparableStudentIds(students, exams, String(query.skill));
      matched = students.filter((student) => ids.has(studentKey(student.studentId)));
    } else {
      matched = students.filter((student) => (
        matchesSlice(student, grouped.get(studentKey(student.studentId)) || [], slice, query)
      ));
    }
  }
  matched.sort((a, b) => studentKey(a.studentId).localeCompare(studentKey(b.studentId)));
  const grouped = examsByStudent(exams);
  const limit = Math.min(LIST_LIMIT_MAX, Math.max(1, Number(query.limit) || LIST_LIMIT_DEFAULT));
  const offset = Math.max(0, Number(query.offset) || 0);
  const page = matched.slice(offset, offset + limit);
  const names = await loadNames(page.map((student) => student.studentId));
  return {
    snapshotVersion,
    slice,
    skill: query.skill || null,
    department: query.department || null,
    level: query.level || null,
    grade: query.grade || null,
    total: matched.length,
    limit,
    offset,
    items: page.map((student) => {
      const ownExams = grouped.get(studentKey(student.studentId)) || [];
      const evidenceExam = slice === 'skill_b2'
        ? bestRawScoreExam(ownExams, String(query.skill || ''))
        : slice === 'overall_b2' || slice === 'department_b2'
          ? bestSkillEvidence(ownExams)
          : null;
      return {
        studentId: student.studentId,
        studentName: names.get(studentKey(student.studentId)) || null,
        department: departmentLabel(student),
        college: student.college || null,
        cohort: student.cohort || null,
        evidence: describeEvidence(evidenceExam),
      };
    }),
  };
}

module.exports = {
  CONTRACT_VERSION,
  getLearningAnalyticsOverview,
  listOverviewStudents,
  buildAbilitySummary,
  buildDepartmentB2,
  buildCoverage,
  buildGrowthView,
  buildCohortLevelTable,
  resolveEnrollmentCohortFromRoster,
  labelResource,
  RESOURCE_LABELS,
};
