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
const { assertCanAccessStudent, sendStudentScopeDenied } = require('../services/accessControl/studentScopeGuard');

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
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getOverview(req, res) {
  try {
    const data = await getLearningAnalyticsOverview(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getCohorts(req, res) {
  try {
    const data = await getLearningAnalyticsCohorts(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getOfferings(req, res) {
  try {
    const data = await getLearningAnalyticsOfferings(req.query || {}, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getOfferingDetail(req, res) {
  try {
    const data = await getLearningAnalyticsOfferingDetail(req.query || {}, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getOfferingExport(req, res) {
  try {
    const exportResult = await buildOfferingsExportWorkbook(req.query || {}, { user: req.user });
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
    return res.status(status).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getResources(req, res) {
  try {
    const lva = await getLvaAnalytics(req.query || {});
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
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getSkills(req, res) {
  try {
    const data = await getLearningAnalyticsSkills(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
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
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getSettings(req, res) {
  try {
    const data = await getLearningAnalyticsSettings();
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
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
    return res.status(status).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postResetResourceSkillProfile(req, res) {
  try {
    const data = await resetLearningAnalyticsResourceSkillProfile(req.params.resourceKey, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = /不支援/.test(e.message || '') ? 400 : 500;
    return res.status(status).json({ success: false, error: e.message, requestId: req.requestId });
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
    return res.status(status).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function putLvaConfig(req, res) {
  try {
    const updates = Array.isArray(req.body?.params) ? req.body.params : [];
    const data = await updateLearningAnalyticsLvaConfig(updates, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    const status = /不支援|須為|不可|必填|migration/.test(e.message || '') ? 400 : 500;
    return res.status(status).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postResetLvaConfig(req, res) {
  try {
    const data = await resetLearningAnalyticsLvaConfig({ user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getRawData(req, res) {
  try {
    const dataset = String(req.query.dataset || 'students').toLowerCase();
    let data;
    if (dataset === 'exams') {
      data = await queryAnalyticExams(req.query || {});
    } else if (['courses', 'activities', 'events'].includes(dataset)) {
      data = await queryAnalyticEvents(req.query || {});
    } else {
      data = await queryAnalyticStudents(req.query || {});
    }
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getExport(req, res) {
  try {
    const format = String(req.query.format || 'xlsx').toLowerCase();
    if (!['xlsx', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        code: 'UNSUPPORTED_FORMAT',
        error: '目前僅支援 format=xlsx 或 format=csv',
        requestId: req.requestId,
      });
    }

    const exportResult = format === 'csv'
      ? await buildRawDataExportCsv(req.query || {})
      : await buildRawDataExportWorkbook(req.query || {});

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
        filters: { ...filters, total, truncated },
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
      filters: { ...filters, total, truncated },
      fileName,
    });

    return res.end();
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postPruneSnapshots(req, res) {
  try {
    const dryRun = req.body?.dryRun !== false;
    const keepGlobalCount = Math.max(1, Number(req.body?.keepGlobalCount) || 1);
    const data = await pruneAnalyticsSnapshots({ dryRun, keepGlobalCount });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getInsights(req, res) {
  try {
    const data = await getAdvancedVisualizations(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
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
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function listModelRuns(req, res) {
  try {
    const data = await listLvaModelRuns(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
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
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postModelRun(req, res) {
  try {
    const data = await createLvaModelRun(req.body?.filters || req.query || {}, { user: req.user });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
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
};
