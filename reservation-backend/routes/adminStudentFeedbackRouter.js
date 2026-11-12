'use strict';

const express = require('express');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { P } = require('../auth/permissions');
const {
  listStudentFeedback,
  summarizeStudentFeedback,
  getStudentFeedback,
  listStudentFeedbackEvents,
  addStaffReply,
  addStaffNote,
  updateStudentFeedbackCase,
  listFeedbackAssignees,
} = require('../services/studentFeedbackService');

const router = express.Router();

function canManageFeedback(req) {
  const permissions = req.accessProfile && req.accessProfile.permissionSet;
  return Boolean(permissions && permissions.has(P.CAN_MANAGE_STUDENT_FEEDBACK));
}

function sendError(err, res, next) {
  if (err && err.status) {
    return res.status(err.status).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }
  return next(err);
}

router.use(authMiddleware, requirePermission(P.CAN_VIEW_STUDENT_FEEDBACK));

router.get('/assignees', async (req, res, next) => {
  try {
    const items = await listFeedbackAssignees();
    return res.json({ success: true, items });
  } catch (err) {
    return sendError(err, res, next);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const summary = await summarizeStudentFeedback();
    return res.json({ success: true, ...summary });
  } catch (err) {
    return sendError(err, res, next);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await listStudentFeedback({
      kind: req.query.kind || '',
      status: req.query.status || '',
      category: req.query.category || '',
      priority: req.query.priority || '',
      q: req.query.q || '',
      assignedTeacherId: req.query.assignedTeacherId || '',
      from: req.query.from || '',
      to: req.query.to || '',
      page: req.query.page,
      pageSize: req.query.pageSize,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      includeInternal: canManageFeedback(req),
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendError(err, res, next);
  }
});

router.get('/:id/events', async (req, res, next) => {
  try {
    const result = await listStudentFeedbackEvents(req.params.id, {
      includeInternal: canManageFeedback(req),
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendError(err, res, next);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await getStudentFeedback(req.params.id, {
      includeInternal: canManageFeedback(req),
    });
    return res.json({ success: true, item });
  } catch (err) {
    return sendError(err, res, next);
  }
});

router.post('/:id/replies', requirePermission(P.CAN_MANAGE_STUDENT_FEEDBACK), async (req, res, next) => {
  try {
    const result = await addStaffReply({
      id: req.params.id,
      teacher: req.user,
      message: req.body && req.body.message,
      requestId: req.requestId || null,
    });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return sendError(err, res, next);
  }
});

router.post('/:id/notes', requirePermission(P.CAN_MANAGE_STUDENT_FEEDBACK), async (req, res, next) => {
  try {
    const item = await addStaffNote({
      id: req.params.id,
      teacher: req.user,
      message: req.body && req.body.message,
      requestId: req.requestId || null,
    });
    return res.json({ success: true, item });
  } catch (err) {
    return sendError(err, res, next);
  }
});

router.patch('/:id', requirePermission(P.CAN_MANAGE_STUDENT_FEEDBACK), async (req, res, next) => {
  try {
    const body = req.body || {};
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(body, 'status')) patch.status = body.status;
    if (Object.prototype.hasOwnProperty.call(body, 'assignedTeacherId')) {
      patch.assignedTeacherId = body.assignedTeacherId;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'priority')) patch.priority = body.priority;
    const item = await updateStudentFeedbackCase({
      id: req.params.id,
      patch,
      actor: req.user,
      requestId: req.requestId || null,
    });
    return res.json({ success: true, item });
  } catch (err) {
    return sendError(err, res, next);
  }
});

module.exports = router;
