'use strict';

const express = require('express');
const {
  createSimpleRateLimit,
  elpStudentKey,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields,
  publicLookupAudit,
} = require('../middlewares/publicAccessGuard');
const classCreditAllocationService = require('../services/classCreditAllocationService');
const { getCurrentSemester } = require('../utils/semesterConstants');

const router = express.Router();

const rateLimit = createSimpleRateLimit({
  windowMs: Number(process.env.CLASS_CREDIT_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
  max: Number(process.env.CLASS_CREDIT_RATE_LIMIT_MAX) || 60,
  message: '查詢過於頻繁，請稍後再試',
  keyFn: elpStudentKey,
});

const publicGuards = [
  rateLimit,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields({ requireStudentId: true, requireName: true, requireEmail: true }),
];

router.get('/class-credit-allocation/nav-enabled', async (req, res, next) => {
  try {
    const enabled = await classCreditAllocationService.isNavEnabled();
    return res.json({ enabled });
  } catch (err) {
    return next(err);
  }
});

router.get('/class-credit-allocation', ...publicGuards, async (req, res, next) => {
  try {
    await classCreditAllocationService.assertNavEnabled(
      await classCreditAllocationService.isNavEnabled(),
    );
    const { studentId, studentName, studentEmail } = req.query;
    const semester = String(req.query.semester || getCurrentSemester() || '').trim();
    if (!semester) {
      return res.status(400).json({
        success: false,
        code: 'SEMESTER_REQUIRED',
        message: '請指定學期',
      });
    }

    const data = await classCreditAllocationService.getStudentAllocationDashboard(
      studentId,
      semester,
    );

    publicLookupAudit(req, {
      action: 'class_credit_allocation_read',
      entityType: 'ClassCreditAllocation',
      entityId: 'public_lookup',
      found: true,
      payload: { studentId, studentName, studentEmail, semester },
    });

    return res.json({
      success: true,
      found: true,
      data: {
        ...data,
        studentName: String(studentName || '').trim(),
        studentEmail: String(studentEmail || '').trim().toLowerCase(),
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'CLASS_CREDIT_ERROR',
        message: err.message,
      });
    }
    return next(err);
  }
});

router.put('/class-credit-allocation', ...publicGuards, async (req, res, next) => {
  try {
    await classCreditAllocationService.assertNavEnabled(
      await classCreditAllocationService.isNavEnabled(),
    );
    const { studentId, studentName, studentEmail } = req.body || {};
    const semester = String((req.body && req.body.semester) || getCurrentSemester() || '').trim();
    const allocations = (req.body && req.body.allocations) || [];

    if (!semester) {
      return res.status(400).json({
        success: false,
        code: 'SEMESTER_REQUIRED',
        message: '請指定學期',
      });
    }

    const data = await classCreditAllocationService.saveStudentAllocations(
      studentId,
      semester,
      allocations,
    );

    publicLookupAudit(req, {
      action: 'class_credit_allocation_save',
      entityType: 'ClassCreditAllocation',
      entityId: 'public_lookup',
      found: true,
      payload: { studentId, studentName, studentEmail, semester },
    });

    return res.json({
      success: true,
      found: true,
      data: {
        ...data,
        studentName: String(studentName || '').trim(),
        studentEmail: String(studentEmail || '').trim().toLowerCase(),
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'CLASS_CREDIT_ERROR',
        message: err.message,
      });
    }
    return next(err);
  }
});

module.exports = router;
