'use strict';

const express = require('express');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const auditLogService = require('../services/auditLogService');
const classCreditAllocationService = require('../services/classCreditAllocationService');

const router = express.Router();

const manageAuth = [authMiddleware, requirePermission(P.CAN_MANAGE_CLASSES)];

router.get('/nav-enabled', ...manageAuth, async (req, res, next) => {
  try {
    const enabled = await classCreditAllocationService.isNavEnabled();
    return res.json({ success: true, enabled });
  } catch (err) {
    return next(err);
  }
});

router.put('/nav-enabled', ...manageAuth, async (req, res, next) => {
  try {
    if (typeof req.body?.enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ENABLED',
        message: 'enabled 必須為布林值',
      });
    }
    const before = await classCreditAllocationService.isNavEnabled();
    const enabled = await classCreditAllocationService.setNavEnabled(req.body.enabled);

    auditLogService.logAuditAsync({
      module: 'classes',
      action: 'class_credit_allocation_nav_enabled_update',
      entityType: 'Settings',
      entityId: classCreditAllocationService.NAV_ENABLED_KEY,
      targetSummary: `課堂加分配置入口: ${before} → ${enabled}`,
      beforeData: { enabled: before },
      afterData: { enabled },
      changedFields: ['enabled'],
      req,
    });

    return res.json({ success: true, enabled });
  } catch (err) {
    return next(err);
  }
});

router.get('/students', ...manageAuth, async (req, res, next) => {
  try {
    const semester = String(req.query.semester || '').trim();
    const studentId = String(req.query.studentId || '').trim();
    if (!studentId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STUDENT_ID',
        message: '請填寫學號',
      });
    }
    const data = await classCreditAllocationService.getAdminStudentCredit(studentId, semester);
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'BAD_REQUEST',
        message: err.message,
      });
    }
    return next(err);
  }
});

router.post('/adjustments', ...manageAuth, async (req, res, next) => {
  try {
    const created = await classCreditAllocationService.createAdjustment({
      studentId: req.body?.studentId,
      semester: req.body?.semester,
      hours: req.body?.hours,
      direction: req.body?.direction,
      note: req.body?.note,
      createdBy: req.user?.id || null,
    });

    const verb = created.hours < 0 ? '扣除' : '增加';
    auditLogService.logAuditAsync({
      module: 'classes',
      action: 'class_credit_adjustment_create',
      entityType: 'ClassCreditAdjustment',
      entityId: String(created.id),
      targetSummary: `${created.semester} ${created.studentId} 總時數${verb} ${Math.abs(created.hours)} 時`,
      beforeData: null,
      afterData: created,
      changedFields: ['hours', 'note'],
      req,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'BAD_REQUEST',
        message: err.message,
      });
    }
    return next(err);
  }
});

router.delete('/adjustments/:id', ...manageAuth, async (req, res, next) => {
  try {
    const removed = await classCreditAllocationService.deleteAdjustment(req.params.id);
    auditLogService.logAuditAsync({
      module: 'classes',
      action: 'class_credit_adjustment_delete',
      entityType: 'ClassCreditAdjustment',
      entityId: String(removed.id),
      targetSummary: `刪除 ${removed.semester} ${removed.studentId} 班級 ${removed.classId} 調整 ${removed.hours} 時`,
      beforeData: removed,
      afterData: null,
      changedFields: ['hours'],
      req,
    });
    return res.json({ success: true, data: removed });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'BAD_REQUEST',
        message: err.message,
      });
    }
    return next(err);
  }
});

router.get('/reminders/preview', ...manageAuth, async (req, res, next) => {
  try {
    const semester = String(req.query.semester || '').trim();
    const data = await classCreditAllocationService.buildAllocationReminderPreview(semester);
    const previewLimit = 30;
    return res.json({
      success: true,
      data: {
        ...data,
        recipients: data.recipients.slice(0, previewLimit).map((row) => ({
          studentId: row.studentId,
          studentName: row.studentName,
          email: row.email,
          classNames: row.classNames,
          remainingHours: row.remainingHours,
          remainingPoints: row.remainingPoints,
        })),
        recipientsTruncated: data.recipients.length > previewLimit,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'BAD_REQUEST',
        message: err.message,
      });
    }
    return next(err);
  }
});

router.post('/reminders', ...manageAuth, async (req, res, next) => {
  try {
    const semester = String(req.body?.semester || '').trim();
    const data = await classCreditAllocationService.enqueueAllocationReminders(semester, {
      requestId: req.requestId,
    });
    auditLogService.logAuditAsync({
      module: 'classes',
      action: 'class_credit_allocation_reminder_send',
      entityType: 'Settings',
      entityId: classCreditAllocationService.SETTINGS_KEY,
      targetSummary: `${semester} 課堂加分分配提醒已排入 ${data.queued} 封`,
      beforeData: null,
      afterData: data,
      changedFields: ['queued'],
      req,
    });
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'BAD_REQUEST',
        message: err.message,
      });
    }
    return next(err);
  }
});

router.get('/deadlines', ...manageAuth, async (req, res, next) => {
  try {
    const data = await classCreditAllocationService.listDeadlines();
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.put('/deadlines/:semester', ...manageAuth, async (req, res, next) => {
  try {
    const semester = String(req.params.semester || '').trim();
    const deadline = req.body?.deadline ?? null;
    const before = await classCreditAllocationService.getDeadlineIso(semester);
    const data = await classCreditAllocationService.setDeadline(semester, deadline);

    auditLogService.logAuditAsync({
      module: 'classes',
      action: 'class_credit_allocation_deadline_update',
      entityType: 'Settings',
      entityId: classCreditAllocationService.SETTINGS_KEY,
      targetSummary: `${semester} 課堂加分配置截止日: ${before} → ${data.deadline}`,
      beforeData: { semester, deadline: before },
      afterData: { semester, deadline: data.deadline },
      changedFields: ['deadline'],
      req,
    });

    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'BAD_REQUEST',
        message: err.message,
      });
    }
    return next(err);
  }
});

module.exports = router;
