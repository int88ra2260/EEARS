'use strict';

const domains = require('./domainRegistry');
const gates = require('./decisionGateRegistry');
const temporal = require('./temporalRegistry');
const metrics = require('./metricRegistry');
const legacy = require('./legacyMappings');
const validator = require('./contractValidator');
const golden = require('./goldenCases');
const temporalTime = require('./temporalTime');
const semesterBoundary = require('./semesterBoundaryAdapter');
const legacyTime = require('./legacyTimeAdapter');
const temporalContext = require('./temporalContextBuilder');
const temporalCompatibility = require('./temporalCompatibility');
const temporalRepresentation = require('./temporalBoundaryRepresentation');
const assessmentSources = require('./assessmentSourceRegistry');
const assessmentFlags = require('./assessmentQualityFlags');
const assessmentObservation = require('./assessmentObservation');
const assessmentAdapters = require('./assessmentAdapters');
const assessmentComparison = require('./assessmentComparison');
const activityOpsPilot = require('./pilots/activityOpsOverviewPilot');
const activityOpsFieldContract = require('./pilots/activityOpsFieldContract');
const activityOpsShadowValidator = require('./pilots/activityOpsShadowValidator');
const activityOpsShadowRuntime = require('./pilots/activityOpsShadowRuntime');
const bestepFileQualityContract = require('./pilots/bestepFileQualityContract');
const bestepFileQualityFindings = require('./pilots/bestepFileQualityFindings');
const bestepFileQualityValidator = require('./pilots/bestepFileQualityValidator');
const bestepFileQualityShadowRuntime = require('./pilots/bestepFileQualityShadowRuntime');
const bestepClassAnalyticsContract = require('./pilots/bestepClassAnalyticsContract');
const bestepClassAnalyticsValidator = require('./pilots/bestepClassAnalyticsValidator');
const bestepClassAnalyticsShadowRuntime = require('./pilots/bestepClassAnalyticsShadowRuntime');
const { ContractRegistryError } = require('./errors');

module.exports = {
  ...domains,
  ...gates,
  ...temporal,
  ...metrics,
  ...legacy,
  ...validator,
  ...golden,
  ...temporalTime,
  ...semesterBoundary,
  ...legacyTime,
  ...temporalContext,
  ...temporalCompatibility,
  ...temporalRepresentation,
  ...assessmentSources,
  ...assessmentFlags,
  ...assessmentObservation,
  ...assessmentAdapters,
  ...assessmentComparison,
  ...activityOpsPilot,
  ...activityOpsFieldContract,
  ...activityOpsShadowValidator,
  ...activityOpsShadowRuntime,
  ...bestepFileQualityContract,
  ...bestepFileQualityFindings,
  ...bestepFileQualityValidator,
  ...bestepFileQualityShadowRuntime,
  ...bestepClassAnalyticsContract,
  ...bestepClassAnalyticsValidator,
  ...bestepClassAnalyticsShadowRuntime,
  ContractRegistryError,
};
