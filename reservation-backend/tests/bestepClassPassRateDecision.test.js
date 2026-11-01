'use strict';

const fs = require('fs');
const path = require('path');
const { computeClassBestepExportSummary } = require('../services/bestepClassService');

const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

/**
 * 尚未核准的試算。只供決策比較，不供正式 service 呼叫。
 * 假設：核准抵免不會被自動當成四科通過。分母為 0 時回傳 null，不回傳 0。
 */
function candidateRate(numerator, denominator) {
  if (!denominator) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function hasCompleteFourSkillLevels(score) {
  if (!score) return false;
  return ['listeningLevel', 'readingLevel', 'speakingLevel', 'writingLevel']
    .every((level) => CEFR_LEVELS.has(score[level]));
}

function isDomesticSuccess(student) {
  const status = student.personalRegistration && student.personalRegistration.status;
  return student.isDomesticForStats === true
    && (status === 'success' || status === 'registered_success');
}

function legacyPassRate(students) {
  const summary = computeClassBestepExportSummary(students);
  const passedCount = students.filter((student) => student.score && student.score.passed).length;
  const passRate = summary.registeredCount > 0
    ? Number(((passedCount / summary.registeredCount) * 100).toFixed(2))
    : 0;
  return {
    passedCount,
    registeredCount: summary.registeredCount,
    domesticStudentCount: summary.enrolledCount,
    passRate,
  };
}

function optionA(students) {
  const population = students.filter(isDomesticSuccess);
  const numerator = population.filter((student) => student.score && student.score.passed).length;
  return { numerator, denominator: population.length, rate: candidateRate(numerator, population.length) };
}

function optionB(students) {
  const population = students.filter((student) => student.isDomesticForStats);
  const numerator = population.filter((student) => student.score && student.score.passed).length;
  return { numerator, denominator: population.length, rate: candidateRate(numerator, population.length) };
}

function optionC(students) {
  const population = students.filter((student) => hasCompleteFourSkillLevels(student.score));
  const numerator = population.filter((student) => student.score.passed === true).length;
  return { numerator, denominator: population.length, rate: candidateRate(numerator, population.length) };
}

function member({
  domestic,
  status,
  passed,
  levels,
  exemption = null,
}) {
  const score = passed == null && !levels
    ? null
    : {
      passed: passed === true,
      listeningLevel: levels ? levels[0] : null,
      readingLevel: levels ? levels[1] : null,
      speakingLevel: levels ? levels[2] : null,
      writingLevel: levels ? levels[3] : null,
    };
  return {
    isDomesticForStats: domestic,
    personalRegistration: status ? {
      status,
      examType: 'LRSW',
      exemption_review_status: exemption,
      exemptionVerifiedType: exemption === 'approved' ? 'LRSW' : null,
    } : null,
    attendance: { L: { attended: null } },
    score,
  };
}

describe('BESTEP pass-rate decision comparison', () => {
  test('keeps the live formula and does not treat candidate rates as production output', () => {
    const source = fs.readFileSync(path.join(__dirname, '../services/bestepClassService.js'), 'utf8');
    expect(source).toContain(
      'const passedCount = allStudents.filter((s) => s.score && s.score.passed).length;'
    );
    expect(source).toContain('(passedCount / summary.registeredCount) * 100');
    expect(source).toContain('domesticStudentCount: summary.enrolledCount');
    expect(source).not.toContain('candidateRate');
    expect(source).not.toContain('optionA');
  });

  test('compares one mixed class without approving a definition', () => {
    const students = [
      member({ domestic: true, status: 'success', passed: true, levels: ['B2', 'B2', 'B2', 'B2'] }),
      member({ domestic: true, status: 'success', passed: false, levels: ['B2', 'B2', 'B1', 'B2'] }),
      member({ domestic: true, status: 'success', passed: false, levels: ['B2', 'B2', 'B2', null] }),
      member({ domestic: true, status: 'failed', passed: true, levels: ['C1', 'B2', 'B2', 'B2'] }),
      member({ domestic: false, status: 'success', passed: true, levels: ['B2', 'C1', 'B2', 'B2'] }),
      member({ domestic: true, status: 'not_registered', passed: true, levels: ['B2', 'B2', 'B2', 'C2'] }),
      member({ domestic: true, status: 'success', passed: false, levels: null, exemption: 'approved' }),
      member({ domestic: true, status: null, passed: null, levels: null }),
    ];
    const legacy = legacyPassRate(students);
    expect(legacy).toEqual({
      passedCount: 4,
      registeredCount: 4,
      domesticStudentCount: 7,
      passRate: 100,
    });
    expect(optionA(students)).toEqual({ numerator: 1, denominator: 4, rate: 25 });
    expect(optionB(students)).toEqual({ numerator: 3, denominator: 7, rate: 42.86 });
    expect(optionC(students)).toEqual({ numerator: 4, denominator: 5, rate: 80 });
  });

  test('reproduces the legacy 50 percent, 150 percent, and zero-denominator cases', () => {
    const aligned = [
      member({ domestic: true, status: 'success', passed: true, levels: ['B2', 'B2', 'B2', 'B2'] }),
      member({ domestic: true, status: 'success', passed: false, levels: ['B1', 'B1', 'B1', 'B1'] }),
    ];
    expect(legacyPassRate(aligned).passRate).toBe(50);
    expect(optionA(aligned).rate).toBe(50);
    expect(optionB(aligned).rate).toBe(50);
    expect(optionC(aligned).rate).toBe(50);

    const mismatched = [
      member({ domestic: true, status: 'success', passed: true, levels: ['B2', 'B2', 'B2', 'B2'] }),
      member({ domestic: true, status: 'success', passed: false, levels: ['B1', 'B2', 'B2', 'B2'] }),
      member({ domestic: true, status: 'failed', passed: true, levels: ['B2', 'B2', 'B2', 'B2'] }),
      member({ domestic: false, status: 'success', passed: true, levels: ['C1', 'B2', 'B2', 'B2'] }),
    ];
    expect(legacyPassRate(mismatched)).toMatchObject({
      passedCount: 3,
      registeredCount: 2,
      passRate: 150,
    });
    expect(optionA(mismatched)).toEqual({ numerator: 1, denominator: 2, rate: 50 });
    expect(optionB(mismatched)).toEqual({ numerator: 2, denominator: 3, rate: 66.67 });
    expect(optionC(mismatched)).toEqual({ numerator: 3, denominator: 4, rate: 75 });

    const zeroDenominator = [
      member({ domestic: false, status: 'success', passed: true, levels: ['B2', 'B2', 'B2', 'B2'] }),
    ];
    expect(legacyPassRate(zeroDenominator)).toMatchObject({
      passedCount: 1,
      registeredCount: 0,
      passRate: 0,
    });
    expect(optionA(zeroDenominator).rate).toBeNull();
    expect(optionB(zeroDenominator).rate).toBeNull();
    expect(optionC(zeroDenominator)).toEqual({ numerator: 1, denominator: 1, rate: 100 });
  });
});
