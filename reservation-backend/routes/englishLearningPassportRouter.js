'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const passportService = require('../services/englishLearningPassport/passportService');
const elpEmailVerificationService = require('../services/englishLearningPassport/elpEmailVerificationService');
const { exportCertificationCertificate } = require('../services/englishLearningPassport/certificationCertificateService');
const { safeNormalizeFilename } = require('../services/learningJourney/utils/safeNormalizeFilename');
const emailLogService = require('../services/emailLogService');
const logger = require('../utils/logger');
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

/** 寫入以 IP 為主限流，避免掃描器輪換假學號繞過 */
const elpWriteRateLimit = createSimpleRateLimit({
  windowMs: Number(process.env.ELP_WRITE_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
  max: Number(process.env.ELP_WRITE_RATE_LIMIT_MAX) || 20,
  message: '操作過於頻繁，請稍後再試',
  keyFn: (_req, ip) => `elp:write:ip:${ip}`,
});

const elpEmailSendRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.ELP_EMAIL_SEND_RATE_LIMIT_MAX) || 8,
  message: '驗證碼寄送過於頻繁，請稍後再試',
  keyFn: (_req, ip) => `elp:otp-send:ip:${ip}`,
});

const elpEmailVerifyRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.ELP_EMAIL_VERIFY_RATE_LIMIT_MAX) || 20,
  message: '驗證嘗試過於頻繁，請稍後再試',
  keyFn: (_req, ip) => `elp:otp-verify:ip:${ip}`,
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
  try {
    req.studentContext = passportService.assertValidStudentContext(extractStudentContext(req));
    return next();
  } catch (err) {
    return res.status(err.status || 400).json({
      success: false,
      code: err.code || 'INVALID_STUDENT_CONTEXT',
      message: err.message || '請提供正確的學號、姓名與 Email',
    });
  }
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

router.post(
  '/english-learning-passport/email-verification/send',
  elpEmailSendRateLimit,
  requireCaptchaIfEnabled,
  async (req, res) => {
    try {
      const email = req.body?.email || req.body?.studentEmail;
      const studentId = req.body?.studentId || null;
      const { code, expiresInSec, email: normalizedEmail } =
        await elpEmailVerificationService.createAndSendCode({ email, studentId });

      try {
        await emailLogService.sendEmailWithLog(
          'englishLearningPassportEmailVerification',
          {
            email: normalizedEmail,
            code,
            expiresInMinutes: Math.floor(expiresInSec / 60),
            studentId: studentId || '',
          },
          {
            requestId: req.requestId || `elp-otp:${Date.now()}`,
            relatedEntityType: 'EnglishLearningPassportEmailVerification',
            relatedEntityId: normalizedEmail,
          },
        );
      } catch (mailErr) {
        logger.error('ELP 寄送信箱驗證碼失敗', mailErr);
        try {
          await elpEmailVerificationService.invalidateActiveCodes(normalizedEmail);
        } catch (_) { /* ignore */ }
        return res.status(503).json({
          success: false,
          code: 'EMAIL_SEND_FAILED',
          message: '驗證碼寄送失敗，請稍後再試或確認信箱是否正確',
        });
      }

      return res.json({
        success: true,
        message: '驗證碼已寄至您的信箱，請於 10 分鐘內完成驗證',
        expiresInSec,
      });
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) logger.error('ELP 寄送信箱驗證碼失敗', error);
      return res.status(status).json({
        success: false,
        code: error.code || 'EMAIL_VERIFICATION_SEND_FAILED',
        message: error.message || '寄送驗證碼失敗，請稍後再試',
        retryAfterSec: error.retryAfterSec || undefined,
      });
    }
  },
);

router.post(
  '/english-learning-passport/email-verification/verify',
  elpEmailVerifyRateLimit,
  requireCaptchaIfEnabled,
  async (req, res) => {
    try {
      const result = await elpEmailVerificationService.verifyCode({
        email: req.body?.email || req.body?.studentEmail,
        code: req.body?.code,
      });
      return res.json({
        success: true,
        email: result.email,
        emailVerificationToken: result.emailVerificationToken,
        expiresInSec: result.expiresInSec,
      });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({
        success: false,
        code: error.code || 'EMAIL_VERIFICATION_VERIFY_FAILED',
        message: error.message || '驗證失敗，請稍後再試',
      });
    }
  },
);

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
        {
          applicationReason: req.body.applicationReason,
          emailVerificationToken: req.body.emailVerificationToken,
        },
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
