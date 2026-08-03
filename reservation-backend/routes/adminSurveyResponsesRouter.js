const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const surveyCenterService = require('../services/surveyCenterService');
const {
  assertCanAccessSurveyResponse,
  buildSurveyResponseScopeWhere,
  sendSurveyScopeDenied,
} = require('../services/accessControl/surveyScopeGuard');
const { syncLegacyResponsesToModule } = require('../services/surveyLegacyResponseSyncService');
const { getResponseBasicStats } = require('../services/surveyResponseStatsService');
const { getCurrentSemester } = require('../utils/semester');

async function attachSurveyResponseScope(req, res, next) {
  try {
    const scopeWhere = await buildSurveyResponseScopeWhere(req.user, req.query);
    if (scopeWhere === null) {
      return sendSurveyScopeDenied(res, {
        status: 403,
        code: 'MISSING_SURVEY_CONTEXT',
        message: '此操作需要指定問卷或資料範圍。',
      });
    }
    req.surveyScopeWhere = scopeWhere;
    return next();
  } catch (err) {
    if (err.status === 403) return sendSurveyScopeDenied(res, err);
    return next(err);
  }
}

router.get('/stats/basic', authMiddleware, requirePermission(P.CAN_VIEW_SURVEY_RESPONSES), attachSurveyResponseScope, async (req, res, next) => {
  try {
    const data = await getResponseBasicStats({ ...req.query, __scopeWhere: req.surveyScopeWhere });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/', authMiddleware, requirePermission(P.CAN_VIEW_SURVEY_RESPONSES), attachSurveyResponseScope, async (req, res, next) => {
  try {
    const data = await surveyCenterService.listSurveyResponses({ ...req.query, __scopeWhere: req.surveyScopeWhere });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/export/xlsx', authMiddleware, requirePermission(P.CAN_EXPORT_SURVEY_RESPONSES), attachSurveyResponseScope, async (req, res, next) => {
  try {
    await surveyCenterService.exportSurveyResponsesXlsx({ ...req.query, __scopeWhere: req.surveyScopeWhere }, res, req.user?.id);
  } catch (e) {
    next(e);
  }
});

router.get('/:id(\\d+)', authMiddleware, requirePermission(P.CAN_VIEW_SURVEY_RESPONSES), async (req, res, next) => {
  try {
    const data = await surveyCenterService.getResponseDetail(Number(req.params.id));
    if (!data) return res.status(404).json({ error: 'not found' });
    await assertCanAccessSurveyResponse(req.user, data.response);
    res.json(data);
  } catch (e) {
    if (e.status === 403) return sendSurveyScopeDenied(res, e);
    next(e);
  }
});

router.post('/sync-legacy', authMiddleware, requirePermission(P.CAN_EXECUTE_SURVEY_REPAIRS), async (req, res, next) => {
  try {
    const semester = req.body?.semester || getCurrentSemester();
    const report = await syncLegacyResponsesToModule({ semester, dryRun: false });
    res.json({ ok: true, report });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
