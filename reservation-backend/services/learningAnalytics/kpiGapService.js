'use strict';

const { runKpiReport } = require('./kpiReportService');

/**
 * 缺口定義（與 KPI 同分母／同達標規則）：
 * - notAttained：任一官方達標單元未通過
 * - noExam：有效考試場次數 = 0
 * - missingRetest：有效考試場次數 = 1（有基線、無法算成長／缺重測）
 *
 * 注意：缺重測以 EtExamAttempt（政策 evidence 時間窗內）場次數為準，
 * 不是分析快照 LjAnalyticStudent.retestFlag。
 */

function classifyStudentGap(row, dimensions = []) {
  const validAttemptCount = Number(row.validAttemptCount);
  const attemptCount = Number.isFinite(validAttemptCount) ? validAttemptCount : 0;
  const failedDimensions = dimensions
    .filter((dim) => !row.dimensions?.[dim.id]?.passed)
    .map((dim) => ({ id: dim.id, label: dim.label || dim.id }));

  const allPassed = failedDimensions.length === 0;
  const flags = {
    noExam: attemptCount === 0,
    missingRetest: attemptCount === 1,
    notAttained: !allPassed,
    allPassed,
  };

  return {
    studentId: row.studentId,
    grade: row.grade ?? null,
    gradeNo: row.gradeNo ?? null,
    department: row.department ?? null,
    validAttemptCount: attemptCount,
    failedDimensions,
    failedDimensionIds: failedDimensions.map((d) => d.id),
    flags,
    dimensions: row.dimensions || {},
    skillBreakdown: row.skillBreakdown ?? null,
  };
}

function buildGapSummary(classified, dimensions, totalStudents) {
  const byDimension = {};
  for (const dim of dimensions) {
    byDimension[dim.id] = {
      id: dim.id,
      label: dim.label,
      notAttainedCount: 0,
      rate: 0,
    };
  }

  let notAttained = 0;
  let noExam = 0;
  let missingRetest = 0;
  let allPassed = 0;

  for (const row of classified) {
    if (row.flags.notAttained) notAttained += 1;
    if (row.flags.noExam) noExam += 1;
    if (row.flags.missingRetest) missingRetest += 1;
    if (row.flags.allPassed) allPassed += 1;
    for (const dim of row.failedDimensions) {
      if (byDimension[dim.id]) byDimension[dim.id].notAttainedCount += 1;
    }
  }

  const denom = totalStudents || 0;
  const rate = (n) => (denom ? Number((n / denom).toFixed(4)) : 0);
  for (const cell of Object.values(byDimension)) {
    cell.rate = rate(cell.notAttainedCount);
  }

  return {
    totalStudents: denom,
    notAttainedCount: notAttained,
    notAttainedRate: rate(notAttained),
    noExamCount: noExam,
    noExamRate: rate(noExam),
    missingRetestCount: missingRetest,
    missingRetestRate: rate(missingRetest),
    allPassedCount: allPassed,
    allPassedRate: rate(allPassed),
    byDimension: Object.values(byDimension),
  };
}

/**
 * @param {object} input same as runKpiReport
 * @param {{ includeRows?: boolean }} [options]
 */
async function runKpiGapReport(input = {}, options = {}) {
  const includeRows = options.includeRows !== false && input.includeRows !== false;
  const report = await runKpiReport({ ...input, includeRows: true });
  const dimensions = report.summary?.dimensions || [];
  const classified = (report.rows || []).map((row) => classifyStudentGap(row, dimensions));
  const summary = buildGapSummary(classified, dimensions, report.population?.totalStudents || 0);

  const lists = {
    notAttained: classified.filter((r) => r.flags.notAttained),
    missingRetest: classified.filter((r) => r.flags.missingRetest),
    noExam: classified.filter((r) => r.flags.noExam),
  };

  return {
    generatedAt: report.generatedAt,
    policy: report.policy,
    population: report.population,
    evidenceWindow: report.evidenceWindow,
    kpiSummary: report.summary,
    definitionSnapshot: report.definitionSnapshot,
    gaps: {
      definitions: {
        notAttained: '任一官方達標單元未通過（與 KPI 報表同分母、同規則）',
        noExam: '政策成績時間窗內有效考試場次數為 0',
        missingRetest: '政策成績時間窗內有效考試場次數為 1（有基線、缺可算成長的重測）',
        source: 'et_exam_attempts（非分析快照 retest_flag）',
      },
      summary,
      lists: includeRows ? lists : undefined,
    },
    rows: includeRows ? classified : undefined,
  };
}

module.exports = {
  classifyStudentGap,
  buildGapSummary,
  runKpiGapReport,
};
