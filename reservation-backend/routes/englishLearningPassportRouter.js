'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const passportService = require('../services/englishLearningPassport/passportService');
const { exportCertificationCertificate } = require('../services/englishLearningPassport/certificationCertificateService');
const { safeNormalizeFilename } = require('../services/learningJourney/utils/safeNormalizeFilename');
const {
  createSimpleRateLimit,
  elpStudentKey,
  requireCaptchaIfEnabled,
} = require('../middlewares/publicAccessGuard');

const router = express.Router();

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const uploadDir = path.join(__dirname, '..', 'uploads', 'english-learning-passport');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = safeNormalizeFilename(file.originalname).replace(/[^a-zA-Z0-9._\u3400-\u9FFF-]/g, '_');
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('不支援的檔案格式'));
  },
});

const elpReadRateLimit = createSimpleRateLimit({
  windowMs: Number(process.env.ELP_READ_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
  max: Number(process.env.ELP_READ_RATE_LIMIT_MAX) || 300,
  message: '查詢過於頻繁，請稍後再試',
  keyFn: elpStudentKey,
});

const elpWriteRateLimit = createSimpleRateLimit({
  windowMs: Number(process.env.ELP_WRITE_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
  max: Number(process.env.ELP_WRITE_RATE_LIMIT_MAX) || 40,
  message: '操作過於頻繁，請稍後再試',
  keyFn: elpStudentKey,
});

function extractStudentContext(req) {
  const body = req.body || {};
  const query = req.query || {};
  return passportService.normalizeStudentContext({
    studentId: body.studentId || query.studentId,
    studentName: body.studentName || query.studentName,
    studentEmail: body.studentEmail || query.studentEmail,
  });
}

function requireStudentContext(req, res, next) {
  const ctx = extractStudentContext(req);
  if (!ctx.studentId || !ctx.studentName || !ctx.studentEmail) {
    return res.status(400).json({
      success: false,
      code: 'REQUIRED_FIELD_MISSING',
      message: '請提供學號、姓名與 Email',
    });
  }
  req.studentContext = ctx;
  return next();
}

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

router.get('/english-learning-passport/rules', async (_req, res, next) => {
  try {
    const rules = await passportService.listEnabledRules();
    res.json({ success: true, data: rules });
  } catch (e) {
    next(e);
  }
});

router.get(
  '/english-learning-passport/me',
  elpReadRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await passportService.getStudentDashboard(req.studentContext);
      res.json({ success: true, data });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.post(
  '/english-learning-passport/apply',
  elpWriteRateLimit,
  requireStudentContext,
  requireCaptchaIfEnabled,
  async (req, res, next) => {
    try {
      const data = await passportService.applyPassport(
        req.studentContext,
        { applicationReason: req.body.applicationReason },
        req,
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.get(
  '/english-learning-passport/submissions',
  elpReadRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await passportService.getStudentDashboard(req.studentContext);
      res.json({ success: true, data: data.submissions });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.post(
  '/english-learning-passport/submissions',
  elpWriteRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await passportService.createSubmission(req.studentContext, req.body, req);
      res.status(201).json({ success: true, data });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.get(
  '/english-learning-passport/submissions/:id',
  elpReadRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await passportService.getSubmissionForStudent(req.studentContext, req.params.id);
      res.json({ success: true, data });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.put(
  '/english-learning-passport/submissions/:id',
  elpWriteRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await passportService.updateSubmission(
        req.studentContext,
        req.params.id,
        req.body,
        req,
      );
      res.json({ success: true, data });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.delete(
  '/english-learning-passport/submissions/:id',
  elpWriteRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await passportService.deleteSubmission(req.studentContext, req.params.id, req);
      res.json({ success: true, data });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.post(
  '/english-learning-passport/submissions/:id/submit',
  elpWriteRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await passportService.submitSubmission(req.studentContext, req.params.id, req);
      res.json({ success: true, data });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.post(
  '/english-learning-passport/submissions/:id/attachments',
  upload.single('file'),
  elpWriteRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '請上傳檔案' });
      }
      const relativePath = path.posix.join(
        'english-learning-passport',
        path.basename(req.file.path),
      );
      const data = await passportService.addAttachment(
        req.studentContext,
        req.params.id,
        {
          fileName: safeNormalizeFilename(req.file.originalname),
          filePath: relativePath,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
        },
        req,
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.delete(
  '/english-learning-passport/attachments/:attachmentId',
  elpWriteRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await passportService.deleteAttachment(
        req.studentContext,
        req.params.attachmentId,
        req,
      );
      res.json({ success: true, data });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.post(
  '/english-learning-passport/certification/request',
  elpWriteRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const data = await passportService.requestCertification(req.studentContext, req);
      res.json({ success: true, data });
    } catch (e) {
      handleServiceError(e, res, next);
    }
  },
);

router.get(
  '/english-learning-passport/certification/certificate',
  elpReadRateLimit,
  requireStudentContext,
  async (req, res, next) => {
    try {
      const autoPrint = String(req.query.autoprint || '').toLowerCase() === '1'
        || String(req.query.format || '').toLowerCase() === 'pdf';
      const { html, fileName } = await exportCertificationCertificate(
        req.studentContext,
        req,
        { autoPrint },
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      return res.send(html);
    } catch (e) {
      return handleServiceError(e, res, next);
    }
  },
);

module.exports = router;
