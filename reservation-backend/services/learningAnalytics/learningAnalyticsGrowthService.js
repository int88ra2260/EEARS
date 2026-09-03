'use strict';

const { getLvaAnalytics } = require('../learningJourney/analytics/lvaAnalyticsService');

const CONTRACT_VERSION = 'learning-analytics.skills.v3';

const SKILL_ORDER = ['listening', 'reading', 'speaking', 'writing'];

const SKILL_LABELS = Object.freeze({
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
});

function round(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function mean(values) {
  const nums = (values || [])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map(Number)
    .filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function buildAdjustedLookup(adjustedGrowth) {
  const map = new Map();
  for (const row of adjustedGrowth?.sampleEpisodes || []) {
    map.set(`${row.studentId}|${row.skill}|${row.instrument}`, row);
  }
  return map;
}

function enrichEpisodes(growthEpisodes, adjustedLookup) {
  return (growthEpisodes?.sampleEpisodes || []).map((episode) => {
    const adjKey = `${episode.studentId}|${episode.skill}|${episode.instrument}`;
    const adjusted = adjustedLookup.get(adjKey) || {};
    const exposure = episode.exposureBeforeExam || {};
    return {
      ...episode,
      skillLabel: SKILL_LABELS[episode.skill] || episode.skill,
      actualGseGrowth: adjusted.actualGseGrowth ?? null,
      adjustedGseGrowth: adjusted.adjustedGseGrowth ?? null,
      expectedGseGrowth: adjusted.expectedGseGrowth ?? null,
      previousGse: adjusted.previousGse ?? null,
      postGse: adjusted.postGse ?? null,
      timeWindow: {
        rule: 'pre_post_exam',
        description: '僅計入後測日期之前的課程與活動時數（同日不計入）',
        courseHoursBeforeExam: round(exposure.courseHours, 2),
        activityHoursBeforeExam: round(exposure.activityHours, 2),
        resourceHoursBeforeExam: round(exposure.resourceHours, 2),
      },
      traceability: {
        studentId: episode.studentId,
        instrument: episode.instrument,
        examDate: episode.examDate,
        rawGrowth: episode.rawGrowth,
      },
    };
  });
}

function enrichBySkill(growthEpisodes, episodes) {
  const bySkillMap = new Map((growthEpisodes?.bySkill || []).map((row) => [row.skill, row]));
  return SKILL_ORDER
    .filter((skill) => bySkillMap.has(skill))
    .map((skill) => {
      const row = bySkillMap.get(skill);
      const skillEpisodes = episodes.filter((ep) => ep.skill === skill);
      const improvedCount = skillEpisodes.filter((ep) => Number(ep.actualGseGrowth) > 0).length;
      const sampleSize = row.sampleSize || skillEpisodes.length;
      return {
        ...row,
        skill,
        label: SKILL_LABELS[skill] || skill,
        /** 工具原始分平均差（不同英檢不可與 GSE 同軸比較） */
        rawGrowthAverage: row.rawGrowthAverage ?? null,
        /** GSE 實際成長平均（與校正後同尺） */
        actualGseGrowthAverage: round(mean(skillEpisodes.map((ep) => ep.actualGseGrowth)), 2),
        growthStudentRatio: sampleSize ? round(improvedCount / sampleSize, 4) : null,
        improvedCount,
        declinedOrFlatCount: Math.max(0, sampleSize - improvedCount),
      };
    });
}

function buildRadarChart(bySkill, adjustedBySkill) {
  const adjMap = new Map((adjustedBySkill || []).map((row) => [row.skill, row]));
  return SKILL_ORDER
    .filter((skill) => bySkill.some((row) => row.skill === skill))
    .map((skill) => {
      const row = bySkill.find((r) => r.skill === skill);
      const adj = adjMap.get(skill);
      return {
        skill,
        label: SKILL_LABELS[skill] || skill,
        actualGseGrowthAverage: row?.actualGseGrowthAverage ?? null,
        adjustedGseGrowthAverage: adj?.adjustedGseGrowthAverage ?? null,
        /** @deprecated 僅供明細／除錯；圖表請用 actualGseGrowthAverage */
        rawGrowthAverage: row?.rawGrowthAverage ?? null,
        sampleSize: row?.sampleSize ?? 0,
        confidenceInterval: row?.confidenceInterval ?? null,
      };
    });
}

function buildGrowthView(lva) {
  const adjustedLookup = buildAdjustedLookup(lva.adjustedGrowth);
  const episodes = enrichEpisodes(lva.growthEpisodes, adjustedLookup);
  const bySkill = enrichBySkill(lva.growthEpisodes, episodes);

  return {
    summary: {
      retestCount: lva.growthEpisodes?.retestRows || 0,
      episodeSampleSize: episodes.length,
      timeWindowRule: '僅後測日期之前的資源計入該次成長區間；考後活動不納入該次成長解釋。',
      estimateType: lva.growthEpisodes?.estimateType || lva.estimatePolicy?.descriptive,
      scaleNote: '圖表「實際／校正後」皆為 GSE 量尺；工具原始分進步另見 rawGrowthAverage，不可與 GSE 同軸比較。',
      causalClaimAllowed: false,
    },
    bySkill,
    episodes: episodes.slice(0, 100),
    radar: buildRadarChart(bySkill, lva.adjustedGrowth?.bySkill),
  };
}

async function getLearningAnalyticsSkills(query = {}) {
  const lva = await getLvaAnalytics(query);
  const growth = buildGrowthView(lva);

  return {
    contractVersion: CONTRACT_VERSION,
    snapshotVersion: lva.snapshotVersion,
    filters: lva.filters,
    growth,
    growthEpisodes: lva.growthEpisodes,
    adjustedGrowth: lva.adjustedGrowth,
    gse: lva.gse,
    estimatePolicy: lva.estimatePolicy,
    causalClaimAllowed: false,
  };
}

module.exports = {
  CONTRACT_VERSION,
  SKILL_LABELS,
  SKILL_ORDER,
  buildGrowthView,
  getLearningAnalyticsSkills,
};
