'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  AnalyticsModelRun,
  ResourceEffectEstimate,
  LearningGrowthEpisode,
  StudentResourceExposure,
  LjStudentEvent,
} = require('../../../models');
const {
  LVA_VERSION,
  getLvaAnalytics,
  resourceKeyForEvent,
} = require('./lvaAnalyticsService');
const { getResourceSkillProfilesMap } = require('../../learningAnalytics/resourceSkillProfileService');

const MODEL_NAME = 'EEARS-LVA';

function usernameOf(user) {
  return user?.username || user?.account || user?.email || user?.id || null;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildResourceEffectRows(modelRunId, analytics) {
  const descriptiveRows = (analytics.resourceEffectiveness || []).map((row) => ({
    modelRunId,
    resourceType: row.resourceType,
    resourceId: null,
    skill: Array.isArray(row.mainSkills) ? row.mainSkills[0] || null : null,
    estimateType: row.estimateType || 'descriptive',
    rawEffect: numberOrNull(row.rawGrowthAverage),
    adjustedEffect: null,
    causalEffect: null,
    confidenceIntervalLow: numberOrNull(row.confidenceInterval?.low),
    confidenceIntervalHigh: numberOrNull(row.confidenceInterval?.high),
    sampleSize: Number(row.growthSampleSize || 0),
    evidenceQuality: row.evidenceLevel || null,
    causalClaimAllowed: row.causalClaimAllowed === true,
    modelVersion: analytics.version || LVA_VERSION,
    payload: row,
  }));
  const matchedRows = (analytics.quasiCausalEstimates?.byResource || []).map((row) => ({
    modelRunId,
    resourceType: row.resourceType,
    resourceId: null,
    skill: row.skill || null,
    estimateType: row.estimateType || 'propensity_matched_observational',
    rawEffect: null,
    adjustedEffect: null,
    causalEffect: numberOrNull(row.estimatedEffect),
    confidenceIntervalLow: numberOrNull(row.confidenceInterval?.low),
    confidenceIntervalHigh: numberOrNull(row.confidenceInterval?.high),
    sampleSize: Number(row.matchedPairs || 0),
    evidenceQuality: row.evidenceLevel || null,
    causalClaimAllowed: row.causalClaimAllowed === true,
    modelVersion: analytics.version || LVA_VERSION,
    payload: row,
  }));
  const weightedRows = (analytics.propensityWeightedEstimates?.byResource || []).map((row) => ({
    modelRunId,
    resourceType: row.resourceType,
    resourceId: null,
    skill: null,
    estimateType: row.estimateType || 'propensity_weighted_observational',
    rawEffect: null,
    adjustedEffect: null,
    causalEffect: numberOrNull(row.estimatedEffect),
    confidenceIntervalLow: null,
    confidenceIntervalHigh: null,
    sampleSize: Number(row.sampleSize || 0),
    evidenceQuality: row.evidenceLevel || null,
    causalClaimAllowed: row.causalClaimAllowed === true,
    modelVersion: analytics.version || LVA_VERSION,
    payload: row,
  }));
  return [...descriptiveRows, ...matchedRows, ...weightedRows];
}

function buildGrowthEpisodeRows(modelRunId, analytics) {
  return (analytics.adjustedGrowth?.sampleEpisodes || []).map((row) => ({
    modelRunId,
    studentId: row.studentId,
    preSnapshotId: null,
    postSnapshotId: null,
    instrument: row.instrument || null,
    skill: row.skill || 'unknown',
    startDate: null,
    endDate: null,
    monthsBetween: numberOrNull(row.monthsBetweenTests),
    previousGse: numberOrNull(row.previousGse),
    postGse: numberOrNull(row.postGse),
    actualGseGrowth: numberOrNull(row.actualGseGrowth),
    expectedGseGrowth: numberOrNull(row.expectedGseGrowth),
    adjustedGseGrowth: numberOrNull(row.adjustedGseGrowth),
    evidenceQualityScore: row.evidenceQuality || null,
    estimateType: row.estimateType || analytics.adjustedGrowth?.estimateType || 'baseline_adjusted_simplified',
    causalClaimAllowed: row.causalClaimAllowed === true,
    payload: row,
  }));
}

function buildStudentEventWhere(analytics) {
  const studentIds = analytics.adjustedGrowth?.sampleEpisodes?.map((row) => row.studentId).filter(Boolean) || [];
  const where = {
    status: { [Op.in]: ['valid', 'registered_no_score'] },
    eventType: { [Op.in]: ['course_event', 'activity_event'] },
  };
  if (studentIds.length) where.studentId = { [Op.in]: [...new Set(studentIds)] };
  return where;
}

function skillExposurePayloadForEvent(event) {
  const resourceType = resourceKeyForEvent(event);
  const hours = numberOrNull(event.hours) || 1;
  const profile = getResourceSkillProfilesMap()[resourceType] || getResourceSkillProfilesMap().ACTIVITY_OTHER;
  const skillExposure = {};
  for (const [key, weight] of Object.entries(profile)) {
    skillExposure[key] = Number((hours * Number(weight || 0)).toFixed(4));
  }
  return { resourceType, hours, profile, skillExposure };
}

async function buildStudentResourceExposureRows(modelRunId, analytics) {
  const events = await LjStudentEvent.findAll({
    where: buildStudentEventWhere(analytics),
    order: [['eventDate', 'ASC'], ['studentId', 'ASC']],
  });
  return events.slice(0, 5000).map((event) => {
    const payload = skillExposurePayloadForEvent(event);
    return {
      modelRunId,
      studentId: event.studentId,
      sourceEventId: event.id || null,
      resourceType: payload.resourceType,
      resourceId: event.sourceRecordId || null,
      participationDate: event.eventDate || null,
      durationMinutes: payload.hours == null ? null : Math.round(payload.hours * 60),
      attendanceStatus: event.status || null,
      attendanceQuality: event.status === 'valid' ? 1 : 0.5,
      skillExposurePayload: payload,
      timeDecayWeight: null,
      validForTestId: null,
      estimateType: 'descriptive',
      causalClaimAllowed: false,
    };
  });
}

async function createLvaModelRun(query = {}, { user } = {}) {
  const startedAt = new Date();
  const analytics = await getLvaAnalytics(query);
  return sequelize.transaction(async (transaction) => {
    const run = await AnalyticsModelRun.create({
      modelName: MODEL_NAME,
      modelVersion: analytics.adjustedGrowth?.modelVersion || analytics.version || LVA_VERSION,
      contractVersion: analytics.contractVersion,
      snapshotVersion: analytics.snapshotVersion,
      semester: query.semester || query.semesterId || null,
      filtersPayload: analytics.filters,
      supportedFiltersPayload: analytics.supportedFilters,
      includedStudentsCount: Number(analytics.rawData?.recordCounts?.analyticStudents || 0),
      excludedStudentsCount: Number(analytics.rawData?.missingDataReport?.excludedOrReasonedStudents || 0),
      missingDataSummary: analytics.rawData?.missingDataReport || {},
      estimatePolicyPayload: analytics.estimatePolicy,
      status: 'completed',
      startedAt,
      finishedAt: new Date(),
      createdBy: usernameOf(user),
    }, { transaction });

    const resourceRows = buildResourceEffectRows(run.id, analytics);
    const growthRows = buildGrowthEpisodeRows(run.id, analytics);
    const exposureRows = await buildStudentResourceExposureRows(run.id, analytics);

    if (resourceRows.length) await ResourceEffectEstimate.bulkCreate(resourceRows, { transaction });
    if (growthRows.length) await LearningGrowthEpisode.bulkCreate(growthRows, { transaction });
    if (exposureRows.length) await StudentResourceExposure.bulkCreate(exposureRows, { transaction });

    return {
      modelRun: run.toJSON(),
      persisted: {
        resourceEffectEstimates: resourceRows.length,
        learningGrowthEpisodes: growthRows.length,
        studentResourceExposures: exposureRows.length,
      },
      analytics,
    };
  });
}

async function listLvaModelRuns(query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const where = { modelName: MODEL_NAME };
  if (query.snapshot_version || query.snapshotVersion) where.snapshotVersion = query.snapshot_version || query.snapshotVersion;
  const { rows, count } = await AnalyticsModelRun.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
  return {
    total: count,
    limit,
    offset,
    items: rows.map((row) => row.toJSON()),
  };
}

async function getLvaModelRun(id) {
  const modelRun = await AnalyticsModelRun.findByPk(id);
  if (!modelRun) return null;
  const [resourceEffects, growthEpisodes, resourceExposures] = await Promise.all([
    ResourceEffectEstimate.findAll({ where: { modelRunId: id }, limit: 200, order: [['id', 'ASC']] }),
    LearningGrowthEpisode.findAll({ where: { modelRunId: id }, limit: 200, order: [['id', 'ASC']] }),
    StudentResourceExposure.findAll({ where: { modelRunId: id }, limit: 200, order: [['id', 'ASC']] }),
  ]);
  return {
    modelRun: modelRun.toJSON(),
    resourceEffects: resourceEffects.map((row) => row.toJSON()),
    growthEpisodes: growthEpisodes.map((row) => row.toJSON()),
    resourceExposures: resourceExposures.map((row) => row.toJSON()),
  };
}

module.exports = {
  MODEL_NAME,
  createLvaModelRun,
  listLvaModelRuns,
  getLvaModelRun,
};
