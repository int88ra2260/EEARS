'use strict';

/**
 * LVA 估計方法新舊對照表（供 API 與文件共用）
 * 欄位說明見 docs/learning-analytics-method-comparison.md
 */
const LVA_METHOD_COMPARISON = Object.freeze([
  {
    id: 'adjusted_growth',
    metric: '修正成長（adjustedGseGrowth）',
    legacy: {
      estimateType: 'baseline_adjusted_simplified',
      formula: 'actualGseGrowth − Σ(權重ᵢ × 分組平均成長)',
      covariates: ['skill', 'initialCefrBand', 'department', 'evidenceQuality'],
      reference: '分組加權平均（簡化 VAM）',
    },
    current: {
      estimateType: 'baseline_adjusted_regression_v2',
      formula: 'actualGseGrowth − ŷ_OLS(baselineGse, monthsBetweenTests, quality, CEFR band, skill)',
      covariates: ['baselineGse', 'monthsBetweenTests', 'evidenceQuality', 'initialCefrBand', 'skill'],
      reference: '多元線性回歸 value-added（Kline 2011 等文獻常見形式）',
    },
    interpretation: '新版同時控制測驗間隔與多個共變量；舊版僅以分組平均代表「預期成長」。兩者皆非因果證明。',
    causalClaimAllowed: false,
  },
  {
    id: 'months_between_tests',
    metric: '前後測間隔（monthsBetweenTests）',
    legacy: {
      value: 'null（讀模型未提供）',
      reference: '—',
    },
    current: {
      value: '由 previousExamEventId 對照前次 examDate 推算（天數 ÷ 30.4375）',
      reference: '時間校正成長分析之前提（SGP / VAM 文獻）',
    },
    interpretation: '新版可在回歸中控制測驗間隔；annualizedGseGrowth 僅供參考，預設仍以 raw GSE 成長為主。',
    causalClaimAllowed: false,
  },
  {
    id: 'propensity_score',
    metric: '傾向分數（配對 / 加權用）',
    legacy: {
      estimateType: 'propensity-like score',
      formula: 'w基線×(GSE/90) + w品質×quality + w資源×(hours/cap)',
      reference: '可解釋啟發式加權和',
    },
    current: {
      estimateType: 'logistic propensity score',
      formula: 'P(T=1|X) = logistic(β₀ + β₁X₁ + …)，X 含 baseline、quality、resource、months、skill、band',
      reference: 'Rosenbaum & Rubin (1983) propensity score',
    },
    interpretation: '新版輸出為 0–1 機率，較符合 PS 文獻；樣本不足時自動回退舊版。',
    causalClaimAllowed: false,
  },
  {
    id: 'matching_caliper',
    metric: '配對容許值（caliper）',
    legacy: {
      rule: '固定啟發式距離（預設 0.35，含共變量懲罰）',
      reference: '專案自訂',
    },
    current: {
      rule: '0.2 × SD(logit(PS))，距離在 logit(PS) 上計算（Austin 2011）',
      reference: 'Austin, Multivariate Behav Res (2011)',
    },
    interpretation: '新版 caliper 隨樣本 propensity 分布自動縮放；可在篩選區以 matching_caliper 覆寫 legacy 路徑。',
    causalClaimAllowed: false,
  },
  {
    id: 'resource_effect_matching',
    metric: '資源效應（背景相近配對）',
    legacy: {
      estimateType: 'propensity_matched_observational',
      method: 'nearest-neighbor on propensity-like score',
    },
    current: {
      estimateType: 'propensity_matched_logistic_v2',
      method: 'nearest-neighbor on logistic PS + Austin caliper',
    },
    interpretation: 'API 同時回傳 legacy 與 v2；儀表板預設顯示 v2（quasiCausalEstimates）。',
    causalClaimAllowed: false,
  },
  {
    id: 'resource_effect_ipw',
    metric: '資源效應（IPW 加權）',
    legacy: {
      estimateType: 'propensity_weighted_observational',
      method: 'stabilized IPW on propensity-like score',
    },
    current: {
      estimateType: 'propensity_weighted_logistic_v2',
      method: 'stabilized IPW on logistic PS',
    },
    interpretation: '與 matched estimate 方向一致時可提高趨勢判讀信心；仍非因果證明。',
    causalClaimAllowed: false,
  },
  {
    id: 'resource_effect_aipw',
    metric: '資源效應（AIPW，新增）',
    legacy: {
      estimateType: '—',
      method: '未實作',
    },
    current: {
      estimateType: 'aipw_doubly_robust_v2',
      method: 'augmented IPW = IPW 殘差修正 + outcome regression（doubly robust）',
      reference: 'Bang & Robins (2005); Lunceford & Davidian (2004)',
    },
    interpretation: '第三種輔助估計；propensity 或 outcome 模型之一正確時較穩健。請與 matching / IPW 交叉比對。',
    causalClaimAllowed: false,
  },
]);

const LVA_ACTIVE_METHODS = Object.freeze({
  adjustedGrowth: 'baseline_adjusted_regression_v2',
  quasiCausalEstimates: 'propensity_matched_logistic_v2',
  propensityWeightedEstimates: 'propensity_weighted_logistic_v2',
  aipwEstimates: 'aipw_doubly_robust_v2',
  legacyAvailable: true,
});

function getMethodComparisonPayload() {
  return {
    activeMethods: LVA_ACTIVE_METHODS,
    rows: LVA_METHOD_COMPARISON,
    disclaimer: '所有 estimateType 之 causalClaimAllowed 均為 false；請勿寫成「活動造成能力提升」。',
    docPath: 'docs/learning-analytics-method-comparison.md',
  };
}

module.exports = {
  LVA_METHOD_COMPARISON,
  LVA_ACTIVE_METHODS,
  getMethodComparisonPayload,
};
