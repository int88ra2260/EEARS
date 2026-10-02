'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const { createMulterUploadErrorHandler } = require('../middlewares/multerUploadError');
const {
  listSpeakingTasks,
  submitSpeakingAttempt,
  listRecentAttempts,
} = require('../services/speakingDiagnosticService');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads', 'speaking-diagnostic');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.webm';
    const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : '.webm';
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const type = String(file.mimetype || '').toLowerCase();
    if (type.startsWith('audio/') || type === 'video/webm') return cb(null, true);
    return cb(new Error('只允許上傳音訊檔'));
  },
});

router.get('/speaking-diagnostic/tasks', async (req, res, next) => {
  try {
    const data = await listSpeakingTasks(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/speaking-diagnostic/attempts',
  upload.single('audio'),
  createMulterUploadErrorHandler({ logLabel: 'Speaking diagnostic upload failed' }),
  async (req, res, next) => {
    try {
      const data = await submitSpeakingAttempt({ body: req.body || {}, file: req.file });
      return res.status(201).json({ success: true, data, requestId: req.requestId });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          code: err.code || 'SPEAKING_DIAGNOSTIC_ERROR',
          message: err.message,
          requestId: req.requestId,
        });
      }
      return next(err);
    }
  },
);

router.get(
  '/admin/speaking-diagnostic/attempts',
  authMiddleware,
  requirePermission(P.CAN_VIEW_LEARNING_ANALYTICS),
  async (req, res, next) => {
    try {
      const data = await listRecentAttempts(req.query || {});
      return res.json({ success: true, data, requestId: req.requestId });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          code: err.code || 'SPEAKING_DIAGNOSTIC_ERROR',
          message: err.message,
          requestId: req.requestId,
        });
      }
      return next(err);
    }
  },
);

module.exports = router;
