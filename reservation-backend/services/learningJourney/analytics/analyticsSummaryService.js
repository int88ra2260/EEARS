'use strict';

const { LjAnalyticStudent, LjAnalyticExam } = require('../../../models');
const { resolveLatestSnapshotVersion } = require('./timelineReadService');
const {
  buildStudentWhere,
  buildExamWhere,
  applyEvidenceQualityFilter,
} = require('../../learningAnalytics/learningAnalyticsFilterUtils');

async function getAnalyticsSummary(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const where = buildStudentWhere(query, snapshotVersion);

  let students = await LjAnalyticStudent.findAll({ where, attributes: [
    'studentId', 'cohort', 'retestFlag', 'isB2plus', 'exposureLevel',
    'hasValidExam', 'examCount', 'baselineEnglishScore', 'totalResourceHours',
  ] });
  students = applyEvidenceQualityFilter(students, query);

  const total = students.length;
  const b2plusCount = students.filter((s) => s.isB2plus).length;
  const retestCount = students.filter((s) => s.retestFlag).length;
  const singleExamCount = students.filter((s) => s.hasValidExam && Number(s.examCount) <= 1).length;
  const multiExamCount = students.filter((s) => Number(s.examCount) >= 2).length;
  const withBaseline = students.filter((s) => s.baselineEnglishScore != null).length;

  const exposureDist = { none: 0, low: 0, medium: 0, high: 0, unknown: 0 };
  for (const s of students) {
    const key = s.exposureLevel || 'unknown';
    exposureDist[key] = (exposureDist[key] || 0) + 1;
  }

  const cohortDist = {};
  for (const s of students) {
    const c = s.cohort || '未知';
    cohortDist[c] = (cohortDist[c] || 0) + 1;
  }

  const studentIds = students.map((s) => s.studentId);
  const exams = await LjAnalyticExam.findAll({
    where: buildExamWhere(query, snapshotVersion, studentIds),
    attributes: ['improvedFlag', 'retestFlag', 'registeredNoScoreFlag', 'skill', 'instrument'],
  });

  const improvedCount = exams.filter((e) => e.improvedFlag === true).length;
  const noScoreCount = exams.filter((e) => e.registeredNoScoreFlag).length;

  const skillDist = { listening: 0, reading: 0, speaking: 0, writing: 0 };
  for (const e of exams) {
    if (skillDist[e.skill] != null) skillDist[e.skill] += 1;
  }

  return {
    snapshotVersion,
    filters: query,
    totals: {
      students: total,
      exams: exams.length,
      withBaseline,
      b2plusCount,
      b2plusRate: total ? Number((b2plusCount / total).toFixed(4)) : 0,
      retestStudents: retestCount,
      retestRate: total ? Number((retestCount / total).toFixed(4)) : 0,
      singleExamStudents: singleExamCount,
      multiExamStudents: multiExamCount,
      improvedExamRows: improvedCount,
      registeredNoScoreRows: noScoreCount,
    },
    distributions: {
      exposure: exposureDist,
      cohort: cohortDist,
      examSkills: skillDist,
    },
    notes: [
      '單次英檢學生無法計算個人 true gain；請分開呈現 singleExam 與 multiExam 子群。',
      'improvedExamRows 僅適用於同工具同技能之 retest 子群。',
    ],
  };
}

module.exports = {
  getAnalyticsSummary,
};
