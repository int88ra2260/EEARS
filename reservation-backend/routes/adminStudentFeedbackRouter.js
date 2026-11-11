'use strict';

const express = require('express');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { P } = require('../auth/permissions');
const {
  listStudentFeedback,
  getStudentFeedback,
  addStaffReply,
  addStaffNote,
  updateStudentFeedbackCase,
  listFeedbackAssignees,
} = require('../services/studentFeedbackService');

const router = express.Router();

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

router.get('/', async (req, res, next) => {
  try {
    const result = await listStudentFeedback({
      kind: req.query.kind || '',
      status: req.query.status || '',
      category: req.query.category || '',
      q: req.query.q || '',
      assignedTeacherId: req.query.assignedTeacherId || '',
      from: req.query.from || '',
      to: req.query.to || '',
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
    const item = await getStudentFeedback(req.params.id);
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
    const item = await updateStudentFeedbackCase({ id: req.params.id, patch });
    return res.json({ success: true, item });
  } catch (err) {
    return sendError(err, res, next);
  }
});

module.exports = router;
