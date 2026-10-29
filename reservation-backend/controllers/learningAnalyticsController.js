'use strict';

const { getLearningAnalyticsOverview } = require('../services/learningAnalytics/learningAnalyticsOverviewService');
const { getLearningAnalyticsCohorts } = require('../services/learningAnalytics/learningAnalyticsCohortService');
const { getLearningAnalyticsOfferings, getLearningAnalyticsOfferingDetail } = require('../services/learningAnalytics/learningAnalyticsOfferingService');
const { buildOfferingsExportWorkbook } = require('../services/learningAnalytics/learningAnalyticsOfferingExportService');
const { getLearningAnalyticsMeta } = require('../services/learningAnalytics/learningAnalyticsMetaService');
const { getLearningAnalyticsSkills } = require('../services/learningAnalytics/learningAnalyticsGrowthService');
const { getLvaAnalytics } = require('../services/learningJourney/analytics/lvaAnalyticsService');
const { queryAnalyticStudents, queryAnalyticExams, queryAnalyticEvents } = require('../services/learningJourney/analytics/analyticsQueryService');
const { getStudentTimeline } = require('../services/learningJourney/analytics/timelineReadService');
const { buildRawDataExportWorkbook, buildRawDataExportCsv } = require('../services/learningAnalytics/learningAnalyticsRawDataExportService');
const { pruneAnalyticsSnapshots } = require('../services/learningAnalytics/learningAnalyticsSnapshotGovernanceService');
const { getLearningAnalyticsSettings, updateLearningAnalyticsResourceSkillProfiles, resetLearningAnalyticsResourceSkillProfile, updateLearningAnalyticsFilterReferences, updateLearningAnalyticsLvaConfig, resetLearningAnalyticsLvaConfig } = require('../services/learningAnalytics/learningAnalyticsSettingsService');
const {
  getStudentRecommendations,
  getAdvancedVisualizations,
} = require('../services/learningAnalytics/learningAnalyticsDecisionSupportService');
const {
  createLvaModelRun,
  listLvaModelRuns,
  getLvaModelRun,
} = require('../services/learningJourney/analytics/lvaModelRunService');
const { logExportAudit } = require('../utils/exportAudit');
const { sendAnalyticsError } = require('../services/learningAnalytics/learningAnalyticsClientError');
const { assertCanAccessStudent, sendStudentScopeDenied } = require('../services/accessControl/studentScopeGuard');
const {
  listKpiPolicies,
  getKpiPolicyById,
  createKpiPolicy,
  cloneKpiPolicy,
  updateKpiPolicy,
  archiveKpiPolicy,
} = require('../services/learningAnalytics/kpiPolicyService');
const { runKpiReport } = require('../services/learningAnalytics/kpiReportService');
const { buildKpiReportWorkbook } = require('../services/learningAnalytics/kpiReportExportService');
const { runKpiGapReport } = require('../services/learningAnalytics/kpiGapService');
const { buildKpiGapWorkbook } = require('../services/learningAnalytics/kpiGapExportService');
const { getStudentExplorer } = require('../services/learningAnalytics/learningAnalyticsStudentExplorerService');
const { getB1PlusWatch } = require('../services/learningAnalytics/learningAnalyticsB1PlusService');
const { buildStudentExplorerExportWorkbook } = require('../services/learningAnalytics/learningAnalyticsStudentExplorerExportService');
const {
  createTrackingCohort,
  listTrackingCohorts,
  getTrackingCohort,
  deleteTrackingCohort,
} = require('../services/learningAnalytics/learningAnalyticsTrackingCohortService');

function readAnalyticsQuery(req) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  return { ...(req.query || {}), ...body };
}

function readKpiInput(source = {}) {
  return {
    policyId: source.policyId,
    policyKey: source.policyKey,
    semesterId: source.semesterId || source.semester,
    academicYear: source.academicYear,
    dateFrom: source.dateFrom,
    dateTo: source.dateTo,
    includeRows: source.includeRows !== false,
    studentIds: source.studentIds || source.student_ids,
  };
}

function auditFiltersWithoutIds(filters = {}) {
  const next = { ...filters };
  const ids = next.studentIds || next.student_ids;
  if (Array.isArray(ids)) next.workingSetCount = ids.length;
  else if (typeof ids === 'string' && ids.trim()) next.workingSetCount = ids.split(/[,\s]+/).filter(Boolean).length;
  delete next.studentIds;
  delete next.student_ids;
  return next;
}

async function requireStudentScope(req, res, next) {
  try {
    await assertCanAccessStudent(req.user, req.params.studentId, {
      semesterId: req.query.semesterId || req.query.semester,
    });
    return next();
  } catch (err) {
    return sendStudentScopeDenied(res, err);
  }
}

async function getMeta(req, res) {
  try {
    const data = await getLearningAnalyticsMeta();
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getOverview(req, res) {
  try {
    const data = await getLearningAnalyticsOverview(readAnalyticsQuery(req));
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getB1PlusWatchHandler(req, res) {
  try {
    const data = await getB1PlusWatch(readAnalyticsQuery(req));
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getStudentExplorerHandler(req, res) {
  try {
    const data = await getStudentExplorer(readAnalyticsQuery(req));
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getStudentExplorerExport(req, res) {
  try {
    const exportResult = await buildStudentExplorerExportWorkbook(readAnalyticsQuery(req));
    const {
      workbook,
      fileName,
      rowCount,
      total,
      truncated,
      maxRows,
      filters,
      snapshotVersion,
    } = exportResult;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);

    logExportAudit(req, {
      module: 'learning_analytics',
      action: 'export_student_explorer_xlsx',
      entityType: 'LjAnalyticStudentExplorer',
      entityId: snapshotVersion || 'latest',
      exportType: 'xlsx',
      reportType: 'student_explorer',
      rowCount,
      filters: {
        ...filters,
        total,
        truncated,
        maxRows,
        snapshotVersion,
      },
      fileName,
    });

    return res.end();
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function listTrackingCohortsHandler(req, res) {
  try {
    const data = await listTrackingCohorts();
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function createTrackingCohortHandler(req, res) {
  try {
    const data = await createTrackingCohort({
      name: req.body?.name,
      query: req.body?.filters || {},
      user: req.user || {},
    });
    return res.status(201).json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function getTrackingCohortHandler(req, res) {
  try {
    const data = await getTrackingCohort(req.params.id, req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function deleteTrackingCohortHandler(req, res) {
  try {
    const data = await deleteTrackingCohort(req.params.id);
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function getCohorts(req, res) {
  try {
    const data = await getLearningAnalyticsCohorts(readAnalyticsQuery(req));
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getOfferings(req, res) {
  try {
    const data = await getLearningAnalyticsOfferings(readAnalyticsQuery(req), { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getOfferingDetail(req, res) {
  try {
    const data = await getLearningAnalyticsOfferingDetail(readAnalyticsQuery(req), { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function getOfferingExport(req, res) {
  try {
    const exportResult = await buildOfferingsExportWorkbook(readAnalyticsQuery(req), { user: req.user });
    const {
      workbook,
      fileName,
      dimension,
      filters,
      rowCount,
      studentRowCount,
      truncated,
      maxRows,
    } = exportResult;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);

    logExportAudit(req, {
      module: 'learning_analytics',
      action: 'export_offerings_xlsx',
      entityType: 'LjAnalyticOfferingExport',
      entityId: dimension,
      exportType: 'xlsx',
      reportType: `offerings_${dimension}`,
      rowCount,
      filters: {
        ...filters,
        studentRowCount,
        truncated,
        maxRows,
      },
      fileName,
    });

    return res.end();
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function getResources(req, res) {
  try {
    const lva = await getLvaAnalytics(readAnalyticsQuery(req));
    const data = {
      snapshotVersion: lva.snapshotVersion,
      filters: lva.filters,
      resourceEffectiveness: lva.resourceEffectiveness,
      skillExposure: lva.skillExposure,
      quasiCausalEstimates: lva.quasiCausalEstimates,
      propensityWeightedEstimates: lva.propensityWeightedEstimates,
      aipwEstimates: lva.aipwEstimates,
      methodComparison: lva.methodComparison,
      estimatePolicy: lva.estimatePolicy,
      causalClaimAllowed: false,
    };
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getSkills(req, res) {
  try {
    const data = await getLearningAnalyticsSkills(readAnalyticsQuery(req));
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getStudentJourney(req, res) {
  try {
    const data = await getStudentTimeline(req.params.studentId, {
      snapshotVersion: req.query.snapshot_version || req.query.snapshotVersion,
    });
    if (!data) {
      return res.status(404).json({ success: false, error: '找不到學生', requestId: req.requestId });
    }
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getSettings(req, res) {
  try {
    const data = await getLearningAnalyticsSettings();
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function putResourceSkillProfiles(req, res) {
  try {
    const updates = Array.isArray(req.body?.profiles)
      ? req.body.profiles
      : (req.body?.resourceKey ? [req.body] : []);
    const data = await updateLearningAnalyticsResourceSkillProfiles(updates, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = /不支援|須為|必填/.test(e.message || '') ? 400 : 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function postResetResourceSkillProfile(req, res) {
  try {
    const data = await resetLearningAnalyticsResourceSkillProfile(req.params.resourceKey, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = /不支援/.test(e.message || '') ? 400 : 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function putFilterReferences(req, res) {
  try {
    const refType = req.params.refType;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const data = await updateLearningAnalyticsFilterReferences(refType, items, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = /不支援|重複/.test(e.message || '') ? 400 : 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function putLvaConfig(req, res) {
  try {
    const updates = Array.isArray(req.body?.params) ? req.body.params : [];
    const data = await updateLearningAnalyticsLvaConfig(updates, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = /不支援|須為|不可|必填|migration/.test(e.message || '') ? 400 : 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function postResetLvaConfig(req, res) {
  try {
    const data = await resetLearningAnalyticsLvaConfig({ user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getRawData(req, res) {
  try {
    const query = readAnalyticsQuery(req);
    const dataset = String(query.dataset || 'students').toLowerCase();
    const rawOpts = { forRawExport: true };
    let data;
    if (dataset === 'exams') {
      data = await queryAnalyticExams(query, rawOpts);
    } else if (['courses', 'activities', 'events'].includes(dataset)) {
      data = await queryAnalyticEvents(query, rawOpts);
    } else {
      data = await queryAnalyticStudents(query, rawOpts);
    }
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getExport(req, res) {
  try {
    const query = readAnalyticsQuery(req);
    const format = String(query.format || 'xlsx').toLowerCase();
    if (!['xlsx', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        code: 'UNSUPPORTED_FORMAT',
        error: '目前僅支援 format=xlsx 或 format=csv',
        requestId: req.requestId,
      });
    }

    const exportResult = format === 'csv'
      ? await buildRawDataExportCsv(query)
      : await buildRawDataExportWorkbook(query);

    const {
      fileName,
      dataset,
      filters,
      rowCount,
      total,
      truncated,
    } = exportResult;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(exportResult.buffer);

      logExportAudit(req, {
        module: 'learning_analytics',
        action: 'export_raw_data_csv',
        entityType: 'LjAnalyticExport',
        entityId: dataset,
        exportType: 'csv',
        reportType: dataset,
        rowCount,
        filters: auditFiltersWithoutIds({ ...filters, total, truncated }),
        fileName,
      });
      return res.end();
    }

    const { workbook } = exportResult;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);

    logExportAudit(req, {
      module: 'learning_analytics',
      action: 'export_raw_data_xlsx',
      entityType: 'LjAnalyticExport',
      entityId: dataset,
      exportType: 'xlsx',
      reportType: dataset,
      rowCount,
      filters: auditFiltersWithoutIds({ ...filters, total, truncated }),
      fileName,
    });

    return res.end();
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function postPruneSnapshots(req, res) {
  try {
    const dryRun = req.body?.dryRun !== false;
    const keepGlobalCount = Math.max(1, Number(req.body?.keepGlobalCount) || 1);
    const data = await pruneAnalyticsSnapshots({ dryRun, keepGlobalCount });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getInsights(req, res) {
  try {
    const data = await getAdvancedVisualizations(readAnalyticsQuery(req));
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getStudentRecommendationsHandler(req, res) {
  try {
    const data = await getStudentRecommendations(req.params.studentId, req.query || {});
    if (!data) {
      return res.status(404).json({ success: false, error: '找不到學生', requestId: req.requestId });
    }
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function listModelRuns(req, res) {
  try {
    const data = await listLvaModelRuns(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getModelRun(req, res) {
  try {
    const data = await getLvaModelRun(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: '找不到 Model Run', requestId: req.requestId });
    }
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function postModelRun(req, res) {
  try {
    const data = await createLvaModelRun(req.body?.filters || req.query || {}, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getKpiPolicies(req, res) {
  try {
    const includeArchived = String(req.query.includeArchived || '') === '1'
      || String(req.query.include_archived || '') === 'true';
    const data = await listKpiPolicies({ includeArchived });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function getKpiPolicy(req, res) {
  try {
    const data = await getKpiPolicyById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: '找不到政策', requestId: req.requestId });
    }
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return sendAnalyticsError(req, res, e);
  }
}

async function postKpiPolicy(req, res) {
  try {
    const data = await createKpiPolicy(req.body || {}, { user: req.user });
    return res.status(201).json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function postCloneKpiPolicy(req, res) {
  try {
    const data = await cloneKpiPolicy(req.params.id, req.body || {}, { user: req.user });
    return res.status(201).json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function putKpiPolicy(req, res) {
  try {
    const data = await updateKpiPolicy(req.params.id, req.body || {}, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function postArchiveKpiPolicy(req, res) {
  try {
    const data = await archiveKpiPolicy(req.params.id, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function postKpiReport(req, res) {
  try {
    const data = await runKpiReport(readKpiInput(req.body || {}));
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function getKpiReportExport(req, res) {
  try {
    const q = readKpiInput(readAnalyticsQuery(req));
    const { workbook, fileName } = await buildKpiReportWorkbook(q);
    const buffer = await workbook.xlsx.writeBuffer();
    logExportAudit(req, {
      module: 'learning_analytics',
      action: 'export_kpi_report_xlsx',
      entityType: 'LearningAnalyticsKpiReport',
      entityId: String(q.policyId || q.policyKey || ''),
      exportType: 'xlsx',
      reportType: 'kpi_report',
      rowCount: null,
      filters: {
        policyId: q.policyId,
        policyKey: q.policyKey,
        semesterId: q.semesterId,
        workingSetCount: Array.isArray(q.studentIds) ? q.studentIds.length : 0,
      },
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(Buffer.from(buffer));
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function postKpiGaps(req, res) {
  try {
    const data = await runKpiGapReport(readKpiInput(req.body || {}));
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

async function getKpiGapsExport(req, res) {
  try {
    const q = readKpiInput(readAnalyticsQuery(req));
    const { workbook, fileName, report } = await buildKpiGapWorkbook(q);
    const buffer = await workbook.xlsx.writeBuffer();
    logExportAudit(req, {
      module: 'learning_analytics',
      action: 'export_kpi_gaps_xlsx',
      entityType: 'LearningAnalyticsKpiGaps',
      entityId: String(q.policyId || q.policyKey || ''),
      exportType: 'xlsx',
      reportType: 'kpi_gaps',
      rowCount: report?.gaps?.summary?.notAttainedCount ?? null,
      filters: {
        policyId: q.policyId,
        policyKey: q.policyKey,
        semesterId: q.semesterId,
        workingSetCount: Array.isArray(q.studentIds) ? q.studentIds.length : 0,
      },
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(Buffer.from(buffer));
  } catch (e) {
    const status = e.status || 500;
    return sendAnalyticsError(req, res, e, status);
  }
}

module.exports = {
  requireStudentScope,
  getMeta,
  getSettings,
  putResourceSkillProfiles,
  postResetResourceSkillProfile,
  putFilterReferences,
  putLvaConfig,
  postResetLvaConfig,
  getOverview,
  getStudentExplorer: getStudentExplorerHandler,
  getB1PlusWatch: getB1PlusWatchHandler,
  getStudentExplorerExport,
  listTrackingCohorts: listTrackingCohortsHandler,
  createTrackingCohort: createTrackingCohortHandler,
  getTrackingCohort: getTrackingCohortHandler,
  deleteTrackingCohort: deleteTrackingCohortHandler,
  getCohorts,
  getOfferings,
  getOfferingDetail,
  getOfferingExport,
  getResources,
  getSkills,
  getInsights,
  getStudentRecommendations: getStudentRecommendationsHandler,
  getStudentJourney,
  getRawData,
  getExport,
  postPruneSnapshots,
  listModelRuns,
  getModelRun,
  postModelRun,
  getKpiPolicies,
  getKpiPolicy,
  postKpiPolicy,
  postCloneKpiPolicy,
  putKpiPolicy,
  postArchiveKpiPolicy,
  postKpiReport,
  getKpiReportExport,
  postKpiGaps,
  getKpiGapsExport,
};
