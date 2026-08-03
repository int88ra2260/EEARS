const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const surveyCenterService = require('../services/surveyCenterService');
const surveyHealthService = require('../services/surveyHealthService');
const {
  buildSurveyResponseScopeWhere,
  mergeWhereWithScope,
  sendSurveyScopeDenied,
} = require('../services/accessControl/surveyScopeGuard');

function buildWhere(query = {}) {
  const where = {};
  if (query.semesterId) where.semesterId = query.semesterId;
  if (query.surveyId) where.surveyId = query.surveyId;
  if (query.versionId) where.surveyVersionId = query.versionId;
  if (query.activityType) where.activityType = query.activityType;
  if (query.eventId) where.eventId = query.eventId;
  return mergeWhereWithScope(where, query.__scopeWhere);
}

async function attachSurveyAnalyticsScope(req, res, next) {
  try {
    const scopeWhere = await buildSurveyResponseScopeWhere(req.user, req.query);
    if (scopeWhere === null) {
      return sendSurveyScopeDenied(res, {
        status: 403,
        code: 'MISSING_SURVEY_CONTEXT',
        message: '此操作需要指定問卷或資料範圍。',
      });
    }
    req.scopedSurveyQuery = { ...req.query, __scopeWhere: scopeWhere };
    return next();
  } catch (err) {
    if (err.status === 403) return sendSurveyScopeDenied(res, err);
    return next(err);
  }
}

router.get('/overview', authMiddleware, requirePermission(P.CAN_VIEW_SURVEY_ANALYTICS), attachSurveyAnalyticsScope, async (req, res, next) => {
  try {
    const [data, dataQuality] = await Promise.all([
      surveyCenterService.analyticsOverview(req.scopedSurveyQuery),
      surveyHealthService.dataQualityForWhere(buildWhere(req.scopedSurveyQuery)),
    ]);
    res.json({ ...data, dataQuality });
  } catch (e) {
    next(e);
  }
});

router.get('/distribution', authMiddleware, requirePermission(P.CAN_VIEW_SURVEY_ANALYTICS), attachSurveyAnalyticsScope, async (req, res, next) => {
  try {
    const [data, dataQuality] = await Promise.all([
      surveyCenterService.analyticsDistribution(req.scopedSurveyQuery),
      surveyHealthService.dataQualityForWhere(buildWhere(req.scopedSurveyQuery)),
    ]);
    res.json({ ...data, dataQuality });
  } catch (e) {
    next(e);
  }
});

router.get('/trends', authMiddleware, requirePermission(P.CAN_VIEW_SURVEY_ANALYTICS), attachSurveyAnalyticsScope, async (req, res, next) => {
  try {
    const [data, dataQuality] = await Promise.all([
      surveyCenterService.analyticsTrends(req.scopedSurveyQuery),
      surveyHealthService.dataQualityForWhere(buildWhere(req.scopedSurveyQuery)),
    ]);
    res.json({ ...data, dataQuality });
  } catch (e) {
    next(e);
  }
});

router.get('/comparison', authMiddleware, requirePermission(P.CAN_VIEW_SURVEY_ANALYTICS), attachSurveyAnalyticsScope, async (req, res, next) => {
  try {
    const [data, dataQuality] = await Promise.all([
      surveyCenterService.analyticsComparison(req.scopedSurveyQuery),
      surveyHealthService.dataQualityForWhere(buildWhere(req.scopedSurveyQuery)),
    ]);
    res.json({ ...data, dataQuality });
  } catch (e) {
    next(e);
  }
});

router.get('/open-text-summary', authMiddleware, requirePermission(P.CAN_VIEW_SURVEY_ANALYTICS), attachSurveyAnalyticsScope, async (req, res, next) => {
  try {
    const [data, dataQuality] = await Promise.all([
      surveyCenterService.analyticsOpenTextSummary(req.scopedSurveyQuery),
      surveyHealthService.dataQualityForWhere(buildWhere(req.scopedSurveyQuery)),
    ]);
    res.json({ ...data, dataQuality });
  } catch (e) {
    next(e);
  }
});

router.get('/export/xlsx', authMiddleware, requirePermission(P.CAN_EXPORT_SURVEY_RESPONSES), attachSurveyAnalyticsScope, async (req, res, next) => {
  try {
    await surveyCenterService.exportSurveyAnalyticsXlsx(req.scopedSurveyQuery, res, req.user?.id);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
