'use strict';

const { evidenceQualityForStudent } = require('../../learningAnalytics/learningAnalyticsFilterUtils');
const { resolveBaselineCefrBand } = require('../../learningAnalytics/baselineAbilityUtils');
const { inferGse, inferGseFromCefr } = require('../../learningAnalytics/gseScoreMappingService');
const { getLvaConfig } = require('../../learningAnalytics/learningAnalyticsLvaConfigService');
const { LVA_CONFIG_DEFAULTS } = require('../../learningAnalytics/learningAnalyticsLvaDefaults');
const {
  round,
  mean,
  fitOlsRegression,
  predictOls,
  ci95,
} = require('./lvaMathUtils');

const GSE_MAX = 90;
const ADJUSTED_LEGACY = 'baseline_adjusted_simplified';
const ADJUSTED_V2 = 'baseline_adjusted_regression_v2';

const CEFR_ORDINAL = {
  BELOW_A1: 0.5,
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
  UNKNOWN: 2.5,
};

const SKILL_INDEX = ['listening', 'reading', 'speaking', 'writing', 'interaction', 'mediation', 'overall'];

function inferGseScore({ instrument, skill, rawScore, examDate, cefrLevel }) {
  const result = inferGse({
    examType: instrument,
    skill,
    rawScore,
    cefrLevel,
    examDate,
  });
  return result?.isMapped ? result.gse : null;
}

function cefrToGse(cefr) {
  const result = inferGseFromCefr(cefr);
  return result?.isMapped ? result.gse : null;
}

function getStudentBaselineBand(student) {
  return resolveBaselineCefrBand(student) || 'UNKNOWN';
}

function getStudentBaselineGse(student) {
  return cefrToGse(resolveBaselineCefrBand(student));
}

function buildExamById(exams) {
  const map = new Map();
  for (const exam of exams) {
    const id = exam.id ?? exam.examEventId;
    if (id != null) map.set(Number(id), exam);
  }
  return map;
}

function resolveMonthsBetweenTests(exam, examById) {
  const previousId = exam.previousExamEventId;
  if (previousId == null) return null;
  const previous = examById.get(Number(previousId));
  if (!previous?.examDate || !exam.examDate) return null;
  const start = new Date(previous.examDate);
  const end = new Date(exam.examDate);
  const days = (end - start) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(days) || days <= 0) return null;
  return round(days / 30.4375, 2);
}

function qualityScoreForRow(row, cfg) {
  const scores = cfg.evidenceQualityScores || LVA_CONFIG_DEFAULTS.evidenceQualityScores;
  return scores[row.evidenceQuality] ?? scores.low ?? 0.2;
}

function buildAdjustedGrowthEpisodeRows(exams, studentById, examById = buildExamById(exams)) {
  return exams
    .filter((exam) => exam.retestFlag && exam.deltaRawScore != null && exam.previousRawScore != null)
    .map((exam) => {
      const student = studentById.get(exam.studentId) || {};
      const previousGse = inferGseScore({
        instrument: exam.instrument,
        skill: exam.skill,
        rawScore: exam.previousRawScore,
        examDate: exam.examDate,
      });
      const postGse = inferGseScore({
        instrument: exam.instrument,
        skill: exam.skill,
        rawScore: exam.rawScore,
        examDate: exam.examDate,
        cefrLevel: exam.cefrLevel,
      });
      if (previousGse == null || postGse == null) return null;
      const evidenceQuality = evidenceQualityForStudent(student);
      const monthsBetweenTests = resolveMonthsBetweenTests(exam, examById);
      const actualGseGrowth = postGse - previousGse;
      const annualizedGseGrowth = monthsBetweenTests && monthsBetweenTests > 0
        ? round((actualGseGrowth / monthsBetweenTests) * 12, 2)
        : null;
      return {
        studentId: exam.studentId,
        skill: exam.skill || 'unknown',
        instrument: exam.instrument,
        department: student.department || 'UNKNOWN',
        grade: student.grade ?? student.admissionYear ?? null,
        baselineGse: getStudentBaselineGse(student),
        initialCefrBand: getStudentBaselineBand(student),
        evidenceQuality,
        monthsBetweenTests,
        previousGse,
        postGse,
        actualGseGrowth,
        annualizedGseGrowth,
        resourceHoursBeforeExam: round(exam.resourceHoursBeforeExam, 2),
      };
    })
    .filter(Boolean);
}

function pushMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function meanFromMap(map, key) {
  const values = map.get(key) || [];
  return values.length ? mean(values) : null;
}

function expectedGrowthForEpisodeLegacy(row, means) {
  const weights = getLvaConfig().expectedGrowthWeights || LVA_CONFIG_DEFAULTS.expectedGrowthWeights;
  const components = [
    { value: means.global, weight: weights.global },
    { value: meanFromMap(means.bySkill, row.skill), weight: weights.bySkill },
    { value: meanFromMap(means.bySkillBand, `${row.skill}|${row.initialCefrBand}`), weight: weights.bySkillBand },
    { value: meanFromMap(means.bySkillDepartment, `${row.skill}|${row.department}`), weight: weights.bySkillDepartment },
    { value: meanFromMap(means.bySkillQuality, `${row.skill}|${row.evidenceQuality}`), weight: weights.bySkillQuality },
  ].filter((item) => item.value != null);
  const weightTotal = components.reduce((sum, item) => sum + item.weight, 0);
  if (!weightTotal) return 0;
  return components.reduce((sum, item) => sum + (item.value * item.weight), 0) / weightTotal;
}

function buildValueAddedFeatureSpec(rows) {
  const skills = [...new Set(rows.map((row) => row.skill))].sort();
  return {
    skills,
    featureNames: [
      'intercept',
      'baselineGseNorm',
      'monthsBetweenTests',
      'qualityScore',
      'cefrOrdinal',
      ...skills.map((skill) => `skill:${skill}`),
    ],
  };
}

function buildValueAddedFeatureVector(row, spec, cfg) {
  const baselineNorm = row.baselineGse == null ? 0.4 : clamp01(row.baselineGse / GSE_MAX);
  const months = row.monthsBetweenTests == null ? spec.medianMonths ?? 12 : row.monthsBetweenTests;
  const quality = qualityScoreForRow(row, cfg);
  const bandKey = String(row.initialCefrBand || 'UNKNOWN').replace(/\s+/g, '_').toUpperCase();
  const cefrOrdinal = CEFR_ORDINAL[bandKey] ?? CEFR_ORDINAL.UNKNOWN;
  const vector = [
    1,
    baselineNorm,
    months,
    quality,
    cefrOrdinal,
  ];
  for (const skill of spec.skills) {
    vector.push(row.skill === skill ? 1 : 0);
  }
  return vector;
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function fitValueAddedModel(rows) {
  if (rows.length < 8) return null;
  const cfg = getLvaConfig();
  const monthsValues = rows.map((row) => row.monthsBetweenTests).filter((v) => v != null && v > 0);
  const spec = buildValueAddedFeatureSpec(rows);
  spec.medianMonths = monthsValues.length ? mean(monthsValues) : 12;

  const designMatrix = rows.map((row) => buildValueAddedFeatureVector(row, spec, cfg));
  const outcomes = rows.map((row) => row.actualGseGrowth);
  const model = fitOlsRegression(designMatrix, outcomes, { ridge: 1e-4 });
  if (!model) return null;
  return { ...model, spec };
}

function computeAdjustedGrowthEpisodesLegacy(exams, studentById) {
  const examById = buildExamById(exams);
  const rows = buildAdjustedGrowthEpisodeRows(exams, studentById, examById);
  const means = {
    global: mean(rows.map((row) => row.actualGseGrowth)) || 0,
    bySkill: new Map(),
    bySkillBand: new Map(),
    bySkillDepartment: new Map(),
    bySkillQuality: new Map(),
  };

  for (const row of rows) {
    pushMap(means.bySkill, row.skill, row.actualGseGrowth);
    pushMap(means.bySkillBand, `${row.skill}|${row.initialCefrBand}`, row.actualGseGrowth);
    pushMap(means.bySkillDepartment, `${row.skill}|${row.department}`, row.actualGseGrowth);
    pushMap(means.bySkillQuality, `${row.skill}|${row.evidenceQuality}`, row.actualGseGrowth);
  }

  return rows.map((row) => {
    const expectedGseGrowth = expectedGrowthForEpisodeLegacy(row, means);
    return {
      ...row,
      expectedGseGrowth: round(expectedGseGrowth, 2),
      adjustedGseGrowth: round(row.actualGseGrowth - expectedGseGrowth, 2),
      estimateType: ADJUSTED_LEGACY,
      estimateMethod: 'group_weighted_mean',
      causalClaimAllowed: false,
    };
  });
}

function computeAdjustedGrowthEpisodesV2(exams, studentById) {
  const examById = buildExamById(exams);
  const rows = buildAdjustedGrowthEpisodeRows(exams, studentById, examById);
  const model = fitValueAddedModel(rows);
  const cfg = getLvaConfig();

  if (!model) {
    return computeAdjustedGrowthEpisodesLegacy(exams, studentById).map((row) => ({
      ...row,
      estimateType: ADJUSTED_V2,
      estimateMethod: 'group_weighted_mean_fallback',
      fallbackReason: '樣本不足以估計多元回歸，暫以舊版分組加權平均替代。',
      causalClaimAllowed: false,
    }));
  }

  const spec = model.spec;
  return rows.map((row) => {
    const features = buildValueAddedFeatureVector(row, spec, cfg);
    const expectedGseGrowth = predictOls(model, features);
    const safeExpected = Number.isFinite(expectedGseGrowth) ? expectedGseGrowth : 0;
    return {
      ...row,
      expectedGseGrowth: round(safeExpected, 2),
      adjustedGseGrowth: round(row.actualGseGrowth - safeExpected, 2),
      estimateType: ADJUSTED_V2,
      estimateMethod: 'ols_value_added_regression',
      causalClaimAllowed: false,
    };
  });
}

function summarizeAdjustedGrowthByMethod(rows, estimateType, modelVersion, formula, variables) {
  const bySkill = {};
  for (const row of rows) {
    if (!bySkill[row.skill]) bySkill[row.skill] = [];
    bySkill[row.skill].push(row.adjustedGseGrowth);
  }

  const monthsAvailable = rows.filter((row) => row.monthsBetweenTests != null).length;

  return {
    estimateType,
    causalClaimAllowed: false,
    modelVersion,
    variables,
    formula,
    sampleSize: rows.length,
    monthsBetweenTestsCoverage: rows.length ? round(monthsAvailable / rows.length, 4) : 0,
    bySkill: Object.entries(bySkill)
      .map(([skill, values]) => ({
        skill,
        sampleSize: values.length,
        adjustedGseGrowthAverage: round(mean(values), 2),
        confidenceInterval: ci95(values),
        estimateType,
        causalClaimAllowed: false,
      }))
      .sort((a, b) => a.skill.localeCompare(b.skill)),
    sampleEpisodes: rows.slice(0, 200),
  };
}

function summarizeAdjustedGrowthLegacy(exams, studentById) {
  const rows = computeAdjustedGrowthEpisodesLegacy(exams, studentById);
  return summarizeAdjustedGrowthByMethod(
    rows,
    ADJUSTED_LEGACY,
    'eears-lva-2026-v1:adjusted-growth-legacy',
    'adjustedGseGrowth = actualGseGrowth - expectedGseGrowth (group-weighted means)',
    {
      used: ['baselineGse', 'initialCefrBand', 'department', 'evidenceQuality', 'skill'],
      unavailableInReadModel: ['grade'],
      optional: ['monthsBetweenTests'],
    }
  );
}

function summarizeAdjustedGrowthV2(exams, studentById) {
  const rows = computeAdjustedGrowthEpisodesV2(exams, studentById);
  const usedFallback = rows.some((row) => row.estimateMethod === 'group_weighted_mean_fallback');
  return summarizeAdjustedGrowthByMethod(
    rows,
    ADJUSTED_V2,
    usedFallback
      ? 'eears-lva-2026-v1:adjusted-growth-v2-fallback'
      : 'eears-lva-2026-v1:adjusted-growth-v2-regression',
    'adjustedGseGrowth = actualGseGrowth - ŷ_OLS(baselineGse, monthsBetweenTests, quality, CEFR band, skill)',
    {
      used: ['baselineGse', 'monthsBetweenTests', 'evidenceQuality', 'initialCefrBand', 'skill'],
      unavailableInReadModel: ['grade'],
      note: 'monthsBetweenTests 由 previousExamEventId 對照前次測驗日期推算。',
    }
  );
}

module.exports = {
  ADJUSTED_LEGACY,
  ADJUSTED_V2,
  buildExamById,
  resolveMonthsBetweenTests,
  buildAdjustedGrowthEpisodeRows,
  computeAdjustedGrowthEpisodesLegacy,
  computeAdjustedGrowthEpisodesV2,
  summarizeAdjustedGrowthLegacy,
  summarizeAdjustedGrowthV2,
  SKILL_INDEX,
};
