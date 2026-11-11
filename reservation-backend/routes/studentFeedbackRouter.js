'use strict';

const express = require('express');
const { studentAuthMiddleware, requireStudentEmailVerified } = require('../middlewares/studentAuth');
const {
  submitStudentFeedback,
  listMyStudentFeedback,
  getMyStudentFeedback,
  addStudentFollowUp,
} = require('../services/studentFeedbackService');

const router = express.Router();

function sendError(err, res, next) {
  if (err && err.status) {
    const body = { success: false, code: err.code, message: err.message };
    if (err.redirectUrl) body.redirectUrl = err.redirectUrl;
    return res.status(err.status).json(body);
  }
  return next(err);
}

router.use(studentAuthMiddleware, requireStudentEmailVerified);

router.get('/', async (req, res, next) => {
  try {
    const result = await listMyStudentFeedback({
      account: req.studentAccount,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendError(err, res, next);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await submitStudentFeedback({
      account: req.studentAccount,
      kind: body.kind,
      category: body.category,
      message: body.message,
      replyRequested: body.replyRequested,
    });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return sendError(err, res, next);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await getMyStudentFeedback({
      account: req.studentAccount,
      id: req.params.id,
    });
    return res.json({ success: true, item });
  } catch (err) {
    return sendError(err, res, next);
  }
});

router.post('/:id/messages', async (req, res, next) => {
  try {
    const item = await addStudentFollowUp({
      account: req.studentAccount,
      id: req.params.id,
      message: req.body && req.body.message,
    });
    return res.status(201).json({ success: true, item });
  } catch (err) {
    return sendError(err, res, next);
  }
});

module.exports = router;
