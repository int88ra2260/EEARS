const express = require('express');
const router = express.Router();
const { SurveyRule } = require('../models');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const surveyCenterService = require('../services/surveyCenterService');
const { simulateSurveyRuleResolution, detectRuleConflicts } = require('../services/surveyRuleEvaluationService');
const {
  assertCanAccessSurveyRulePayload,
  buildSurveyRuleScopeWhere,
  sendSurveyScopeDenied,
} = require('../services/accessControl/surveyScopeGuard');

async function attachSurveyRuleScope(req, res, next) {
  try {
    const scopeWhere = await buildSurveyRuleScopeWhere(req.user, req.query);
    if (scopeWhere === null) {
      return sendSurveyScopeDenied(res, {
        status: 403,
        code: 'MISSING_SURVEY_CONTEXT',
        message: '此操作需要指定問卷或資料範圍。',
      });
    }
    req.surveyRuleScopeWhere = scopeWhere;
    return next();
  } catch (err) {
    if (err.status === 403) return sendSurveyScopeDenied(res, err);
    return next(err);
  }
}

async function requireSurveyRulePayloadScope(req, res, next) {
  try {
    await assertCanAccessSurveyRulePayload(req.user, {
      ...(req.surveyRuleRecord ? req.surveyRuleRecord.toJSON() : {}),
      ...(req.body || {}),
    });
    return next();
  } catch (err) {
    if (err.status === 403) return sendSurveyScopeDenied(res, err);
    return next(err);
  }
}

async function requireSurveyRuleRecordScope(req, res, next) {
  try {
    const row = await SurveyRule.findByPk(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'not found' });
    await assertCanAccessSurveyRulePayload(req.user, row.toJSON());
    req.surveyRuleRecord = row;
    return next();
  } catch (err) {
    if (err.status === 403) return sendSurveyScopeDenied(res, err);
    return next(err);
  }
}

router.get('/', authMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_RULES), attachSurveyRuleScope, async (req, res, next) => {
  try {
    res.json(await surveyCenterService.listSurveyRules({ ...req.query, __scopeWhere: req.surveyRuleScopeWhere }));
  } catch (e) {
    next(e);
  }
});

router.post('/', authMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_RULES), requireSurveyRulePayloadScope, async (req, res, next) => {
  try {
    const row = await surveyCenterService.createSurveyRule(req.body);
    res.status(201).json(row);
  } catch (e) {
    if (e.code === 'RULE_CONFLICT') {
      return res.status(e.statusCode || 409).json({
        code: e.code,
        message: e.message,
        details: e.details || [],
        relatedRules: e.relatedRules || [],
        canResolveByPriority: e.canResolveByPriority,
        suggestion: e.suggestion || null,
        conflictType: e.conflictType || null,
      });
    }
    next(e);
  }
});

router.get('/:id(\\d+)', authMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_RULES), requireSurveyRuleRecordScope, async (req, res, next) => {
  try {
    const row = req.surveyRuleRecord;
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.put('/:id(\\d+)', authMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_RULES), requireSurveyRuleRecordScope, requireSurveyRulePayloadScope, async (req, res, next) => {
  try {
    const row = await surveyCenterService.updateSurveyRule(Number(req.params.id), req.body);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (e) {
    if (e.code === 'RULE_CONFLICT') {
      return res.status(e.statusCode || 409).json({
        code: e.code,
        message: e.message,
        details: e.details || [],
        relatedRules: e.relatedRules || [],
        canResolveByPriority: e.canResolveByPriority,
        suggestion: e.suggestion || null,
        conflictType: e.conflictType || null,
      });
    }
    next(e);
  }
});

router.delete('/:id(\\d+)', authMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_RULES), requireSurveyRuleRecordScope, async (req, res, next) => {
  try {
    const row = req.surveyRuleRecord;
    if (!row) return res.status(404).json({ error: 'not found' });
    await row.destroy();
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.get('/effective/query', authMiddleware, requirePermission(P.CAN_VIEW_SURVEYS), attachSurveyRuleScope, async (req, res, next) => {
  try {
    const row = await surveyCenterService.getEffectiveRule(req.query);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.get('/simulate/query', authMiddleware, requirePermission(P.CAN_VIEW_SURVEYS), attachSurveyRuleScope, async (req, res, next) => {
  try {
    const data = await simulateSurveyRuleResolution({
      semesterId: req.query.semesterId || null,
      activityType: req.query.activityType || null,
      eventId: req.query.eventId || null,
      currentTime: req.query.currentTime || new Date(),
      triggerMode: req.query.triggerMode || null,
      studentId: req.query.studentId || null,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/health/conflicts', authMiddleware, requirePermission(P.CAN_VIEW_SURVEYS), attachSurveyRuleScope, async (req, res, next) => {
  try {
    const rules = await SurveyRule.findAll({ where: req.surveyRuleScopeWhere });
    res.json(detectRuleConflicts(rules));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
