'use strict';

const express = require('express');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const eventTypeService = require('../services/eventTypeService');
const auditLogService = require('../services/auditLogService');

const router = express.Router();

function handleServiceError(res, err, next) {
  if (err && err.status) {
    return res.status(err.status).json({
      success: false,
      code: err.code || 'EVENT_TYPE_ERROR',
      error: err.message,
      message: err.message,
    });
  }
  return next(err);
}

/** 公開：啟用中的活動類型（學生端／選項） */
router.get('/event-types', async (req, res, next) => {
  try {
    const rows = await eventTypeService.listEventTypes({ activeOnly: true });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return next(err);
  }
});

/** 管理：全部（含停用） */
router.get(
  '/admin/event-types',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_EVENTS),
  async (req, res, next) => {
    try {
      const rows = await eventTypeService.listEventTypes({ includeInactive: true });
      return res.json({ success: true, data: rows });
    } catch (err) {
      return next(err);
    }
  }
);

router.get(
  '/admin/event-types/:code',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_EVENTS),
  async (req, res, next) => {
    try {
      const row = await eventTypeService.getEventTypeByCode(req.params.code);
      if (!row) {
        return res.status(404).json({ success: false, error: '找不到活動類型' });
      }
      return res.json({ success: true, data: row });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/admin/event-types',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_EVENTS),
  async (req, res, next) => {
    try {
      const row = await eventTypeService.createEventType(req.body || {});
      auditLogService.logAuditAsync({
        module: 'event_types',
        action: 'create',
        entityType: 'EventType',
        entityId: row.code,
        req,
        after: row,
      });
      return res.status(201).json({ success: true, data: row });
    } catch (err) {
      return handleServiceError(res, err, next);
    }
  }
);

router.put(
  '/admin/event-types/:code',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_EVENTS),
  async (req, res, next) => {
    try {
      const row = await eventTypeService.updateEventType(req.params.code, req.body || {});
      auditLogService.logAuditAsync({
        module: 'event_types',
        action: 'update',
        entityType: 'EventType',
        entityId: row.code,
        req,
        after: row,
      });
      return res.json({ success: true, data: row });
    } catch (err) {
      return handleServiceError(res, err, next);
    }
  }
);

router.patch(
  '/admin/event-types/:code/active',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_EVENTS),
  async (req, res, next) => {
    try {
      const isActive = req.body?.isActive !== false && req.body?.isActive !== 0;
      const row = await eventTypeService.setEventTypeActive(req.params.code, isActive);
      auditLogService.logAuditAsync({
        module: 'event_types',
        action: isActive ? 'activate' : 'deactivate',
        entityType: 'EventType',
        entityId: row.code,
        req,
        after: row,
      });
      return res.json({ success: true, data: row });
    } catch (err) {
      return handleServiceError(res, err, next);
    }
  }
);

router.delete(
  '/admin/event-types/:code',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_EVENTS),
  async (req, res, next) => {
    try {
      const result = await eventTypeService.softDeleteEventType(req.params.code);
      auditLogService.logAuditAsync({
        module: 'event_types',
        action: 'delete',
        entityType: 'EventType',
        entityId: result.code,
        req,
      });
      return res.json({ success: true, data: result });
    } catch (err) {
      return handleServiceError(res, err, next);
    }
  }
);

module.exports = router;
