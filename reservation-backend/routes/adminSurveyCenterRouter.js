const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const surveyModuleService = require('../services/surveyModuleService');
const surveyCenterService = require('../services/surveyCenterService');
const { buildEventScopeWhere } = require('../services/accessControl/eventScopeGuard');
const {
  assertCanAccessSurveyById,
  assertCanAccessSurveyRulePayload,
  buildSurveyScopeWhere,
  sendSurveyScopeDenied,
} = require('../services/accessControl/surveyScopeGuard');

function requireSurveyListScope(req, res, next) {
  const scopeWhere = buildSurveyScopeWhere(req.user);
  if (scopeWhere === null) {
    return sendSurveyScopeDenied(res, {
      status: 403,
      code: 'MISSING_SURVEY_CONTEXT',
      message: '此操作需要指定問卷或資料範圍。',
    });
  }
  req.surveyScopeWhere = scopeWhere;
  return next();
}

async function requireSurveyRecordScope(req, res, next) {
  try {
    await assertCanAccessSurveyById(req.user, Number(req.params.id));
    return next();
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message || '找不到問卷' });
    if (err.status === 403) return sendSurveyScopeDenied(res, err);
    return next(err);
  }
}

async function requireSurveyPayloadScope(req, res, next) {
  try {
    await assertCanAccessSurveyRulePayload(req.user, req.body || {});
    return next();
  } catch (err) {
    if (err.status === 403) return sendSurveyScopeDenied(res, err);
    return next(err);
  }
}

router.get('/', authMiddleware, requirePermission(P.CAN_VIEW_SURVEYS), requireSurveyListScope, async (req, res, next) => {
  try {
    const data = await surveyCenterService.listSurveyCenter({ ...req.query, __scopeWhere: req.surveyScopeWhere });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/meta/options', authMiddleware, requirePermission(P.CAN_VIEW_SURVEYS), requireSurveyListScope, async (req, res, next) => {
  try {
    const { Survey, Event, SurveyVersion } = require('../models');
    const eventScopeWhere = buildEventScopeWhere(req.user);
    if (eventScopeWhere === null) {
      return sendSurveyScopeDenied(res, {
        status: 403,
        code: 'MISSING_SURVEY_CONTEXT',
        message: '此操作需要指定問卷或資料範圍。',
      });
    }
    const [surveys, semesters, events] = await Promise.all([
      Survey.findAll({ where: req.surveyScopeWhere, attributes: ['id', 'title', 'name', 'surveyKey'], order: [['updatedAt', 'DESC']] }),
      surveyCenterService.listSemesters(),
      Event.findAll({ where: eventScopeWhere, attributes: ['id', 'name', 'eventType', 'semesterId'], order: [['id', 'DESC']], limit: 500 }),
    ]);
    const surveyIds = surveys.map((s) => s.id);
    const versions = surveyIds.length
      ? await SurveyVersion.findAll({
          where: { surveyId: surveyIds },
          attributes: ['id', 'surveyId', 'versionNumber', 'status'],
          order: [['id', 'DESC']],
          limit: 2000,
        })
      : [];
    res.json({ surveys, semesters, events, versions });
  } catch (e) {
    next(e);
  }
});

router.post('/', authMiddleware, requirePermission(P.CAN_MANAGE_SURVEYS), requireSurveyPayloadScope, async (req, res, next) => {
  try {
    const row = await surveyModuleService.createSurvey(req.body, req.user?.id);
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

router.get('/:id(\\d+)', authMiddleware, requirePermission(P.CAN_VIEW_SURVEYS), requireSurveyRecordScope, async (req, res, next) => {
  try {
    const list = await surveyCenterService.listSurveyCenter({ page: 1, pageSize: 1, id: Number(req.params.id) });
    res.json(list.rows?.[0] || null);
  } catch (e) {
    next(e);
  }
});

router.put('/:id(\\d+)', authMiddleware, requirePermission(P.CAN_MANAGE_SURVEYS), requireSurveyRecordScope, async (req, res, next) => {
  try {
    const row = await surveyModuleService.updateSurvey(Number(req.params.id), req.body, req.user?.id);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.post('/:id(\\d+)/versions', authMiddleware, requirePermission(P.CAN_MANAGE_SURVEYS), requireSurveyRecordScope, async (req, res, next) => {
  try {
    const row = await surveyModuleService.createVersion(Number(req.params.id), req.body, req.user?.id);
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

router.post(
  '/:id(\\d+)/versions/:versionId(\\d+)/publish',
  authMiddleware,
  requirePermission(P.CAN_PUBLISH_SURVEYS),
  requireSurveyRecordScope,
  async (req, res, next) => {
    try {
      const row = await surveyModuleService.publishVersion(Number(req.params.id), Number(req.params.versionId), req.user?.id);
      res.json(row);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/:id(\\d+)/versions/:versionId(\\d+)/archive',
  authMiddleware,
  requirePermission(P.CAN_PUBLISH_SURVEYS),
  requireSurveyRecordScope,
  async (req, res, next) => {
    try {
      const { SurveyVersion } = require('../models');
      const ver = await SurveyVersion.findOne({ where: { id: Number(req.params.versionId), surveyId: Number(req.params.id) } });
      if (!ver) return res.status(404).json({ error: 'version not found' });
      await ver.update({ status: 'archived', isPublished: false });
      res.json(ver);
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
