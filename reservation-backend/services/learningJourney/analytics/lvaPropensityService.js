'use strict';

const { getLvaConfig } = require('../../learningAnalytics/learningAnalyticsLvaConfigService');
const { LVA_CONFIG_DEFAULTS } = require('../../learningAnalytics/learningAnalyticsLvaDefaults');
const {
  round,
  mean,
  stddev,
  clamp,
  logit,
  fitLogisticRegression,
  predictLogistic,
  computeAustinLogitCaliper,
  ci95,
  fitOlsRegression,
  predictOls,
} = require('./lvaMathUtils');

const GSE_MAX = 90;
const MATCHED_LEGACY = 'propensity_matched_observational';
const MATCHED_V2 = 'propensity_matched_logistic_v2';
const WEIGHTED_LEGACY = 'propensity_weighted_observational';
const WEIGHTED_V2 = 'propensity_weighted_logistic_v2';
const AIPW_ESTIMATE = 'aipw_doubly_robust_v2';

function qualityScore(row, cfg) {
  const scores = cfg.evidenceQualityScores || LVA_CONFIG_DEFAULTS.evidenceQualityScores;
  return scores[row.evidenceQuality] ?? scores.low ?? 0.2;
}

function propensityLikeScoreLegacy(row) {
  const cfg = getLvaConfig();
  const propensityWeights = cfg.propensityWeights || LVA_CONFIG_DEFAULTS.propensityWeights;
  const baseline = row.baselineGse == null ? 0.45 : clamp(row.baselineGse / GSE_MAX, 0, 1);
  const quality = qualityScore(row, cfg);
  const cap = propensityWeights.resourceHoursCap || LVA_CONFIG_DEFAULTS.propensityWeights.resourceHoursCap;
  const resource = clamp(Number(row.resourceHoursBeforeExam || 0) / cap, 0, 1);
  return round(
    (baseline * propensityWeights.baseline)
    + (quality * propensityWeights.quality)
    + (resource * propensityWeights.resource),
    4
  );
}

function clampProbability(value) {
  const limits = getLvaConfig().propensityClamp || LVA_CONFIG_DEFAULTS.propensityClamp;
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.5;
  return clamp(num, limits.min, limits.max);
}

function buildPropensityFeatureSpec(rows) {
  const skills = [...new Set(rows.map((row) => row.skill))].sort();
  const bands = [...new Set(rows.map((row) => row.initialCefrBand))].sort();
  return {
    skills,
    bands,
    featureNames: [
      'intercept',
      'baselineGseNorm',
      'qualityScore',
      'resourceHoursNorm',
      'monthsBetweenTests',
      ...skills.map((skill) => `skill:${skill}`),
      ...bands.map((band) => `band:${band}`),
    ],
  };
}

function buildPropensityFeatureVector(row, spec, cfg) {
  const propensityWeights = cfg.propensityWeights || LVA_CONFIG_DEFAULTS.propensityWeights;
  const cap = propensityWeights.resourceHoursCap || LVA_CONFIG_DEFAULTS.propensityWeights.resourceHoursCap;
  const baselineNorm = row.baselineGse == null ? 0.4 : clamp(row.baselineGse / GSE_MAX, 0, 1);
  const resourceNorm = clamp(Number(row.resourceHoursBeforeExam || 0) / cap, 0, 1);
  const months = row.monthsBetweenTests == null ? spec.medianMonths ?? 12 : row.monthsBetweenTests;
  const vector = [
    1,
    baselineNorm,
    qualityScore(row, cfg),
    resourceNorm,
    months,
  ];
  for (const skill of spec.skills) vector.push(row.skill === skill ? 1 : 0);
  for (const band of spec.bands) vector.push(row.initialCefrBand === band ? 1 : 0);
  return vector;
}

function fitPropensityModel(rows, treatedFn) {
  if (rows.length < 12) return null;
  const cfg = getLvaConfig();
  const treatedCount = rows.filter((row) => treatedFn(row)).length;
  const controlCount = rows.length - treatedCount;
  if (treatedCount < 3 || controlCount < 3) return null;

  const monthsValues = rows.map((row) => row.monthsBetweenTests).filter((v) => v != null && v > 0);
  const spec = buildPropensityFeatureSpec(rows);
  spec.medianMonths = monthsValues.length ? mean(monthsValues) : 12;

  const designMatrix = rows.map((row) => buildPropensityFeatureVector(row, spec, cfg));
  const outcomes = rows.map((row) => (treatedFn(row) ? 1 : 0));
  const model = fitLogisticRegression(designMatrix, outcomes, { ridge: 1e-3, learningRate: 0.2 });
  if (!model) return null;
  return { ...model, spec };
}

function predictPropensity(row, model, cfg) {
  if (!model) return propensityLikeScoreLegacy(row);
  const features = buildPropensityFeatureVector(row, model.spec, cfg);
  const score = predictLogistic(model, features);
  return score == null ? propensityLikeScoreLegacy(row) : clampProbability(score);
}

function covariateDistanceLegacy(treated, control) {
  const penalties = getLvaConfig().covariateDistancePenalties || LVA_CONFIG_DEFAULTS.covariateDistancePenalties;
  let distance = Math.abs(propensityLikeScoreLegacy(treated) - propensityLikeScoreLegacy(control));
  if (treated.skill !== control.skill) distance += penalties.skillMismatch;
  if (treated.initialCefrBand !== control.initialCefrBand) distance += penalties.bandMismatch;
  if (treated.department !== control.department) distance += penalties.departmentMismatch;
  if (treated.evidenceQuality !== control.evidenceQuality) distance += penalties.qualityMismatch;
  return distance;
}

function logitPropensityDistance(treated, control, model, cfg) {
  const pTreated = predictPropensity(treated, model, cfg);
  const pControl = predictPropensity(control, model, cfg);
  return Math.abs(logit(pTreated) - logit(pControl));
}

function matchedControlsLegacy(treated, controls, { maxMatches, caliper } = {}) {
  const cfg = getLvaConfig();
  const resolvedMaxMatches = Number.isFinite(Number(maxMatches))
    ? Math.max(1, Number(maxMatches))
    : (cfg.maxMatches || LVA_CONFIG_DEFAULTS.maxMatches);
  const resolvedCaliper = Number.isFinite(Number(caliper))
    ? Math.max(0, Number(caliper))
    : (cfg.matchingCaliper || LVA_CONFIG_DEFAULTS.matchingCaliper);
  return controls
    .filter((control) => control.skill === treated.skill)
    .map((control) => ({ control, distance: covariateDistanceLegacy(treated, control) }))
    .filter(({ distance }) => distance <= resolvedCaliper)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, resolvedMaxMatches);
}

function matchedControlsV2(treated, controls, model, cfg, { maxMatches, caliperOnLogit } = {}) {
  const resolvedMaxMatches = Number.isFinite(Number(maxMatches))
    ? Math.max(1, Number(maxMatches))
    : (cfg.maxMatches || LVA_CONFIG_DEFAULTS.maxMatches);
  const resolvedCaliper = Number.isFinite(Number(caliperOnLogit))
    ? Math.max(0, Number(caliperOnLogit))
    : 0.2;
  return controls
    .filter((control) => control.skill === treated.skill)
    .map((control) => ({
      control,
      distance: logitPropensityDistance(treated, control, model, cfg),
    }))
    .filter(({ distance }) => distance <= resolvedCaliper)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, resolvedMaxMatches);
}

function weightedMean(rows, valueFn, weightFn) {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const row of rows) {
    const value = Number(valueFn(row));
    const weight = Number(weightFn(row));
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) continue;
    weightedSum += value * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : null;
}

function standardizedMeanDifference(treatedValues, controlValues) {
  const treatedMean = mean(treatedValues);
  const controlMean = mean(controlValues);
  if (treatedMean == null || controlMean == null) return null;
  const treatedSd = stddev(treatedValues);
  const controlSd = stddev(controlValues);
  const pooled = Math.sqrt(((treatedSd ** 2) + (controlSd ** 2)) / 2);
  if (!pooled) return treatedMean === controlMean ? 0 : null;
  return round((treatedMean - controlMean) / pooled, 4);
}

function exactMatchRate(pairs, field) {
  if (!pairs.length) return null;
  const matches = pairs.filter(({ treated, control }) => treated[field] === control[field]).length;
  return round(matches / pairs.length, 4);
}

function buildBalanceDiagnostics(matchedPairs, propensityFn) {
  const treated = matchedPairs.map((pair) => pair.treated);
  const controls = matchedPairs.map((pair) => pair.control);
  const diagnostics = {
    baselineGse: {
      treatedMean: round(mean(treated.map((row) => row.baselineGse)), 2),
      controlMean: round(mean(controls.map((row) => row.baselineGse)), 2),
      standardizedMeanDifference: standardizedMeanDifference(
        treated.map((row) => row.baselineGse),
        controls.map((row) => row.baselineGse)
      ),
    },
    propensityScore: {
      treatedMean: round(mean(treated.map(propensityFn)), 4),
      controlMean: round(mean(controls.map(propensityFn)), 4),
      standardizedMeanDifference: standardizedMeanDifference(
        treated.map(propensityFn),
        controls.map(propensityFn)
      ),
    },
    propensityLikeScore: {
      treatedMean: round(mean(treated.map(propensityFn)), 4),
      controlMean: round(mean(controls.map(propensityFn)), 4),
      standardizedMeanDifference: standardizedMeanDifference(
        treated.map(propensityFn),
        controls.map(propensityFn)
      ),
    },
    resourceHoursBeforeExam: {
      treatedMean: round(mean(treated.map((row) => row.resourceHoursBeforeExam)), 2),
      controlMean: round(mean(controls.map((row) => row.resourceHoursBeforeExam)), 2),
      standardizedMeanDifference: standardizedMeanDifference(
        treated.map((row) => row.resourceHoursBeforeExam),
        controls.map((row) => row.resourceHoursBeforeExam)
      ),
    },
    initialCefrBand: { exactMatchRate: exactMatchRate(matchedPairs, 'initialCefrBand') },
    department: { exactMatchRate: exactMatchRate(matchedPairs, 'department') },
    evidenceQuality: { exactMatchRate: exactMatchRate(matchedPairs, 'evidenceQuality') },
    skill: { exactMatchRate: exactMatchRate(matchedPairs, 'skill') },
  };
  const smdValues = [
    diagnostics.baselineGse.standardizedMeanDifference,
    diagnostics.propensityScore.standardizedMeanDifference,
    diagnostics.resourceHoursBeforeExam.standardizedMeanDifference,
  ].filter((value) => value != null).map((value) => Math.abs(Number(value)));
  const exactValues = [
    diagnostics.initialCefrBand.exactMatchRate,
    diagnostics.department.exactMatchRate,
    diagnostics.evidenceQuality.exactMatchRate,
    diagnostics.skill.exactMatchRate,
  ].filter((value) => value != null).map(Number);
  const maxSmd = smdValues.length ? Math.max(...smdValues) : null;
  const minExact = exactValues.length ? Math.min(...exactValues) : null;
  let balanceQuality = 'good';
  if ((maxSmd != null && maxSmd > 0.5) || (minExact != null && minExact < 0.5)) balanceQuality = 'poor';
  else if ((maxSmd != null && maxSmd > 0.25) || (minExact != null && minExact < 0.75)) balanceQuality = 'caution';
  return { ...diagnostics, balanceQuality };
}

function fitOutcomeModel(rows, cfg) {
  if (rows.length < 5) return null;
  const monthsValues = rows.map((row) => row.monthsBetweenTests).filter((v) => v != null && v > 0);
  const spec = buildPropensityFeatureSpec(rows);
  spec.medianMonths = monthsValues.length ? mean(monthsValues) : 12;
  const designMatrix = rows.map((row) => buildPropensityFeatureVector(row, spec, cfg));
  const outcomes = rows.map((row) => row.adjustedGseGrowth);
  const model = fitOlsRegression(designMatrix, outcomes, { ridge: 1e-3 });
  if (!model) return null;
  return { ...model, spec };
}

function predictOutcome(row, model, cfg, treatedFlag) {
  if (!model) return mean([row.adjustedGseGrowth]) ?? 0;
  const features = buildPropensityFeatureVector(row, model.spec, cfg);
  const prediction = predictOls(model, features);
  if (!Number.isFinite(prediction)) return row.adjustedGseGrowth;
  return prediction;
}

function summarizeMatchedEstimates(events, episodes, options = {}) {
  const cfg = getLvaConfig();
  const {
    estimateType,
    method,
    matchFn,
    propensityFn: propensityFnOverride,
    limitations,
    useAustinCaliper = false,
    propensityMode = 'legacy',
  } = options;

  if (!episodes.length) {
    return {
      estimateType,
      causalClaimAllowed: false,
      method,
      caliper: null,
      caliperType: useAustinCaliper ? 'austin_logit_sd' : 'fixed_heuristic',
      sampleSize: 0,
      byResource: [],
      limitations: ['缺少 adjusted growth episodes，無法建立比較組。'],
    };
  }

  const participantMap = new Map();
  for (const event of events) {
    const resourceType = options.resourceKeyForEvent(event);
    if (!participantMap.has(resourceType)) participantMap.set(resourceType, new Set());
    participantMap.get(resourceType).add(event.studentId);
  }

  const rows = [];
  for (const [resourceType, participantIds] of participantMap.entries()) {
    const treated = episodes.filter((row) => participantIds.has(row.studentId));
    const controls = episodes.filter((row) => !participantIds.has(row.studentId));
    const treatedFn = (row) => participantIds.has(row.studentId);
    const propensityModel = propensityMode === 'logistic' ? fitPropensityModel(episodes, treatedFn) : null;
    const propensityFn = propensityFnOverride || ((row) => predictPropensity(row, propensityModel, cfg));
    const analyticRows = episodes.map((row) => ({
      ...row,
      treated: treatedFn(row),
      propensity: propensityFn(row),
    }));
    const allPropensities = analyticRows.map((row) => row.propensity);
    const useAustin = useAustinCaliper && Boolean(propensityModel);
    const caliper = useAustin
      ? (computeAustinLogitCaliper(allPropensities) ?? cfg.matchingCaliper)
      : (Number.isFinite(Number(options.caliper)) ? Number(options.caliper) : cfg.matchingCaliper);

    const matchedDiffs = [];
    const matchedDistances = [];
    const matchedPairs = [];
    let unmatchedTreatedCount = 0;
    const resourceMatchFn = propensityMode === 'logistic' && propensityModel
      ? (treatedRow, controlRows, matchOptions) => matchedControlsV2(treatedRow, controlRows, propensityModel, cfg, matchOptions)
      : (treatedRow, controlRows, matchOptions) => matchedControlsLegacy(treatedRow, controlRows, matchOptions);

    for (const treatedRow of treated) {
      const matches = resourceMatchFn(treatedRow, controls, { caliper, caliperOnLogit: caliper, maxMatches: cfg.maxMatches });
      if (!matches.length) {
        unmatchedTreatedCount += 1;
        continue;
      }
      const controlMean = mean(matches.map(({ control }) => control.adjustedGseGrowth));
      if (controlMean == null) continue;
      matchedDiffs.push(Number(treatedRow.adjustedGseGrowth) - controlMean);
      matchedDistances.push(mean(matches.map(({ distance }) => distance)));
      for (const match of matches) matchedPairs.push({ treated: treatedRow, control: match.control, distance: match.distance });
    }

    const effect = mean(matchedDiffs);
    rows.push({
      resourceType,
      skill: null,
      treatedCount: treated.length,
      controlPoolCount: controls.length,
      matchedPairs: matchedDiffs.length,
      unmatchedTreatedCount,
      unmatchedTreatedRate: treated.length ? round(unmatchedTreatedCount / treated.length, 4) : null,
      estimatedEffect: effect == null ? null : round(effect, 2),
      confidenceInterval: ci95(matchedDiffs),
      averageMatchDistance: round(mean(matchedDistances), 4),
      caliper,
      caliperType: useAustin ? 'austin_logit_sd' : 'fixed_heuristic',
      estimateType,
      causalClaimAllowed: false,
      evidenceLevel: matchedDiffs.length >= 30 ? 'quasi_causal_observational_medium' : 'quasi_causal_observational_low',
      balanceDiagnostics: buildBalanceDiagnostics(matchedPairs, propensityFn),
      method,
      propensityModel: propensityModel ? 'logistic_regression' : 'heuristic_weighted_sum',
      covariates: ['baselineGse', 'initialCefrBand', 'department', 'evidenceQuality', 'resourceHoursBeforeExam', 'monthsBetweenTests', 'skill'],
      interpretation: '背景相近比較組的觀察資料估計；仍可能受未觀察因素影響。',
    });
  }

  return {
    estimateType,
    causalClaimAllowed: false,
    method,
    caliper: rows[0]?.caliper ?? null,
    caliperType: useAustinCaliper ? 'austin_logit_sd' : 'fixed_heuristic',
    sampleSize: rows.reduce((sum, row) => sum + row.matchedPairs, 0),
    byResource: rows.sort((a, b) => (b.estimatedEffect ?? -Infinity) - (a.estimatedEffect ?? -Infinity)),
    limitations,
  };
}

function summarizeQuasiCausalEstimatesLegacy(events, adjustedGrowth, options = {}) {
  return summarizeMatchedEstimates(events, adjustedGrowth?.sampleEpisodes || [], {
    ...options,
    estimateType: MATCHED_LEGACY,
    method: 'nearest-neighbor matching on propensity-like score',
    propensityMode: 'legacy',
    limitations: [
      'propensity-like score 為可解釋啟發式加權和，非 logistic 校準。',
      'caliper 為固定啟發式距離，非 Austin (2011) logit SD 規則。',
      'balance diagnostics 僅檢查已觀測變數，無法處理未觀測混淆。',
      '估計仍不可作為單獨因果宣稱。',
    ],
  });
}

function summarizeQuasiCausalEstimatesV2(events, adjustedGrowth, options = {}) {
  if (Number.isFinite(Number(options.caliper)) && Number(options.caliper) > 0) {
    return summarizeQuasiCausalEstimatesLegacy(events, adjustedGrowth, options);
  }
  return summarizeMatchedEstimates(events, adjustedGrowth?.sampleEpisodes || [], {
    ...options,
    estimateType: MATCHED_V2,
    method: 'nearest-neighbor matching on logistic propensity score with Austin logit caliper',
    propensityMode: 'logistic',
    useAustinCaliper: true,
    limitations: [
      'propensity score 由 logistic 回歸估計；caliper 採 Austin (2011) 0.2×SD(logit PS)。',
      '樣本不足時會回退至啟發式 propensity-like score 與固定 caliper。',
      'matching 僅控制已觀測共變量，未觀測混淆仍可能存在。',
      '估計仍不可作為單獨因果宣稱。',
    ],
  });
}

function summarizePropensityWeightedEstimatesLegacy(events, adjustedGrowth, options = {}) {
  const episodes = adjustedGrowth?.sampleEpisodes || [];
  const cfg = getLvaConfig();
  if (!episodes.length) {
    return {
      estimateType: WEIGHTED_LEGACY,
      causalClaimAllowed: false,
      method: 'stabilized inverse probability weighting on propensity-like score',
      sampleSize: 0,
      byResource: [],
      limitations: ['缺少 adjusted growth episodes，無法建立 weighted estimate。'],
    };
  }

  const participantMap = new Map();
  for (const event of events) {
    const resourceType = options.resourceKeyForEvent(event);
    if (!participantMap.has(resourceType)) participantMap.set(resourceType, new Set());
    participantMap.get(resourceType).add(event.studentId);
  }

  const rows = [];
  for (const [resourceType, participantIds] of participantMap.entries()) {
    const analyticRows = episodes.map((episode) => {
      const treated = participantIds.has(episode.studentId);
      const pRaw = propensityLikeScoreLegacy(episode);
      const propensity = clampProbability(treated ? Math.max(pRaw, 0.1) : Math.min(pRaw, 0.9));
      return { ...episode, treated, propensity };
    });
    const treatedRows = analyticRows.filter((row) => row.treated);
    const controlRows = analyticRows.filter((row) => !row.treated);
    const treatedRate = analyticRows.length ? treatedRows.length / analyticRows.length : 0;
    const pTreated = clampProbability(treatedRate);

    const treatedMean = weightedMean(
      treatedRows,
      (row) => row.adjustedGseGrowth,
      (row) => pTreated / row.propensity
    );
    const controlMean = weightedMean(
      controlRows,
      (row) => row.adjustedGseGrowth,
      (row) => (1 - pTreated) / (1 - row.propensity)
    );
    const effect = treatedMean != null && controlMean != null ? treatedMean - controlMean : null;

    rows.push({
      resourceType,
      treatedCount: treatedRows.length,
      controlCount: controlRows.length,
      sampleSize: analyticRows.length,
      treatedWeightedMean: treatedMean == null ? null : round(treatedMean, 2),
      controlWeightedMean: controlMean == null ? null : round(controlMean, 2),
      estimatedEffect: effect == null ? null : round(effect, 2),
      averagePropensityTreated: round(mean(treatedRows.map((row) => row.propensity)), 4),
      averagePropensityControl: round(mean(controlRows.map((row) => row.propensity)), 4),
      estimateType: WEIGHTED_LEGACY,
      causalClaimAllowed: false,
      evidenceLevel: analyticRows.length >= 50 && treatedRows.length >= 10 && controlRows.length >= 10
        ? 'quasi_causal_weighted_medium'
        : 'quasi_causal_weighted_low',
      method: 'stabilized inverse probability weighting on propensity-like score',
      propensityModel: 'heuristic_weighted_sum',
      interpretation: 'IPW 觀察資料估計；若與 matched estimate 方向一致，可增加趨勢判讀信心，但仍非因果證明。',
    });
  }

  return {
    estimateType: WEIGHTED_LEGACY,
    causalClaimAllowed: false,
    method: 'stabilized inverse probability weighting on propensity-like score',
    sampleSize: rows.reduce((sum, row) => sum + row.sampleSize, 0),
    byResource: rows.sort((a, b) => (b.estimatedEffect ?? -Infinity) - (a.estimatedEffect ?? -Infinity)),
    limitations: [
      'propensity-like score 為啟發式加權和，非 logistic treatment model。',
      'IPW 對極端 propensity 敏感；以 propensityClamp 降低不穩定性。',
      '估計仍不可作為單獨因果宣稱。',
    ],
  };
}

function summarizePropensityWeightedEstimatesV2(events, adjustedGrowth, options = {}) {
  const episodes = adjustedGrowth?.sampleEpisodes || [];
  const cfg = getLvaConfig();
  if (!episodes.length) {
    return {
      estimateType: WEIGHTED_V2,
      causalClaimAllowed: false,
      method: 'stabilized IPW on logistic propensity score',
      sampleSize: 0,
      byResource: [],
      limitations: ['缺少 adjusted growth episodes，無法建立 weighted estimate。'],
    };
  }

  const participantMap = new Map();
  for (const event of events) {
    const resourceType = options.resourceKeyForEvent(event);
    if (!participantMap.has(resourceType)) participantMap.set(resourceType, new Set());
    participantMap.get(resourceType).add(event.studentId);
  }

  const rows = [];
  for (const [resourceType, participantIds] of participantMap.entries()) {
    const treatedFn = (row) => participantIds.has(row.studentId);
    const model = fitPropensityModel(episodes, treatedFn);
    const analyticRows = episodes.map((episode) => {
      const treated = treatedFn(episode);
      const propensity = predictPropensity(episode, model, cfg);
      const adjustedPropensity = clampProbability(treated ? Math.max(propensity, 0.1) : Math.min(propensity, 0.9));
      return { ...episode, treated, propensity: adjustedPropensity };
    });
    const treatedRows = analyticRows.filter((row) => row.treated);
    const controlRows = analyticRows.filter((row) => !row.treated);
    const treatedRate = analyticRows.length ? treatedRows.length / analyticRows.length : 0;
    const pTreated = clampProbability(treatedRate);

    const treatedMean = weightedMean(
      treatedRows,
      (row) => row.adjustedGseGrowth,
      (row) => pTreated / row.propensity
    );
    const controlMean = weightedMean(
      controlRows,
      (row) => row.adjustedGseGrowth,
      (row) => (1 - pTreated) / (1 - row.propensity)
    );
    const effect = treatedMean != null && controlMean != null ? treatedMean - controlMean : null;

    rows.push({
      resourceType,
      treatedCount: treatedRows.length,
      controlCount: controlRows.length,
      sampleSize: analyticRows.length,
      treatedWeightedMean: treatedMean == null ? null : round(treatedMean, 2),
      controlWeightedMean: controlMean == null ? null : round(controlMean, 2),
      estimatedEffect: effect == null ? null : round(effect, 2),
      averagePropensityTreated: round(mean(treatedRows.map((row) => row.propensity)), 4),
      averagePropensityControl: round(mean(controlRows.map((row) => row.propensity)), 4),
      estimateType: WEIGHTED_V2,
      causalClaimAllowed: false,
      evidenceLevel: analyticRows.length >= 50 && treatedRows.length >= 10 && controlRows.length >= 10
        ? 'quasi_causal_weighted_medium'
        : 'quasi_causal_weighted_low',
      method: model
        ? 'stabilized inverse probability weighting on logistic propensity score'
        : 'stabilized IPW (fallback to heuristic propensity-like score)',
      propensityModel: model ? 'logistic_regression' : 'heuristic_weighted_sum',
      interpretation: 'IPW 觀察資料估計；若與 matched / AIPW 方向一致，可增加趨勢判讀信心，但仍非因果證明。',
    });
  }

  return {
    estimateType: WEIGHTED_V2,
    causalClaimAllowed: false,
    method: 'stabilized inverse probability weighting on logistic propensity score',
    sampleSize: rows.reduce((sum, row) => sum + row.sampleSize, 0),
    byResource: rows.sort((a, b) => (b.estimatedEffect ?? -Infinity) - (a.estimatedEffect ?? -Infinity)),
    limitations: [
      'logistic propensity 在樣本不足時會回退至啟發式 propensity-like score。',
      'IPW 對極端 propensity 敏感；以 propensityClamp 降低不穩定性。',
      '估計仍不可作為單獨因果宣稱。',
    ],
  };
}

function summarizeAipwEstimates(events, adjustedGrowth, options = {}) {
  const episodes = adjustedGrowth?.sampleEpisodes || [];
  const cfg = getLvaConfig();
  if (!episodes.length) {
    return {
      estimateType: AIPW_ESTIMATE,
      causalClaimAllowed: false,
      method: 'augmented inverse probability weighting (doubly robust)',
      sampleSize: 0,
      byResource: [],
      limitations: ['缺少 adjusted growth episodes，無法建立 AIPW estimate。'],
    };
  }

  const participantMap = new Map();
  for (const event of events) {
    const resourceType = options.resourceKeyForEvent(event);
    if (!participantMap.has(resourceType)) participantMap.set(resourceType, new Set());
    participantMap.get(resourceType).add(event.studentId);
  }

  const rows = [];
  for (const [resourceType, participantIds] of participantMap.entries()) {
    const treatedFn = (row) => participantIds.has(row.studentId);
    const model = fitPropensityModel(episodes, treatedFn);
    const treatedRows = episodes.filter(treatedFn);
    const controlRows = episodes.filter((row) => !treatedFn(row));
    const outcomeModelTreated = fitOutcomeModel(treatedRows, cfg);
    const outcomeModelControl = fitOutcomeModel(controlRows, cfg);

    const drValues = [];
    for (const row of episodes) {
      const treated = treatedFn(row) ? 1 : 0;
      const e = predictPropensity(row, model, cfg);
      const mu1 = predictOutcome(row, outcomeModelTreated, cfg, true);
      const mu0 = predictOutcome(row, outcomeModelControl, cfg, false);
      const y = row.adjustedGseGrowth;
      const dr = ((treated / e) - ((1 - treated) / (1 - e))) * (y - (treated ? mu1 : mu0)) + (mu1 - mu0);
      if (Number.isFinite(dr)) drValues.push(dr);
    }

    rows.push({
      resourceType,
      treatedCount: treatedRows.length,
      controlCount: controlRows.length,
      sampleSize: episodes.length,
      estimatedEffect: drValues.length ? round(mean(drValues), 2) : null,
      confidenceInterval: ci95(drValues),
      estimateType: AIPW_ESTIMATE,
      causalClaimAllowed: false,
      evidenceLevel: drValues.length >= 30 ? 'quasi_causal_dr_medium' : 'quasi_causal_dr_low',
      method: 'augmented inverse probability weighting (doubly robust)',
      propensityModel: model ? 'logistic_regression' : 'heuristic_weighted_sum',
      outcomeModel: outcomeModelTreated && outcomeModelControl ? 'ols_on_covariates' : 'sample_mean_fallback',
      interpretation: 'AIPW 結合 outcome regression 與 IPW；在 propensity 或 outcome 模型之一正確時較穩健，但仍非 RCT 因果證明。',
    });
  }

  return {
    estimateType: AIPW_ESTIMATE,
    causalClaimAllowed: false,
    method: 'augmented inverse probability weighting (doubly robust)',
    sampleSize: rows.reduce((sum, row) => sum + row.sampleSize, 0),
    byResource: rows.sort((a, b) => (b.estimatedEffect ?? -Infinity) - (a.estimatedEffect ?? -Infinity)),
    limitations: [
      'AIPW 為 doubly robust 輔助估計，需與 matching / IPW 交叉比對。',
      'outcome model 在樣本過少時會退化为樣本平均。',
      '估計仍不可作為單獨因果宣稱。',
    ],
  };
}

module.exports = {
  MATCHED_LEGACY,
  MATCHED_V2,
  WEIGHTED_LEGACY,
  WEIGHTED_V2,
  AIPW_ESTIMATE,
  propensityLikeScoreLegacy,
  summarizeQuasiCausalEstimatesLegacy,
  summarizeQuasiCausalEstimatesV2,
  summarizePropensityWeightedEstimatesLegacy,
  summarizePropensityWeightedEstimatesV2,
  summarizeAipwEstimates,
};
