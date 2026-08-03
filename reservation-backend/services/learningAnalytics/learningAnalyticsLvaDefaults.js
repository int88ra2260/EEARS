'use strict';

/** LVA（學習成效估計）演算法預設參數 */
const LVA_CONFIG_DEFAULTS = Object.freeze({
  matchingCaliper: 0.35,
  maxMatches: 3,
  expectedGrowthWeights: Object.freeze({
    global: 0.2,
    bySkill: 0.3,
    bySkillBand: 0.25,
    bySkillDepartment: 0.15,
    bySkillQuality: 0.1,
  }),
  propensityWeights: Object.freeze({
    baseline: 0.45,
    quality: 0.3,
    resource: 0.25,
    resourceHoursCap: 30,
  }),
  evidenceQualityScores: Object.freeze({
    high: 0.9,
    medium: 0.7,
    medium_low: 0.45,
    low: 0.2,
  }),
  covariateDistancePenalties: Object.freeze({
    skillMismatch: 2,
    bandMismatch: 0.35,
    departmentMismatch: 0.2,
    qualityMismatch: 0.2,
  }),
  qualityWeights: Object.freeze({
    high: 1,
    medium: 0.75,
    medium_low: 0.5,
    low: 0.25,
  }),
  propensityClamp: Object.freeze({
    min: 0.05,
    max: 0.95,
  }),
});

/** 設定頁 UI 分組與欄位說明 */
const LVA_CONFIG_GROUPS = Object.freeze([
  {
    id: 'matching',
    title: '背景相近比對',
    description: '比較「有參與某資源」與「背景相近但未參與」學生的成長差異。容許值愈小，比對愈嚴格、樣本可能愈少。',
    fields: [
      {
        key: 'matchingCaliper',
        label: '比對容許值',
        help: '兩位學生背景差距超過此值就不配對。篩選區進階欄位可單次覆寫。',
        type: 'number',
        min: 0.05,
        max: 2,
        step: 0.05,
      },
      {
        key: 'maxMatches',
        label: '每位最多比對人數',
        help: '每位處理組學生最多找幾位對照組；取平均後計算差異。',
        type: 'integer',
        min: 1,
        max: 10,
        step: 1,
      },
    ],
  },
  {
    id: 'adjustedGrowth',
    title: '修正成長（扣除預期成長）',
    description: '依不同分組計算「預期成長」，再從實際成長中扣除。各權重加總不必等於 1，系統會依有資料的分組自動正規化。',
    fields: [
      { key: 'expectedGrowthWeights.global', label: '全體平均權重', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'expectedGrowthWeights.bySkill', label: '同技能平均權重', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'expectedGrowthWeights.bySkillBand', label: '技能＋起點等級權重', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'expectedGrowthWeights.bySkillDepartment', label: '技能＋系所權重', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'expectedGrowthWeights.bySkillQuality', label: '技能＋資料品質權重', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'propensity',
    title: '傾向分數（配對與加權用）',
    description: '綜合基線能力、資料完整度與資源參與，估算學生「較可能參與資源」的程度，用於找背景相近的對照組。',
    fields: [
      { key: 'propensityWeights.baseline', label: '基線能力權重', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'propensityWeights.quality', label: '資料品質權重', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'propensityWeights.resource', label: '資源時數權重', type: 'number', min: 0, max: 1, step: 0.05 },
      {
        key: 'propensityWeights.resourceHoursCap',
        label: '資源時數正規化上限（小時）',
        help: '參與時數會先除以此前再納入傾向分數。',
        type: 'number',
        min: 1,
        max: 200,
        step: 1,
      },
      { key: 'propensityClamp.min', label: '加權估計：傾向機率下限', type: 'number', min: 0.01, max: 0.5, step: 0.01 },
      { key: 'propensityClamp.max', label: '加權估計：傾向機率上限', type: 'number', min: 0.5, max: 0.99, step: 0.01 },
    ],
  },
  {
    id: 'distance',
    title: '比對距離懲罰',
    description: '兩位學生若在某項背景不同，距離會加上對應懲罰；距離過大則不配對。',
    fields: [
      { key: 'covariateDistancePenalties.skillMismatch', label: '不同技能', type: 'number', min: 0, max: 5, step: 0.1 },
      { key: 'covariateDistancePenalties.bandMismatch', label: '起點等級不同', type: 'number', min: 0, max: 2, step: 0.05 },
      { key: 'covariateDistancePenalties.departmentMismatch', label: '系所不同', type: 'number', min: 0, max: 2, step: 0.05 },
      { key: 'covariateDistancePenalties.qualityMismatch', label: '資料品質不同', type: 'number', min: 0, max: 2, step: 0.05 },
    ],
  },
  {
    id: 'quality',
    title: '資料品質加權',
    description: '前後測成長與傾向分數計算時，依資料完整度給予不同權重或分數。',
    fields: [
      { key: 'qualityWeights.high', label: '成長加權：高', type: 'number', min: 0, max: 2, step: 0.05 },
      { key: 'qualityWeights.medium', label: '成長加權：中', type: 'number', min: 0, max: 2, step: 0.05 },
      { key: 'qualityWeights.medium_low', label: '成長加權：中低', type: 'number', min: 0, max: 2, step: 0.05 },
      { key: 'qualityWeights.low', label: '成長加權：低', type: 'number', min: 0, max: 2, step: 0.05 },
      { key: 'evidenceQualityScores.high', label: '傾向分數：高', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'evidenceQualityScores.medium', label: '傾向分數：中', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'evidenceQualityScores.medium_low', label: '傾向分數：中低', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'evidenceQualityScores.low', label: '傾向分數：低', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
]);

function cloneDefaults() {
  return JSON.parse(JSON.stringify(LVA_CONFIG_DEFAULTS));
}

module.exports = {
  LVA_CONFIG_DEFAULTS,
  LVA_CONFIG_GROUPS,
  cloneDefaults,
};
