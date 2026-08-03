const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const surveyGateGapReportService = require('../services/surveyGateGapReportService');
const { buildEventScopeWhere } = require('../services/accessControl/eventScopeGuard');

function sendEventScopeDenied(res, err = {}) {
  return res.status(err.status || 403).json({
    error: err.message || '您沒有存取此活動資料的權限。',
    code: err.code || 'EVENT_SCOPE_DENIED',
  });
}

async function attachEventScope(req, res, next) {
  try {
    const scopeWhere = buildEventScopeWhere(req.user);
    if (scopeWhere === null) {
      return sendEventScopeDenied(res, {
        status: 403,
        code: 'MISSING_EVENT_CONTEXT',
        message: '此操作需要指定活動或資料範圍。',
      });
    }
    req.eventScopeWhere = scopeWhere;
    return next();
  } catch (err) {
    return next(err);
  }
}

router.get(
  '/gaps',
  authMiddleware,
  requirePermission(P.CAN_VIEW_SURVEY_RESPONSES),
  attachEventScope,
  async (req, res, next) => {
    try {
      const data = await surveyGateGapReportService.listSurveyGateGaps({
        ...req.query,
        __eventScopeWhere: req.eventScopeWhere,
      });
      res.json(data);
    } catch (e) {
      if (e.status === 400 || e.status === 404) {
        return res.status(e.status).json({ error: e.message });
      }
      next(e);
    }
  }
);

router.get(
  '/gaps/export/xlsx',
  authMiddleware,
  requirePermission(P.CAN_EXPORT_SURVEY_RESPONSES),
  attachEventScope,
  async (req, res, next) => {
    try {
      await surveyGateGapReportService.exportSurveyGateGapsXlsx(
        { ...req.query, __eventScopeWhere: req.eventScopeWhere },
        res,
        req.user?.id
      );
    } catch (e) {
      if (e.status === 400 || e.status === 404) {
        return res.status(e.status).json({ error: e.message });
      }
      next(e);
    }
  }
);

module.exports = router;
