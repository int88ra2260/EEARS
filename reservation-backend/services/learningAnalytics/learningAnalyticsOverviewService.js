'use strict';

const { Op } = require('sequelize');
const { LjAnalyticStudent } = require('../../models');
const { getAnalyticsSummary } = require('../learningJourney/analytics/analyticsSummaryService');
const { getLvaAnalytics } = require('../learningJourney/analytics/lvaAnalyticsService');
const { getSemesterB2Report } = require('../learningJourney/b2ReportService');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const {
  buildStudentWhere,
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

/**
 * 主管 Demo 用中心成效總覽（整合 LJ 分析讀模型 + LVA 描述性指標）
 */
async function getLearningAnalyticsOverview(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const filters = stripEmptyQueryParams({ ...query, snapshot_version: snapshotVersion });

  const [summary, lva, cefrDistribution, b2Report, unfilteredSummary] = await Promise.all([
    getAnalyticsSummary(filters),
    getLvaAnalytics(filters),
    computeCefrDistribution(filters, snapshotVersion),
    filters.semester
      ? getSemesterB2Report(String(filters.semester)).catch(() => null)
      : Promise.resolve(null),
    getAnalyticsSummary({ snapshot_version: snapshotVersion }),
  ]);

  const totals = summary.totals || {};
  const adjustedSkills = lva.adjustedGrowth?.bySkill || [];
  const overallAdjusted = adjustedSkills.length
    ? adjustedSkills.reduce((sum, row) => sum + Number(row.adjustedGseGrowthAverage || 0), 0) / adjustedSkills.length
    : null;

  const headline = {
    studentsInAnalysis: totals.students || 0,
    studentsWithBaseline: totals.withBaseline || 0,
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
      '資源效益排名為描述性關聯；進階準因果估計請參考進階分析區塊。',
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

module.exports = {
  CONTRACT_VERSION,
  getLearningAnalyticsOverview,
  labelResource,
  RESOURCE_LABELS,
};
