'use strict';

const { resolveBaselineCefrBand } = require('./baselineAbilityUtils');
const { parseGradeNumber } = require('./kpiPopulationUtils');

const GRADE_LABELS = { 1: '大一', 2: '大二', 3: '大三', 4: '大四', 5: '大五', 6: '大六', 7: '大七' };
const MISSING_GRADE = '缺年級';

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

function resolveGroupKey(student, groupBy) {
  if (groupBy === 'baselineCefr') {
    return resolveBaselineCefrBand(student) || '未分類';
  }
  return String(student[groupBy] || '未分類').trim() || '未分類';
}

function isParticipated(student) {
  const level = String(student.exposureLevel || '').toLowerCase();
  return level === 'medium' || level === 'high';
}

function emptyCoverageRow(groupKey) {
  return {
    groupKey,
    students: 0,
    b2plusCount: 0,
    retestCount: 0,
    multiExamCount: 0,
    withExamCount: 0,
    withBaseline: 0,
    totalResourceHours: 0,
  };
}

function accumulateCohortCoverage(students, groupBy) {
  const groups = new Map();
  for (const student of students || []) {
    const key = resolveGroupKey(student, groupBy);
    if (!groups.has(key)) groups.set(key, emptyCoverageRow(key));
    const row = groups.get(key);
    row.students += 1;
    if (student.isB2plus) row.b2plusCount += 1;
    if (student.retestFlag) row.retestCount += 1;
    if (Number(student.examCount) >= 2) row.multiExamCount += 1;
    if (student.hasValidExam) row.withExamCount += 1;
    if (student.baselineEnglishScore != null) row.withBaseline += 1;
    row.totalResourceHours += Number(student.totalResourceHours || 0);
  }
  return groups;
}

function normalizeStudentId(value) {
  return String(value || '').trim().toUpperCase();
}

function gradeBand(raw) {
  const gradeNo = parseGradeNumber(raw);
  if (gradeNo == null) return { grade: MISSING_GRADE, gradeNo: null };
  return { grade: GRADE_LABELS[gradeNo] || `大${gradeNo}`, gradeNo };
}

function buildGroupGradeBreakdowns(students, groupBy, gradeByStudentId) {
  if (groupBy !== 'department' && groupBy !== 'college') return new Map();
  const byParent = new Map();
  for (const student of students || []) {
    const parent = resolveGroupKey(student, groupBy);
    const band = gradeBand(gradeByStudentId?.get?.(normalizeStudentId(student.studentId)));
    if (!byParent.has(parent)) byParent.set(parent, new Map());
    const grades = byParent.get(parent);
    if (!grades.has(band.grade)) {
      grades.set(band.grade, { ...emptyCoverageRow(band.grade), gradeNo: band.gradeNo });
    }
    const row = grades.get(band.grade);
    row.students += 1;
    if (student.isB2plus) row.b2plusCount += 1;
    if (student.hasValidExam) row.withExamCount += 1;
  }
  const result = new Map();
  for (const [parent, grades] of byParent) {
    result.set(parent, [...grades.values()]
      .map((row) => ({
        grade: row.groupKey,
        gradeNo: row.gradeNo,
        students: row.students,
        withExamCount: row.withExamCount,
        withoutExamCount: row.students - row.withExamCount,
        b2plusCount: row.b2plusCount,
      }))
      .sort((left, right) => {
        if (left.gradeNo == null && right.gradeNo == null) return 0;
        if (left.gradeNo == null) return 1;
        if (right.gradeNo == null) return -1;
        return left.gradeNo - right.gradeNo;
      }));
  }
  return result;
}

function aggregateGrowthByGroup(episodes, studentById, groupBy) {
  const buckets = new Map();
  for (const episode of episodes) {
    const student = studentById.get(episode.studentId);
    if (!student) continue;
    const key = resolveGroupKey(student, groupBy);
    if (!buckets.has(key)) {
      buckets.set(key, { actual: [], adjusted: [] });
    }
    const bucket = buckets.get(key);
    bucket.actual.push(episode.actualGseGrowth);
    bucket.adjusted.push(episode.adjustedGseGrowth);
  }
  const result = new Map();
  for (const [key, bucket] of buckets.entries()) {
    result.set(key, {
      growthEpisodeCount: bucket.actual.length,
      avgActualGseGrowth: mean(bucket.actual),
      avgAdjustedGseGrowth: mean(bucket.adjusted),
    });
  }
  return result;
}

function buildParticipationComparison(episodes, students) {
  const participatedIds = new Set(students.filter(isParticipated).map((s) => s.studentId));
  const notParticipatedIds = new Set(
    students.filter((s) => !participatedIds.has(s.studentId)).map((s) => s.studentId)
  );

  const buckets = {
    participated: { label: '中高參與（≥10 小時）', actual: [], adjusted: [], students: participatedIds.size },
    notParticipated: { label: '低／無參與', actual: [], adjusted: [], students: notParticipatedIds.size },
  };

  for (const episode of episodes) {
    if (participatedIds.has(episode.studentId)) {
      buckets.participated.actual.push(episode.actualGseGrowth);
      buckets.participated.adjusted.push(episode.adjustedGseGrowth);
    } else if (notParticipatedIds.has(episode.studentId)) {
      buckets.notParticipated.actual.push(episode.actualGseGrowth);
      buckets.notParticipated.adjusted.push(episode.adjustedGseGrowth);
    }
  }

  return Object.entries(buckets).map(([key, bucket]) => ({
    key,
    label: bucket.label,
    students: bucket.students,
    growthEpisodeCount: bucket.actual.length,
    avgActualGseGrowth: mean(bucket.actual),
    avgAdjustedGseGrowth: mean(bucket.adjusted),
    causalClaimAllowed: false,
  }));
}

module.exports = {
  round,
  mean,
  resolveGroupKey,
  isParticipated,
  accumulateCohortCoverage,
  buildGroupGradeBreakdowns,
  aggregateGrowthByGroup,
  buildParticipationComparison,
};
