'use strict';

const { Op } = require('sequelize');
const { LjAnalyticStudent, LjAnalyticExam, LjStudentEvent } = require('../../../models');
const { resolveLatestSnapshotVersion } = require('./timelineReadService');
const {
  parseList,
  buildStudentWhere,
  buildExamWhere,
  applyEvidenceQualityFilter,
  evidenceQualityForStudent,
} = require('../../learningAnalytics/learningAnalyticsFilterUtils');
const {
  RESOURCE_SKILL_PROFILE_DEFAULTS,
  ensureResourceSkillProfilesLoaded,
  getResourceSkillProfilesMap,
} = require('../../learningAnalytics/resourceSkillProfileService');
const { normalizeCefrKey } = require('../../learningAnalytics/learningAnalyticsCefrUtils');
const {
  GSE_MIN,
  GSE_MAX,
  GSE_CEFR_SUMMARY,
  inferGse,
  inferGseFromCefr,
} = require('../../learningAnalytics/gseScoreMappingService');
const {
  ensureLvaConfigLoaded,
  getLvaConfig,
} = require('../../learningAnalytics/learningAnalyticsLvaConfigService');
const { LVA_CONFIG_DEFAULTS } = require('../../learningAnalytics/learningAnalyticsLvaDefaults');
const { getMethodComparisonPayload } = require('../../learningAnalytics/learningAnalyticsMethodComparison');
const { mapEwlEventNameToResourceType } = require('../../learningAnalytics/ewlResourceTypes');
const {
  summarizeAdjustedGrowthLegacy,
  summarizeAdjustedGrowthV2,
  computeAdjustedGrowthEpisodesLegacy,
  computeAdjustedGrowthEpisodesV2,
} = require('./lvaAdjustedGrowthService');
const {
  propensityLikeScoreLegacy,
  summarizeQuasiCausalEstimatesLegacy,
  summarizeQuasiCausalEstimatesV2,
  summarizePropensityWeightedEstimatesLegacy,
  summarizePropensityWeightedEstimatesV2,
  summarizeAipwEstimates,
} = require('./lvaPropensityService');

const LVA_VERSION = 'eears-lva-2026-v1';
const LVA_CONTRACT_VERSION = 'lva.analytics.response.v1';
const DESCRIPTIVE_ESTIMATE = 'descriptive';
const ADJUSTED_ESTIMATE = 'baseline_adjusted_regression_v2';
const ADJUSTED_ESTIMATE_LEGACY = 'baseline_adjusted_simplified';
const MATCHED_ESTIMATE = 'propensity_matched_logistic_v2';
const MATCHED_ESTIMATE_LEGACY = 'propensity_matched_observational';
const WEIGHTED_ESTIMATE = 'propensity_weighted_logistic_v2';
const WEIGHTED_ESTIMATE_LEGACY = 'propensity_weighted_observational';
const AIPW_ESTIMATE = 'aipw_doubly_robust_v2';
const DEFAULT_MATCHING_CALIPER = LVA_CONFIG_DEFAULTS.matchingCaliper;

const SKILLS = ['listening', 'reading', 'speaking', 'writing', 'interaction', 'mediation', 'overall'];

const RESOURCE_SKILL_PROFILES = RESOURCE_SKILL_PROFILE_DEFAULTS;

function n(v) {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

function round(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const p = 10 ** digits;
  return Math.round(num * p) / p;
}

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function ci95(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (nums.length < 2) return { low: null, high: null };
  const avg = mean(nums);
  const variance = nums.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (nums.length - 1);
  const se = Math.sqrt(variance) / Math.sqrt(nums.length);
  return { low: round(avg - (1.96 * se), 2), high: round(avg + (1.96 * se), 2) };
}

function normalizeCefr(cefr) {
  return normalizeCefrKey(cefr);
}

function cefrToGse(cefr) {
  const result = inferGseFromCefr(cefr);
  return result?.isMapped ? result.gse : null;
}

function inferGseScore({ instrument, skill, rawScore, examDate, cefrLevel, level }) {
  const result = inferGse({
    examType: instrument,
    skill,
    rawScore,
    level,
    cefrLevel,
    examDate,
  });
  return result?.isMapped ? result.gse : null;
}

function resourceKeyForEvent(event) {
  const title = `${event.title || ''} ${event.subtitle || ''} ${event.sourceSystem || ''}`.toLowerCase();
  const payload = event.rawPayload && typeof event.rawPayload === 'object' ? event.rawPayload : {};
  const explicit = String(payload.resourceType || payload.category || payload.type || '').toUpperCase();
  if (explicit && getResourceSkillProfilesMap()[explicit]) return explicit;
  const ewlFromTitle = mapEwlEventNameToResourceType(event.title);
  if (ewlFromTitle && getResourceSkillProfilesMap()[ewlFromTitle]) return ewlFromTitle;
  if (/english\s*table|英語桌|英語餐桌/i.test(title)) return 'ENGLISH_TABLE';
  if (/english\s*club|英語俱樂部/i.test(title)) return 'ENGLISH_CLUB';
  if (/job\s*talk|職涯|就業/i.test(title)) return 'JOB_TALK';
  if (/international\s*forum|forum|國際論壇/i.test(title)) return 'INTERNATIONAL_FORUM';
  if (/\beap\b|academic|學術英文/i.test(title)) return 'EAP';
  if (/\besp\b|professional|職場英文|專業英文/i.test(title)) return 'ESP';
  if (/通識|general english|\bge\b/i.test(title)) return 'GE';
  return event.eventType === 'course_event' ? 'COURSE_OTHER' : 'ACTIVITY_OTHER';
}

function qualityWeight(level) {
  const weights = getLvaConfig().qualityWeights || LVA_CONFIG_DEFAULTS.qualityWeights;
  return weights[level] ?? weights.low ?? 0.25;
}

function normalizeAppliedFilters(query = {}) {
  const keys = [
    'snapshot_version', 'snapshotVersion', 'cohort', 'college', 'department', 'admission_type',
    'exposure_level', 'baseline_level', 'is_overseas_student', 'has_valid_exam', 'retest_flag',
    'is_b2plus', 'instrument', 'skill', 'status', 'resource_type', 'include_reason_code',
    'exclude_reason_code', 'evidence_quality', 'matching_caliper',
  ];
  return keys.reduce((acc, key) => {
    if (query[key] != null && query[key] !== '') acc[key] = query[key];
    return acc;
  }, {});
}

function estimatePolicy() {
  return {
    causalClaimAllowed: false,
    activeMethods: getMethodComparisonPayload().activeMethods,
    estimateTypes: {
      descriptive: '描述性趨勢，未控制選擇偏誤。',
      baseline_adjusted_simplified: '舊版：分組加權平均修正成長（legacy 對照）。',
      baseline_adjusted_regression_v2: '新版：OLS value-added 修正成長；含 monthsBetweenTests。',
      propensity_matched_observational: '舊版：啟發式 propensity-like score 配對（legacy 對照）。',
      propensity_matched_logistic_v2: '新版：logistic PS + Austin caliper 配對。',
      propensity_weighted_observational: '舊版：啟發式 PS 的 IPW（legacy 對照）。',
      propensity_weighted_logistic_v2: '新版：logistic PS 的 stabilized IPW。',
      aipw_doubly_robust_v2: '新版：AIPW doubly robust 輔助估計；請與 matching/IPW 交叉比對。',
    },
  };
}

function supportedFilters() {
  return {
    student: ['student_id', 'cohort', 'college', 'department', 'admission_type', 'baseline_level', 'exposure_level', 'is_overseas_student', 'has_valid_exam', 'retest_flag', 'is_b2plus'],
    exam: ['instrument', 'skill', 'status', 'improved_flag', 'exposure_before_exam_flag'],
    resource: ['resource_type'],
    exclusion: ['include_reason_code', 'exclude_reason_code'],
    quality: ['evidence_quality'],
  };
}

function summarizeGseCoverage(students) {
  const quality = { high: 0, medium: 0, medium_low: 0, low: 0 };
  for (const student of students) {
    quality[evidenceQualityForStudent(student)] += 1;
  }
  return {
    scale: { min: GSE_MIN, max: GSE_MAX, cefrBands: GSE_CEFR_SUMMARY },
    note: 'GSE（Global Scale of English）為 Pearson 對齊 CEFR 的能力量尺（10–90），用於跨測驗比較與成長分析；對外仍以 CEFR 顯示，不等於官方認證分數。',
    evidenceQuality: quality,
    estimateType: DESCRIPTIVE_ESTIMATE,
    causalClaimAllowed: false,
  };
}

function summarizeSkillExposure(events) {
  const byResource = {};
  const bySkill = Object.fromEntries(SKILLS.map((skill) => [skill, 0]));

  for (const event of events) {
    const key = resourceKeyForEvent(event);
    const hours = n(event.hours) || 1;
    const profiles = getResourceSkillProfilesMap();
    const profile = profiles[key] || profiles.ACTIVITY_OTHER;
    if (!byResource[key]) {
      byResource[key] = {
        resourceType: key,
        events: 0,
        hours: 0,
        skillExposure: Object.fromEntries(SKILLS.map((skill) => [skill, 0])),
        profile,
      };
    }
    byResource[key].events += 1;
    byResource[key].hours += hours;
    for (const skill of SKILLS) {
      const amount = hours * n(profile[skill]);
      byResource[key].skillExposure[skill] += amount;
      bySkill[skill] += amount;
    }
  }

  return {
    byResource: Object.values(byResource)
      .map((row) => ({
        ...row,
        hours: round(row.hours, 2),
        skillExposure: Object.fromEntries(Object.entries(row.skillExposure).map(([k, v]) => [k, round(v, 2)])),
        estimateType: DESCRIPTIVE_ESTIMATE,
        causalClaimAllowed: false,
      }))
      .sort((a, b) => b.hours - a.hours),
    bySkill: Object.fromEntries(Object.entries(bySkill).map(([k, v]) => [k, round(v, 2)])),
    estimateType: DESCRIPTIVE_ESTIMATE,
    causalClaimAllowed: false,
  };
}

function summarizeGrowthEpisodes(exams, studentById) {
  const retestRows = exams.filter((exam) => exam.retestFlag && exam.deltaRawScore != null);
  const bySkill = {};
  for (const exam of retestRows) {
    const skill = exam.skill || 'unknown';
    if (!bySkill[skill]) bySkill[skill] = [];
    bySkill[skill].push(n(exam.deltaRawScore));
  }

  const skills = Object.entries(bySkill).map(([skill, values]) => ({
    skill,
    sampleSize: values.length,
    rawGrowthAverage: round(mean(values), 2),
    confidenceInterval: ci95(values),
    estimateType: DESCRIPTIVE_ESTIMATE,
    causalClaimAllowed: false,
  }));

  const episodes = retestRows.slice(0, 200).map((exam) => {
    const student = studentById.get(exam.studentId);
    const quality = evidenceQualityForStudent(student || {});
    return {
      studentId: exam.studentId,
      skill: exam.skill,
      instrument: exam.instrument,
      examDate: exam.examDate,
      previousRawScore: exam.previousRawScore != null ? Number(exam.previousRawScore) : null,
      rawScore: exam.rawScore != null ? Number(exam.rawScore) : null,
      rawGrowth: Number(exam.deltaRawScore),
      weightedGrowth: round(n(exam.deltaRawScore) * qualityWeight(quality), 2),
      exposureBeforeExam: {
        courseHours: round(exam.courseHoursBeforeExam, 2),
        activityHours: round(exam.activityHoursBeforeExam, 2),
        resourceHours: round(exam.resourceHoursBeforeExam, 2),
      },
      evidenceQuality: quality,
      estimateType: DESCRIPTIVE_ESTIMATE,
      causalClaimAllowed: false,
    };
  });

  return {
    retestRows: retestRows.length,
    bySkill: skills.sort((a, b) => a.skill.localeCompare(b.skill)),
    sampleEpisodes: episodes,
    estimateType: DESCRIPTIVE_ESTIMATE,
    causalClaimAllowed: false,
  };
}

function buildAdjustedGrowthEpisodeRows(exams, studentById) {
  const { buildAdjustedGrowthEpisodeRows: buildRows, buildExamById } = require('./lvaAdjustedGrowthService');
  return buildRows(exams, studentById, buildExamById(exams));
}

function computeAdjustedGrowthEpisodes(exams, studentById) {
  return computeAdjustedGrowthEpisodesV2(exams, studentById);
}

function summarizeAdjustedGrowth(exams, studentById) {
  return summarizeAdjustedGrowthV2(exams, studentById);
}

function propensityLikeScore(row) {
  return propensityLikeScoreLegacy(row);
}

function summarizeQuasiCausalEstimates(events, adjustedGrowth, options = {}) {
  return summarizeQuasiCausalEstimatesV2(events, adjustedGrowth, {
    ...options,
    resourceKeyForEvent,
  });
}

function summarizePropensityWeightedEstimates(events, adjustedGrowth) {
  return summarizePropensityWeightedEstimatesV2(events, adjustedGrowth, {
    resourceKeyForEvent,
  });
}

function summarizeResourceEffectiveness(events, exams) {
  const examRowsWithGrowth = exams.filter((exam) => exam.retestFlag && exam.deltaRawScore != null);
  const growthByStudent = new Map();
  for (const exam of examRowsWithGrowth) {
    if (!growthByStudent.has(exam.studentId)) growthByStudent.set(exam.studentId, []);
    growthByStudent.get(exam.studentId).push(n(exam.deltaRawScore));
  }

  const participantsByResource = new Map();
  for (const event of events) {
    const key = resourceKeyForEvent(event);
    if (!participantsByResource.has(key)) participantsByResource.set(key, new Set());
    participantsByResource.get(key).add(event.studentId);
  }

  const rows = [];
  for (const [resourceType, studentIds] of participantsByResource.entries()) {
    const values = [];
    for (const studentId of studentIds) {
      const gains = growthByStudent.get(studentId) || [];
      const avg = mean(gains);
      if (avg != null) values.push(avg);
    }
    const avg = mean(values);
    const profiles = getResourceSkillProfilesMap();
    const profile = profiles[resourceType] || profiles.ACTIVITY_OTHER;
    const mainSkills = Object.entries(profile)
      .filter(([skill]) => SKILLS.includes(skill))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([skill]) => skill);
    rows.push({
      resourceType,
      participantCount: studentIds.size,
      growthSampleSize: values.length,
      rawGrowthAverage: avg == null ? null : round(avg, 2),
      confidenceInterval: ci95(values),
      estimateType: DESCRIPTIVE_ESTIMATE,
      causalClaimAllowed: false,
      evidenceLevel: values.length >= 30 ? 'descriptive_medium' : 'descriptive_low',
      mainSkills,
      interpretation: '描述性趨勢；尚未執行 propensity score、DiD 或 doubly robust 估計，不能作因果宣稱。',
    });
  }
  return rows.sort((a, b) => (b.rawGrowthAverage ?? -Infinity) - (a.rawGrowthAverage ?? -Infinity));
}

function summarizeReasonStrings(values) {
  const out = {};
  for (const raw of values) {
    for (const code of parseList(raw)) {
      out[code] = (out[code] || 0) + 1;
    }
  }
  return out;
}

function summarizeRawDataTraceability(students, exams, events) {
  const missing = {
    noBaseline: students.filter((s) => s.baselineEnglishScore == null).length,
    noValidExam: students.filter((s) => !s.hasValidExam).length,
    singleExamOnly: students.filter((s) => s.hasValidExam && n(s.examCount) <= 1).length,
    excludedOrReasonedStudents: students.filter((s) => s.excludeFlagSummary || s.reasonCodesSummary).length,
    registeredNoScoreExamRows: exams.filter((e) => e.registeredNoScoreFlag).length,
  };
  return {
    recordCounts: {
      analyticStudents: students.length,
      analyticExamRows: exams.length,
      rawEvents: events.length,
    },
    missingDataReport: missing,
    exclusionReasons: {
      students: summarizeReasonStrings(students.map((s) => s.reasonCodesSummary)),
      exams: summarizeReasonStrings(exams.map((e) => e.reasonCode)),
    },
    exclusionPolicy: '資料列保留 reason_code / exclude_flag；分析層依篩選條件 include 或 exclude，不在資料層全域隱藏。',
  };
}

async function getLvaAnalytics(query = {}) {
  await Promise.all([
    ensureResourceSkillProfilesLoaded(),
    ensureLvaConfigLoaded(),
  ]);
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const studentWhere = buildStudentWhere(query, snapshotVersion);
  let students = await LjAnalyticStudent.findAll({ where: studentWhere });
  students = applyEvidenceQualityFilter(students, query);

  const studentIds = students.map((student) => student.studentId);
  const studentById = new Map(students.map((student) => [student.studentId, student]));
  const scopedStudentWhere = studentIds.length ? { [Op.in]: studentIds } : '__none__';

  const exams = await LjAnalyticExam.findAll({
    where: buildExamWhere(query, snapshotVersion, studentIds),
    order: [['studentId', 'ASC'], ['examDate', 'ASC'], ['skill', 'ASC']],
  });
  const events = await LjStudentEvent.findAll({
    where: {
      studentId: scopedStudentWhere,
      status: { [Op.in]: ['valid', 'registered_no_score'] },
      eventType: { [Op.in]: ['course_event', 'activity_event'] },
    },
    order: [['eventDate', 'ASC'], ['studentId', 'ASC']],
  });
  const resourceTypes = new Set(parseList(query.resource_type).map((v) => v.toUpperCase()));
  const scopedEvents = resourceTypes.size
    ? events.filter((event) => resourceTypes.has(resourceKeyForEvent(event)))
    : events;
  const adjustedGrowth = summarizeAdjustedGrowth(exams, studentById);
  const adjustedGrowthLegacy = summarizeAdjustedGrowthLegacy(exams, studentById);
  const quasiCausalOptions = { caliper: query.matching_caliper, resourceKeyForEvent };

  return {
    contractVersion: LVA_CONTRACT_VERSION,
    version: LVA_VERSION,
    snapshotVersion,
    supportedFilters: supportedFilters(),
    filters: normalizeAppliedFilters(query),
    estimatePolicy: estimatePolicy(),
    methodComparison: getMethodComparisonPayload(),
    gse: summarizeGseCoverage(students),
    skillExposure: summarizeSkillExposure(scopedEvents),
    growthEpisodes: summarizeGrowthEpisodes(exams, studentById),
    adjustedGrowth,
    adjustedGrowthLegacy,
    quasiCausalEstimates: summarizeQuasiCausalEstimates(scopedEvents, adjustedGrowth, quasiCausalOptions),
    quasiCausalEstimatesLegacy: summarizeQuasiCausalEstimatesLegacy(scopedEvents, adjustedGrowthLegacy, quasiCausalOptions),
    propensityWeightedEstimates: summarizePropensityWeightedEstimates(scopedEvents, adjustedGrowth),
    propensityWeightedEstimatesLegacy: summarizePropensityWeightedEstimatesLegacy(scopedEvents, adjustedGrowthLegacy, quasiCausalOptions),
    aipwEstimates: summarizeAipwEstimates(scopedEvents, adjustedGrowth, quasiCausalOptions),
    resourceEffectiveness: summarizeResourceEffectiveness(scopedEvents, exams),
    rawData: summarizeRawDataTraceability(students, exams, scopedEvents),
    modelReadiness: {
      descriptive: true,
      baselineAdjusted: students.some((s) => s.baselineEnglishScore != null) && exams.some((e) => e.retestFlag),
      causalInference: false,
      quasiCausalObservational: true,
      valueAddedRegression: true,
      logisticPropensity: true,
      aipwDoublyRobust: true,
      nextSteps: [
        '於「模組設定」校準 resource_skill_profiles 後，LVA 曝光與建議會即時採用自訂向量。',
        '比對 adjustedGrowth 與 adjustedGrowthLegacy、quasiCausal 與 aipwEstimates 以評估方法穩定性。',
        '累積更大樣本後可再評估 DiD 或 SGP 常模百分位。',
      ],
    },
    cautions: [
      'GSE 為 Pearson 對齊 CEFR 的能力量尺，用於內部分析；不等於官方認證分數，也不代表 CEFR 子區間等距。',
      '目前 resourceEffectiveness 為描述性趨勢；請勿寫成「活動造成能力提升」。',
      'adjustedGrowth 為 OLS value-added 觀察估計；legacy 欄位供對照，均非因果證明。',
      'quasiCausalEstimates / propensityWeightedEstimates / aipwEstimates 請交叉比對，仍不可作單獨因果宣稱。',
      '考後才發生的活動不能解釋先前考試，正式模型需以 event_date < exam_date 建立 exposure window。',
    ],
  };
}

module.exports = {
  LVA_VERSION,
  LVA_CONTRACT_VERSION,
  GSE_CEFR_SUMMARY,
  RESOURCE_SKILL_PROFILES,
  DEFAULT_MATCHING_CALIPER,
  cefrToGse,
  inferGseScore,
  evidenceQualityForStudent,
  resourceKeyForEvent,
  summarizeAdjustedGrowth,
  computeAdjustedGrowthEpisodes,
  summarizeQuasiCausalEstimates,
  summarizePropensityWeightedEstimates,
  supportedFilters,
  getLvaAnalytics,
};
