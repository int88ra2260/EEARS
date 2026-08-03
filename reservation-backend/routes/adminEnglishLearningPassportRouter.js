'use strict';

const express = require('express');
const { authMiddleware, requirePermission, requireAnyPermission, P } = require('../middlewares/auth');
const passportService = require('../services/englishLearningPassport/passportService');
const exportService = require('../services/englishLearningPassport/exportService');

const router = express.Router();

router.use(authMiddleware);

function handleServiceError(err, res, next) {
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      code: err.code || 'ERROR',
      message: err.message,
      suggestedPoints: err.suggestedPoints,
    });
  }
  return next(err);
}

const viewAuth = requirePermission(P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS);
const manageAuth = requirePermission(P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS);
const reviewAuth = requirePermission(P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS);
const exportAuth = requirePermission(P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS);
const rulesViewAuth = requireAnyPermission([
  P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS,
  P.CAN_MANAGE_ENGLISH_LEARNING_RULES,
]);

router.get('/english-learning-passports', viewAuth, async (req, res, next) => {
  try {
    const data = await passportService.listPassportsAdmin(req.query);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get('/english-learning-passports/export/xlsx', exportAuth, async (req, res, next) => {
  try {
    const { buffer, fileName, contentDisposition } = await exportService.exportPassportsXlsx(req.query, req);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', contentDisposition || `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (e) {
    next(e);
  }
});

router.get('/english-learning-passports/audit-logs', viewAuth, async (req, res, next) => {
  try {
    const data = await passportService.listAuditLogsAdmin(req.query);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get('/english-learning-passports/submissions', reviewAuth, async (req, res, next) => {
  try {
    const data = await passportService.listSubmissionsAdmin(req.query);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get('/english-learning-passports/submissions/:id', reviewAuth, async (req, res, next) => {
  try {
    const data = await passportService.getSubmissionAdmin(req.params.id);
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.post('/english-learning-passports/submissions/:id/approve', reviewAuth, async (req, res, next) => {
  try {
    const data = await passportService.approveSubmissionAdmin(
      req.params.id,
      req.user.id,
      req.body.pointsApproved,
      req,
    );
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.post('/english-learning-passports/submissions/:id/reject', reviewAuth, async (req, res, next) => {
  try {
    const data = await passportService.rejectSubmissionAdmin(
      req.params.id,
      req.user.id,
      req.body.reason,
      req,
    );
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.put('/english-learning-passports/submissions/:id/points', reviewAuth, async (req, res, next) => {
  try {
    const data = await passportService.updateSubmissionPointsAdmin(
      req.params.id,
      req.user.id,
      req.body.pointsApproved,
      req,
    );
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.get('/english-learning-passports/certification-requests', reviewAuth, async (req, res, next) => {
  try {
    const data = await passportService.listCertificationRequestsAdmin();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.get('/english-learning-passports/rules', rulesViewAuth, async (_req, res, next) => {
  try {
    const data = await passportService.listRulesAdmin();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.post('/english-learning-passports/rules', rulesViewAuth, async (req, res, next) => {
  try {
    const data = await passportService.createRuleAdmin(req.body, req);
    res.status(201).json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.put('/english-learning-passports/rules/:id', rulesViewAuth, async (req, res, next) => {
  try {
    const data = await passportService.updateRuleAdmin(req.params.id, req.body, req);
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.delete('/english-learning-passports/rules/:id', rulesViewAuth, async (req, res, next) => {
  try {
    const data = await passportService.deleteRuleAdmin(req.params.id, req);
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.get('/english-learning-passports/:id', viewAuth, async (req, res, next) => {
  try {
    const data = await passportService.getPassportDetailAdmin(req.params.id);
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.post('/english-learning-passports/:id/approve', manageAuth, async (req, res, next) => {
  try {
    const data = await passportService.approvePassportAdmin(req.params.id, req.user.id, req);
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.post('/english-learning-passports/:id/reject', manageAuth, async (req, res, next) => {
  try {
    const data = await passportService.rejectPassportAdmin(
      req.params.id,
      req.user.id,
      req.body.reason,
      req,
    );
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.post('/english-learning-passports/:id/certification/approve', reviewAuth, async (req, res, next) => {
  try {
    const data = await passportService.approveCertificationAdmin(req.params.id, req.user.id, req);
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

router.post('/english-learning-passports/:id/certification/reject', reviewAuth, async (req, res, next) => {
  try {
    const data = await passportService.rejectCertificationAdmin(
      req.params.id,
      req.user.id,
      req.body.reason,
      req,
    );
    res.json({ success: true, data });
  } catch (e) {
    handleServiceError(e, res, next);
  }
});

module.exports = router;
