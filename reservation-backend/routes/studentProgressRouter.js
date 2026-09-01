'use strict';

const express = require('express');
const {
  createSimpleRateLimit,
  elpStudentKey,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields,
  genericLookupResponse,
  publicLookupAudit,
} = require('../middlewares/publicAccessGuard');
const { getStudentProgressRead } = require('../services/studentProgress/studentProgressReadService');

const router = express.Router();

const studentProgressRateLimit = createSimpleRateLimit({
  windowMs: Number(process.env.STUDENT_PROGRESS_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
  max: Number(process.env.STUDENT_PROGRESS_RATE_LIMIT_MAX) || 60,
  message: '查詢過於頻繁，請稍後再試',
  keyFn: elpStudentKey,
});

router.get(
  '/student-progress',
  studentProgressRateLimit,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields({ requireStudentId: true, requireName: true, requireEmail: true }),
  async (req, res, next) => {
    try {
      const { studentId, studentName, studentEmail } = req.query;
      const result = await getStudentProgressRead({ studentId, studentName, studentEmail });

      publicLookupAudit(req, {
        action: 'student_progress_read',
        entityType: 'StudentProgress',
        entityId: 'public_lookup',
        found: result.found,
        payload: { studentId, studentName, studentEmail },
      });

      return genericLookupResponse(res, result);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          code: err.code || 'STUDENT_PROGRESS_ERROR',
          message: err.message,
          requestId: req.requestId,
        });
      }
      return next(err);
    }
  },
);

module.exports = router;
