'use strict';

const express = require('express');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const {
  createSimpleRateLimit,
  elpStudentKey,
} = require('../middlewares/publicAccessGuard');
const {
  recordLearningTrace,
  getMicroLearningEngagementSummary,
  getRecommendationFunnelSummary,
} = require('../services/learningTraceService');
const { getTraceLjCorrelationSummary } = require('../services/learningTrace/learningTraceCorrelationService');
const { generateRegulatoryFocusFeedback } = require('../services/learningTrace/learningFeedbackService');
const {
  getStudentLearningJourneyDashboard,
  normalizeStudentContext,
} = require('../services/learningTrace/studentLearningJourneyService');

const router = express.Router();

const studentJourneyRateLimit = createSimpleRateLimit({
  windowMs: Number(process.env.STUDENT_JOURNEY_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
  max: Number(process.env.STUDENT_JOURNEY_RATE_LIMIT_MAX) || 120,
  message: '查詢過於頻繁，請稍後再試',
  keyFn: elpStudentKey,
});

function requireStudentContext(req, res, next) {
  const ctx = normalizeStudentContext({
    studentId: req.body?.studentId || req.query?.studentId,
    studentName: req.body?.studentName || req.query?.studentName,
    studentEmail: req.body?.studentEmail || req.query?.studentEmail,
  });
  if (!ctx.studentId || !ctx.studentName || !ctx.studentEmail) {
    return res.status(400).json({
      success: false,
      code: 'REQUIRED_FIELD_MISSING',
      message: '請提供學號、姓名與 Email',
      requestId: req.requestId,
    });
  }
  req.studentContext = ctx;
  return next();
}

router.post('/learning-traces', async (req, res, next) => {
  try {
    const result = await recordLearningTrace(req.body || {});
    return res.status(result.created ? 201 : 200).json({
      success: true,
      data: result,
      requestId: req.requestId,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'LEARNING_TRACE_ERROR',
        message: err.message,
        requestId: req.requestId,
      });
    }
    return next(err);
  }
});

router.get(
  '/student-learning-journey/dashboard',
  studentJourneyRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await getStudentLearningJourneyDashboard(req.studentContext, req.query || {});
      return res.json({ success: true, data, requestId: req.requestId });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          code: err.code || 'STUDENT_JOURNEY_ERROR',
          message: err.message,
          requestId: req.requestId,
        });
      }
      return next(err);
    }
  },
);

router.post(
  '/student-learning-journey/feedback',
  studentJourneyRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await generateRegulatoryFocusFeedback(req.body?.context || {}, req.query || req.body || {});
      return res.json({ success: true, data, requestId: req.requestId });
    } catch (err) {
      return next(err);
    }
  },
);

router.get(
  '/admin/learning-traces/engagement',
  authMiddleware,
  requirePermission(P.CAN_VIEW_LEARNING_ANALYTICS),
  async (req, res, next) => {
    try {
      const data = await getMicroLearningEngagementSummary(req.query || {});
      return res.json({ success: true, data, requestId: req.requestId });
    } catch (err) {
      return next(err);
    }
  },
);

router.get(
  '/admin/learning-traces/funnel',
  authMiddleware,
  requirePermission(P.CAN_VIEW_LEARNING_ANALYTICS),
  async (req, res, next) => {
    try {
      const data = await getRecommendationFunnelSummary(req.query || {});
      return res.json({ success: true, data, requestId: req.requestId });
    } catch (err) {
      return next(err);
    }
  },
);

router.get(
  '/admin/learning-traces/correlation',
  authMiddleware,
  requirePermission(P.CAN_VIEW_LEARNING_ANALYTICS),
  async (req, res, next) => {
    try {
      const data = await getTraceLjCorrelationSummary(req.query || {});
      return res.json({ success: true, data, requestId: req.requestId });
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
