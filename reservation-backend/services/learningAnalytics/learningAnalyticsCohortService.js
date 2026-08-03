'use strict';

const { LjAnalyticStudent, LjAnalyticExam } = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const { computeAdjustedGrowthEpisodes } = require('../learningJourney/analytics/lvaAnalyticsService');
const {
  buildStudentWhere,
  buildExamWhere,
  applyEvidenceQualityFilter,
} = require('./learningAnalyticsFilterUtils');
const {
  resolveGroupKey,
  aggregateGrowthByGroup,
  buildParticipationComparison,
} = require('./learningAnalyticsCohortServiceHelpers');

const GROUP_FIELDS = {
  department: 'department',
  college: 'college',
  cohort: 'cohort',
  exposure_level: 'exposureLevel',
  baseline_level: 'baselineCefr',
};

const MAIN_SKILLS = ['listening', 'reading', 'speaking', 'writing'];

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return Math.round((nums.reduce((sum, v) => sum + v, 0) / nums.length) * 100) / 100;
}

/**
 * 群體分析（描述性 + 成長區間彙總）
 */
async function getLearningAnalyticsCohorts(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const groupByField = GROUP_FIELDS[query.group_by || query.groupBy] || 'department';
  const groupBy = groupByField;

  const studentsRaw = await LjAnalyticStudent.findAll({
    where: buildStudentWhere(query, snapshotVersion),
    attributes: [
      'studentId',
      groupBy,
      'baselineEnglishScore',
      'baselineLevel',
      'baselineCefr',
      'isB2plus',
      'retestFlag',
      'examCount',
      'hasValidExam',
      'totalResourceHours',
      'exposureLevel',
    ],
  });
  const students = applyEvidenceQualityFilter(studentsRaw, query);
  const studentById = new Map(students.map((student) => [student.studentId, student]));
  const studentIds = students.map((student) => student.studentId);

  const exams = studentIds.length
    ? await LjAnalyticExam.findAll({
      where: buildExamWhere(query, snapshotVersion, studentIds),
    })
    : [];
  const growthEpisodes = computeAdjustedGrowthEpisodes(exams, studentById);
  const growthByGroup = aggregateGrowthByGroup(growthEpisodes, studentById, groupBy);

  const groups = new Map();
  for (const student of students) {
    const key = resolveGroupKey(student, groupBy);
    if (!groups.has(key)) {
      groups.set(key, {
        groupKey: key,
        students: 0,
        b2plusCount: 0,
        retestCount: 0,
        multiExamCount: 0,
        withBaseline: 0,
        totalResourceHours: 0,
      });
    }
    const row = groups.get(key);
    row.students += 1;
    if (student.isB2plus) row.b2plusCount += 1;
    if (student.retestFlag) row.retestCount += 1;
    if (Number(student.examCount) >= 2) row.multiExamCount += 1;
    if (student.baselineEnglishScore != null) row.withBaseline += 1;
    row.totalResourceHours += Number(student.totalResourceHours || 0);
  }

  const rows = Array.from(groups.values())
    .map((row) => {
      const growth = growthByGroup.get(row.groupKey) || {};
      return {
        ...row,
        b2plusRate: row.students ? Number((row.b2plusCount / row.students).toFixed(4)) : 0,
        retestRate: row.students ? Number((row.retestCount / row.students).toFixed(4)) : 0,
        avgResourceHours: row.students
          ? Number((row.totalResourceHours / row.students).toFixed(2))
          : 0,
        growthEpisodeCount: growth.growthEpisodeCount || 0,
        avgActualGseGrowth: growth.avgActualGseGrowth ?? null,
        avgAdjustedGseGrowth: growth.avgAdjustedGseGrowth ?? null,
        causalClaimAllowed: false,
      };
    })
    .sort((a, b) => b.students - a.students);

  const skillGrowthSummary = MAIN_SKILLS.map((skill) => {
    const skillEpisodes = growthEpisodes.filter((ep) => ep.skill === skill);
    return {
      skill,
      sampleSize: skillEpisodes.length,
      avgActualGseGrowth: mean(skillEpisodes.map((ep) => ep.actualGseGrowth)),
      avgAdjustedGseGrowth: mean(skillEpisodes.map((ep) => ep.adjustedGseGrowth)),
    };
  }).filter((row) => row.sampleSize > 0);

  return {
    snapshotVersion,
    groupBy,
    filters: query,
    totalStudents: students.length,
    totalGrowthEpisodes: growthEpisodes.length,
    rows,
    participationComparison: buildParticipationComparison(growthEpisodes, students),
    skillGrowthSummary,
    note: '群體比較為描述性統計；「修正後成長」控制起始能力、系所與資料完整度，仍為觀察估計，非因果宣稱。',
  };
}

module.exports = {
  getLearningAnalyticsCohorts,
};
