'use strict';

const express = require('express');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { P } = require('../auth/permissions');
const { listStudentFeedback } = require('../services/studentFeedbackService');

const router = express.Router();

router.use(authMiddleware, requirePermission(P.CAN_VIEW_STUDENT_FEEDBACK));

router.get('/', async (req, res, next) => {
  try {
    const items = await listStudentFeedback({ kind: req.query.kind || '' });
    return res.json({ success: true, items });
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code,
        message: err.message,
      });
    }
    return next(err);
  }
});

module.exports = router;
