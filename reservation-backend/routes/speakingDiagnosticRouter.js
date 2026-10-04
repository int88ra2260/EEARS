'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const { createMulterUploadErrorHandler } = require('../middlewares/multerUploadError');
const {
  listSpeakingTasks,
  createAdaptiveSession,
  getAdaptiveSession,
  getAdaptiveNextTask,
  getNextSpeakingTask,
  submitSpeakingAttempt,
  listRecentAttempts,
  rateSpeakingAttempt,
  realignSpeakingAttempt,
  getSpeakingResearchSummary,
  exportSpeakingResearchCsv,
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


router.post('/speaking-diagnostic/adaptive-sessions', async (req, res, next) => {
  try {
    const data = await createAdaptiveSession(req.body || {});
    return res.status(201).json({ success: true, data, requestId: req.requestId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'SPEAKING_ADAPTIVE_SESSION_ERROR',
        message: err.message,
        requestId: req.requestId,
      });
    }
    return next(err);
  }
});

router.get('/speaking-diagnostic/adaptive-sessions/:sessionUid', async (req, res, next) => {
  try {
    const includeNextTask = req.query.includeNextTask === '1' || req.query.includeNextTask === 'true';
    const data = await getAdaptiveSession(req.params.sessionUid, { includeNextTask });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'SPEAKING_ADAPTIVE_SESSION_ERROR',
        message: err.message,
        requestId: req.requestId,
      });
    }
    return next(err);
  }
});

router.get('/speaking-diagnostic/adaptive-sessions/:sessionUid/next-task', async (req, res, next) => {
  try {
    const data = await getAdaptiveNextTask(req.params.sessionUid);
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'SPEAKING_ADAPTIVE_SESSION_ERROR',
        message: err.message,
        requestId: req.requestId,
      });
    }
    return next(err);
  }
});

router.get('/speaking-diagnostic/tasks', async (req, res, next) => {
  try {
    const data = await listSpeakingTasks(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (err) {
    return next(err);
  }
});

router.get('/speaking-diagnostic/next-task', async (req, res, next) => {
  try {
    const data = await getNextSpeakingTask(req.query || {});
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

router.post(
  '/admin/speaking-diagnostic/attempts/:attemptUid/ratings',
  authMiddleware,
  requirePermission(P.CAN_VIEW_LEARNING_ANALYTICS),
  async (req, res, next) => {
    try {
      const data = await rateSpeakingAttempt(req.params.attemptUid, req.body || {}, req.user || {});
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

router.get(
  '/admin/speaking-diagnostic/research-summary',
  authMiddleware,
  requirePermission(P.CAN_VIEW_LEARNING_ANALYTICS),
  async (req, res, next) => {
    try {
      const data = await getSpeakingResearchSummary(req.query || {});
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

router.get(
  '/admin/speaking-diagnostic/research-export.csv',
  authMiddleware,
  requirePermission(P.CAN_VIEW_LEARNING_ANALYTICS),
  async (req, res, next) => {
    try {
      const data = await exportSpeakingResearchCsv(req.query || {});
      res.setHeader('Content-Type', data.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${data.filename}"`);
      return res.send(data.body);
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

router.post(
  '/admin/speaking-diagnostic/attempts/:attemptUid/alignment/recompute',
  authMiddleware,
  requirePermission(P.CAN_VIEW_LEARNING_ANALYTICS),
  async (req, res, next) => {
    try {
      const data = await realignSpeakingAttempt(req.params.attemptUid);
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
