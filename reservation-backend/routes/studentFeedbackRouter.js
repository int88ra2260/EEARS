'use strict';

const express = require('express');
const { studentAuthMiddleware } = require('../middlewares/studentAuth');
const { submitStudentFeedback } = require('../services/studentFeedbackService');

const router = express.Router();

router.post('/', studentAuthMiddleware, async (req, res, next) => {
  try {
    const result = await submitStudentFeedback({
      account: req.studentAccount,
      kind: req.body && req.body.kind,
      category: req.body && req.body.category,
      message: req.body && req.body.message,
    });
    return res.status(201).json({ success: true, ...result });
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
