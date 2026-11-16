'use strict';

const { Op } = require('sequelize');
const { LjAnalyticStudent, LjAnalyticExam, Student, EtStudentMaster } = require('../../models');
const { getAnalyticsSummary } = require('../learningJourney/analytics/analyticsSummaryService');
const { getLvaAnalytics } = require('../learningJourney/analytics/lvaAnalyticsService');
const { getSemesterB2Report } = require('../learningJourney/b2ReportService');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const {
  buildStudentWhere,
  buildExamWhere,
  applyEvidenceQualityFilter,
  stripEmptyQueryParams,
} = require('./learningAnalyticsFilterUtils');
const { resolveBaselineCefrBand } = require('./baselineAbilityUtils');

const CONTRACT_VERSION = 'learning-analytics.overview.v1';

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
]);
const LIST_LIMIT_DEFAULT = 40;
const LIST_LIMIT_MAX = 100;

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

function isCountableExam(exam) {
  if (!exam || exam.excludeFlag) return false;
  if (exam.registeredNoScoreFlag) return false;
  if (String(exam.instrument || '').toUpperCase() === 'GSAT') return false;
  return true;
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
  const skillSets = Object.fromEntries(SKILL_KEYS.map((skill) => [skill, new Set()]));
  for (const exam of exams || []) {
    if (!isCountableExam(exam) || !exam.isB2plus) continue;
    const skill = String(exam.skill || '');
    if (!skillSets[skill]) continue;
    skillSets[skill].add(studentKey(exam.studentId));
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

function buildDashboard({ students, exams, baseline, growthBySkill, resourceParticipation, resourceRanking }) {
  const ability = buildAbilitySummary(students, exams);
  return {
    ability: {
      ...ability,
      byDepartment: buildDepartmentB2(students),
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
        'excludeFlag', 'registeredNoScoreFlag', 'cefrLevel', 'retestFlag',
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
    return exams.some((exam) => isCountableExam(exam) && exam.isB2plus && exam.skill === skill);
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

  const [summary, lva, cefrDistribution, b2Report, unfilteredSummary, scoped] = await Promise.all([
    getAnalyticsSummary(filters),
    getLvaAnalytics(filters),
    computeCefrDistribution(filters, snapshotVersion),
    filters.semester
      ? getSemesterB2Report(String(filters.semester)).catch(() => null)
      : Promise.resolve(null),
    getAnalyticsSummary({ snapshot_version: snapshotVersion }),
    loadScopedAnalytics(filters, snapshotVersion),
  ]);

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
        note: '認證通過率依學期名冊與歷史最佳技能 CEFR 達 B2+ 計算。',
      }
    : {
        semesterId: filters.semester || null,
        totalStudents: null,
        skills: null,
        note: filters.semester
          ? '本學期名冊資料不足，無法計算 B2+ 認證率。'
          : '可加上 semester 篩選以顯示學期認證通過率。',
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
    filters,
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
      baseline: cefrDistribution.baseline,
      growthBySkill: lva.adjustedGrowth?.bySkill || [],
      resourceParticipation: mapResourceParticipation(lva.skillExposure),
      resourceRanking: mapResourceRanking(lva.resourceEffectiveness),
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

  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const { students, exams } = await loadScopedAnalytics(query, snapshotVersion);
  const grouped = examsByStudent(exams);
  let matched = students;
  if (slice === 'comparable') {
    const ids = await comparableStudentIds(students, exams, String(query.skill));
    matched = students.filter((student) => ids.has(studentKey(student.studentId)));
  } else {
    matched = students.filter((student) => (
      matchesSlice(student, grouped.get(studentKey(student.studentId)) || [], slice, query)
    ));
  }
  matched.sort((a, b) => studentKey(a.studentId).localeCompare(studentKey(b.studentId)));

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
    total: matched.length,
    limit,
    offset,
    items: page.map((student) => ({
      studentId: student.studentId,
      studentName: names.get(studentKey(student.studentId)) || null,
      department: departmentLabel(student),
      college: student.college || null,
      cohort: student.cohort || null,
    })),
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
  labelResource,
  RESOURCE_LABELS,
};
