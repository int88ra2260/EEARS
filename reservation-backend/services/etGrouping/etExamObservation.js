'use strict';

const { inferGse } = require('../learningAnalytics/gseScoreMappingService');

/** 與學習成效細項分析相同：可計算成長少於 10 人不顯示進步人數。 */
const MIN_GROWTH_SAMPLE = 10;
const GSE_RESOLUTION_RAW_FLOOR = 5;
const GSE_RESOLUTION_GSE_ABS_MAX = 0.5;

const OBSERVATION_DISCLAIMER = '任務完成、分組當下的 GSE 快照、以及同測原始分變化是並列觀察，不代表 English Table 造成進步。GSE 不是官方英檢成績。';

const READING_GUIDE = Object.freeze([
  '場次成效是 Leader 勾選的任務完成率，只計已簽到學生的必填任務。',
  '能力快照是分組當下的 CEFR · GSE，不是官方英檢成績。',
  '英檢變化沿用學習成效分析：只配對同一測驗，以原始分差為主、GSE 為輔。',
  '口說練習只比較同一題的會前與活動後：有沒有多說出理由或例子，並連到句庫的說法。不計入任務完成率。',
  '以上並列觀察，不解釋成參加 English Table 造成進步，也不用來排名 Leader。',
]);

const OFFERINGS_ACTIVITY_PATH = '/admin/learning-analytics/offerings?dimension=activity';

function round1(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function mean(values) {
  const nums = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return round1(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

function dateKey(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function mappedGse(input) {
  const result = inferGse(input);
  return result?.isMapped ? Number(result.gse) : null;
}

function pairGseDelta(exam, previous) {
  const pre = mappedGse({
    examType: exam.instrument,
    skill: exam.skill,
    rawScore: exam.previousRawScore,
    examDate: previous?.examDate || exam.examDate,
    cefrLevel: previous?.cefrLevel || null,
  });
  const post = mappedGse({
    examType: exam.instrument,
    skill: exam.skill,
    rawScore: exam.rawScore,
    examDate: exam.examDate,
    cefrLevel: exam.cefrLevel,
  });
  if (pre == null || post == null) return null;
  return round1(post - pre);
}

function detectResolutionWarning(avgRaw, avgGse) {
  if (avgRaw == null || !Number.isFinite(Number(avgRaw))) {
    return null;
  }
  if (Math.abs(Number(avgRaw)) < GSE_RESOLUTION_RAW_FLOOR) return null;
  if (avgGse == null || !Number.isFinite(Number(avgGse))) {
    return {
      code: 'gse_unmapped',
      reason: '原始分有明顯變化，但這組成績換不成 GSE。同測請以原始分為準。',
    };
  }
  if (Math.abs(Number(avgGse)) <= GSE_RESOLUTION_GSE_ABS_MAX) {
    return {
      code: 'gse_resolution_low',
      reason: '原始分有明顯變化，但 GSE 幾乎不動。同測錨點較粗時會這樣，不代表沒進步。',
    };
  }
  return null;
}

function listExamPairs(exams = []) {
  const byId = new Map();
  for (const exam of exams) {
    if (exam?.id != null) byId.set(Number(exam.id), exam);
    if (exam?.examEventId != null) byId.set(Number(exam.examEventId), exam);
  }

  const pairs = [];
  for (const exam of exams) {
    if (!exam?.retestFlag || exam.deltaRawScore == null) continue;
    const rawDelta = round1(exam.deltaRawScore);
    if (rawDelta == null) continue;
    const previous = exam.previousExamEventId != null
      ? byId.get(Number(exam.previousExamEventId))
      : null;
    pairs.push({
      instrument: exam.instrument || null,
      skill: exam.skill || null,
      preDate: dateKey(previous?.examDate) || null,
      postDate: dateKey(exam.examDate) || null,
      rawDelta,
      gseDelta: pairGseDelta(exam, previous),
    });
  }
  return pairs;
}

function emptyExamSummary() {
  return {
    hasGrowth: false,
    pairCount: 0,
    avgRawDelta: null,
    avgGseDelta: null,
    preDate: null,
    postDate: null,
    improved: false,
    resolutionWarning: null,
    pairs: [],
  };
}

function summarizeStudentExams(exams = []) {
  const pairs = listExamPairs(exams);
  if (!pairs.length) return emptyExamSummary();

  const dated = pairs.filter((pair) => pair.preDate && pair.postDate);
  const preDates = dated.map((pair) => pair.preDate).sort();
  const postDates = dated.map((pair) => pair.postDate).sort();
  const avgRawDelta = mean(pairs.map((pair) => pair.rawDelta));
  const avgGseDelta = mean(pairs.map((pair) => pair.gseDelta));

  return {
    hasGrowth: true,
    pairCount: pairs.length,
    avgRawDelta,
    avgGseDelta,
    preDate: preDates[0] || null,
    postDate: postDates[postDates.length - 1] || null,
    improved: avgRawDelta != null && avgRawDelta > 0,
    resolutionWarning: detectResolutionWarning(avgRawDelta, avgGseDelta),
    pairs,
  };
}

function classifySessionTiming(sessionDate, summary) {
  if (!summary?.hasGrowth) {
    return { code: 'no_exam', label: '無可計算前後測' };
  }
  const date = dateKey(sessionDate);
  const dated = (summary.pairs || []).filter((pair) => pair.preDate && pair.postDate);
  if (!date || !dated.length) {
    return { code: 'undated', label: '有前後測但日期不足' };
  }
  if (dated.some((pair) => date >= pair.preDate && date <= pair.postDate)) {
    return { code: 'between', label: '兩次考試之間' };
  }
  const pre = [...dated.map((pair) => pair.preDate)].sort()[0];
  const post = [...dated.map((pair) => pair.postDate)].sort().pop();
  if (date < pre) return { code: 'before_pre', label: '前測前' };
  if (date > post) return { code: 'after_post', label: '後測後' };
  return { code: 'between_gap', label: '多段考試的空檔' };
}

function summarizeEventExamCoverage(studentSummaries = [], { minSample = MIN_GROWTH_SAMPLE } = {}) {
  const withGrowth = studentSummaries.filter((row) => row?.hasGrowth);
  const privacySuppressed = withGrowth.length < minSample;
  const improved = withGrowth.filter((row) => Number(row.avgRawDelta) > 0).length;
  return {
    growthSampleSize: withGrowth.length,
    improvedStudentCount: privacySuppressed ? null : improved,
    privacySuppressed,
    minGrowthSample: minSample,
    offeringsPath: OFFERINGS_ACTIVITY_PATH,
  };
}

module.exports = {
  MIN_GROWTH_SAMPLE,
  OBSERVATION_DISCLAIMER,
  READING_GUIDE,
  OFFERINGS_ACTIVITY_PATH,
  listExamPairs,
  summarizeStudentExams,
  classifySessionTiming,
  summarizeEventExamCoverage,
  detectResolutionWarning,
};
