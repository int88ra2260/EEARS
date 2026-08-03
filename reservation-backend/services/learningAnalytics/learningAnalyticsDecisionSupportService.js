'use strict';

const { Op } = require('sequelize');
const { LjAnalyticStudent, LjAnalyticExam } = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const {
  computeAdjustedGrowthEpisodes,
  getLvaAnalytics,
} = require('../learningJourney/analytics/lvaAnalyticsService');
const {
  ensureResourceSkillProfilesLoaded,
  getResourceSkillProfilesMap,
} = require('./resourceSkillProfileService');
const { getSemesterB2Report } = require('../learningJourney/b2ReportService');
const {
  buildStudentWhere,
  buildExamWhere,
  applyEvidenceQualityFilter,
} = require('./learningAnalyticsFilterUtils');
const { resolveBaselineCefrBand } = require('./baselineAbilityUtils');
const { aggregateGrowthByGroup, buildParticipationComparison, resolveGroupKey } = require('./learningAnalyticsCohortServiceHelpers');

const RESOURCE_LABELS = Object.freeze({
  GE: '通識英文',
  EAP: 'EAP 寫作／學術英文',
  ESP: 'ESP 專業英文',
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

const SKILL_KEYS = ['listening', 'reading', 'speaking', 'writing'];
const TREND_SEMESTERS = ['114-2', '114-1', '113-2', '113-1', '112-2', '112-1'];

const CEFR_B2_PRIOR = Object.freeze({
  BELOW_A1: 0.08,
  A1: 0.12,
  A2: 0.28,
  B1: 0.52,
  B2: 0.88,
  C1: 0.96,
  C2: 0.98,
});

function round(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function identifyWeakSkills(student) {
  const rows = [
    { skill: 'listening', score: student.bestListeningScore },
    { skill: 'reading', score: student.bestReadingScore },
    { skill: 'speaking', score: student.bestSpeakingScore },
    { skill: 'writing', score: student.bestWritingScore },
  ].filter((row) => row.score != null);
  if (!rows.length) {
    const band = resolveBaselineCefrBand(student);
    if (band === 'A2' || band === 'BELOW_A1' || band === 'A1') return ['speaking', 'listening'];
    if (band === 'B1') return ['writing', 'speaking'];
    return ['writing'];
  }
  rows.sort((a, b) => Number(a.score) - Number(b.score));
  return [...new Set(rows.slice(0, 2).map((row) => row.skill))];
}

function alignmentScore(weakSkills, profile) {
  if (!weakSkills.length) return 0;
  const sum = weakSkills.reduce((acc, skill) => acc + Number(profile[skill] || 0), 0);
  return round(sum / weakSkills.length, 4);
}

function estimateB2PlusProbability(student) {
  const band = resolveBaselineCefrBand(student) || 'UNKNOWN';
  let p = CEFR_B2_PRIOR[band] ?? 0.2;
  if (student.isB2plus) return { probability: 1, band, factors: ['已達 B2+'] };

  const factors = [];
  if (student.retestFlag) {
    p += 0.08;
    factors.push('曾重測英檢（+8%）');
  }
  const hours = Number(student.totalResourceHours || 0);
  if (hours >= 30) {
    p += 0.1;
    factors.push('資源參與 ≥30 小時（+10%）');
  } else if (hours >= 10) {
    p += 0.05;
    factors.push('資源參與 10–30 小時（+5%）');
  }
  if (Number(student.examCount) >= 2) {
    p += 0.04;
    factors.push('多次英檢紀錄（+4%）');
  }
  if (student.baselineEnglishScore != null && Number(student.baselineEnglishScore) >= 10) {
    p += 0.03;
    factors.push('學測英文基準較佳（+3%）');
  }

  return {
    probability: round(Math.min(0.92, Math.max(0.05, p)), 4),
    band,
    factors,
  };
}

function buildResourceRecommendations(weakSkills, participatedTypes = new Set()) {
  const profiles = getResourceSkillProfilesMap();
  return Object.entries(profiles)
    .filter(([key]) => !['ACTIVITY_OTHER', 'COURSE_OTHER'].includes(key))
    .map(([resourceKey, weights]) => {
      const alignment = alignmentScore(weakSkills, weights);
      const mainSkills = SKILL_KEYS
        .map((skill) => ({ skill, weight: Number(weights[skill] || 0) }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 2)
        .map((row) => row.skill);
      const alreadyParticipated = participatedTypes.has(resourceKey);
      return {
        resourceKey,
        label: RESOURCE_LABELS[resourceKey] || resourceKey,
        alignmentIndex: alignment,
        mainSkills,
        alreadyParticipated,
        priority: alreadyParticipated ? alignment * 0.6 : alignment,
        rationale: `主要訓練 ${mainSkills.join('、')}；與弱項 ${weakSkills.join('、')} 的對齊度 ${alignment}.`,
        causalClaimAllowed: false,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

async function inferParticipatedResourceTypes(studentId, snapshotVersion) {
  const exams = await LjAnalyticExam.findAll({
    where: { studentId, snapshotVersion },
    attributes: ['courseHoursBeforeExam', 'activityHoursBeforeExam'],
    limit: 20,
  });
  const types = new Set();
  const courseH = Math.max(...exams.map((e) => Number(e.courseHoursBeforeExam || 0)), 0);
  const activityH = Math.max(...exams.map((e) => Number(e.activityHoursBeforeExam || 0)), 0);
  if (courseH > 0) types.add('GE');
  if (activityH > 0) {
    types.add('ENGLISH_TABLE');
    types.add('ENGLISH_CLUB');
  }
  return types;
}

/**
 * 單一學生個別化資源建議（Phase 5 原型）
 */
async function getStudentRecommendations(studentId, query = {}) {
  await ensureResourceSkillProfilesLoaded();
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const student = await LjAnalyticStudent.findOne({
    where: { studentId, snapshotVersion },
  });
  if (!student) return null;

  const weakSkills = identifyWeakSkills(student);
  const participated = await inferParticipatedResourceTypes(studentId, snapshotVersion);
  const recommendations = buildResourceRecommendations(weakSkills, participated);
  const outlook = estimateB2PlusProbability(student);

  return {
    studentId,
    snapshotVersion,
    weakSkills,
    baselineCefr: resolveBaselineCefrBand(student),
    isB2plus: student.isB2plus,
    certificationOutlook: {
      ...outlook,
      label: outlook.probability >= 0.65 ? '較有機會' : outlook.probability >= 0.4 ? '需持續努力' : '建議加強投入',
      disclaimer: '通過機率為觀察資料啟發式估計，非正式預測模型。',
    },
    recommendations,
    disclaimer: '建議僅供行政參考；資源與進步的關聯為觀察估計，不代表保證成效。',
    causalClaimAllowed: false,
  };
}

async function loadScopedStudents(query, snapshotVersion) {
  const rows = await LjAnalyticStudent.findAll({
    where: buildStudentWhere(query, snapshotVersion),
  });
  return applyEvidenceQualityFilter(rows, query);
}

/**
 * 進階視覺化資料（scatter、heatmap、boxplot、認證趨勢）
 */
async function getAdvancedVisualizations(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const students = await loadScopedStudents(query, snapshotVersion);
  const studentById = new Map(students.map((s) => [s.studentId, s]));
  const studentIds = students.map((s) => s.studentId);

  const exams = studentIds.length
    ? await LjAnalyticExam.findAll({ where: buildExamWhere(query, snapshotVersion, studentIds) })
    : [];
  const episodes = computeAdjustedGrowthEpisodes(exams, studentById);
  const lva = await getLvaAnalytics({ ...query, snapshot_version: snapshotVersion });

  const participationVsGrowth = episodes
    .filter((ep) => ep.resourceHoursBeforeExam != null)
    .slice(0, 500)
    .map((ep) => ({
      studentId: ep.studentId,
      skill: ep.skill,
      resourceHours: ep.resourceHoursBeforeExam,
      adjustedGrowth: ep.adjustedGseGrowth,
      actualGrowth: ep.actualGseGrowth,
      department: ep.department,
    }));

  const resourceRows = lva.resourceEffectiveness || [];
  const heatmapSkills = SKILL_KEYS;
  const resourceSkillHeatmap = resourceRows.map((row) => {
    const cells = {};
    for (const skill of heatmapSkills) {
      const main = Array.isArray(row.mainSkills) && row.mainSkills.includes(skill);
      cells[skill] = main ? round(row.rawGrowthAverage, 2) : null;
    }
    return {
      resourceType: row.resourceType,
      label: RESOURCE_LABELS[row.resourceType] || row.resourceType,
      participantCount: row.participantCount,
      cells,
    };
  });

  const groupBy = 'department';
  const growthByGroup = aggregateGrowthByGroup(episodes, studentById, groupBy);
  const cohortGrowthBoxplot = Array.from(growthByGroup.entries()).map(([groupKey, meta]) => {
    const values = episodes
      .filter((ep) => resolveGroupKey(studentById.get(ep.studentId) || {}, groupBy) === groupKey)
      .map((ep) => ep.adjustedGseGrowth)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    return {
      groupKey,
      sampleSize: values.length,
      min: values.length ? round(values[0], 2) : null,
      q1: values.length ? round(percentile(values, 0.25), 2) : null,
      median: values.length ? round(percentile(values, 0.5), 2) : null,
      q3: values.length ? round(percentile(values, 0.75), 2) : null,
      max: values.length ? round(values[values.length - 1], 2) : null,
      mean: meta.avgAdjustedGseGrowth,
    };
  }).filter((row) => row.sampleSize >= 3).sort((a, b) => b.sampleSize - a.sampleSize).slice(0, 12);

  const participationComparison = buildParticipationComparison(episodes, students);

  const trendResults = await Promise.all(
    TREND_SEMESTERS.map(async (semester) => {
      try {
        const report = await getSemesterB2Report(semester);
        return {
          semester,
          b2plusRate: report?.rates?.b2plusRate ?? report?.b2plusRate ?? null,
          students: report?.totals?.students ?? report?.studentCount ?? null,
        };
      } catch {
        return { semester, b2plusRate: null, students: null };
      }
    })
  );
  const certificationTrend = trendResults.filter((row) => row.b2plusRate != null);

  const notYetB2 = students.filter((s) => !s.isB2plus);
  const outlookBuckets = { high: 0, medium: 0, low: 0 };
  const outlookSamples = notYetB2.slice(0, 2000).map((student) => {
    const { probability } = estimateB2PlusProbability(student);
    if (probability >= 0.65) outlookBuckets.high += 1;
    else if (probability >= 0.4) outlookBuckets.medium += 1;
    else outlookBuckets.low += 1;
    return { studentId: student.studentId, probability, department: student.department };
  });

  return {
    snapshotVersion,
    filters: query,
    participationVsGrowth,
    resourceSkillHeatmap,
    cohortGrowthBoxplot,
    participationComparison,
    certificationTrend,
    certificationOutlookSummary: {
      notB2plusStudents: notYetB2.length,
      buckets: outlookBuckets,
      topProspects: outlookSamples
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 10),
      disclaimer: '通過機率為啟發式估計；僅供資源配置參考，非錄取或認證保證。',
    },
    causalClaimAllowed: false,
  };
}

module.exports = {
  getStudentRecommendations,
  getAdvancedVisualizations,
  estimateB2PlusProbability,
  identifyWeakSkills,
  RESOURCE_LABELS,
};
