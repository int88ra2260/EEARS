const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { createMulterUploadErrorHandler } = require('../middlewares/multerUploadError');
const {
  readHostToken,
  loginHost,
  listSets,
  createSet,
  updateSet,
  getSet,
  publishSet,
  closeSet,
  joinSet,
  getSession,
  submitResponse,
  getResults,
  getResponseAudio,
  rateResponse,
} = require('../services/speakingCheckSetService');
const auditLogService = require('../services/auditLogService');

const uploadDir = path.join(__dirname, '..', 'uploads', 'speaking-check');
fs.mkdirSync(uploadDir, { recursive: true });

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ext === '.mp4' || ext === '.m4a' || ext === '.webm' || ext === '.wav' || ext === '.ogg' ? ext : '.webm';
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const type = String(file.mimetype || '').toLowerCase();
    if (type.startsWith('audio/') || type === 'video/webm') return cb(null, true);
    const error = new Error('只允許上傳音訊檔');
    return cb(error);
  },
});

function speakingAudioUploadError(error, req, res, next) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      code: 'UPLOAD_FILE_TOO_LARGE',
      message: '錄音檔太大，請再錄一次短一點的版本',
    });
  }
  return createMulterUploadErrorHandler({ logLabel: 'Speaking check upload failed' })(error, req, res, next);
}

const router = express.Router();

function sendServiceError(res, next, error) {
  if (error?.status && error.status < 500) {
    return res.status(error.status).json({
      success: false,
      code: error.code || 'SPEAKING_CHECK_ERROR',
      message: error.message,
    });
  }
  return next(error);
}

function hostIdFromRequest(req) {
  const decoded = readHostToken(req.headers.authorization);
  return decoded.hostId;
}

router.post('/speaking-host/login', async (req, res, next) => {
  try {
    const data = await loginHost(req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.get('/speaking-host/sets', async (req, res, next) => {
  try {
    const data = await listSets(hostIdFromRequest(req));
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.post('/speaking-host/sets', async (req, res, next) => {
  try {
    const data = await createSet(hostIdFromRequest(req), req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.get('/speaking-host/sets/:setId', async (req, res, next) => {
  try {
    const data = await getSet(hostIdFromRequest(req), req.params.setId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.put('/speaking-host/sets/:setId', async (req, res, next) => {
  try {
    const data = await updateSet(hostIdFromRequest(req), req.params.setId, req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.post('/speaking-host/sets/:setId/publish', async (req, res, next) => {
  try {
    const data = await publishSet(hostIdFromRequest(req), req.params.setId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.post('/speaking-host/sets/:setId/close', async (req, res, next) => {
  try {
    const data = await closeSet(hostIdFromRequest(req), req.params.setId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.get('/speaking-host/responses/:responseId/audio', async (req, res, next) => {
  try {
    const file = await getResponseAudio(hostIdFromRequest(req), req.params.responseId);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', file.size);
    res.setHeader('Cache-Control', 'private, no-store');
    return fs.createReadStream(file.path).pipe(res);
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.put('/speaking-host/responses/:responseId/rating', async (req, res, next) => {
  try {
    const host = readHostToken(req.headers.authorization);
    const data = await rateResponse(host.hostId, req.params.responseId, req.body || {});
    auditLogService.logAuditAsync({
      module: 'speaking_check',
      action: 'response_rated',
      entityType: 'SpeakingCheckResponse',
      entityId: req.params.responseId,
      targetSummary: data?.participantName || null,
      beforeData: data?.previousRating || null,
      afterData: data?.rating || null,
      operatorId: host.hostId,
      operatorRole: 'speaking_host',
      operatorName: host.username || null,
      req,
    });
    return res.json({ success: true, data: data?.rating || null });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.get('/speaking-host/sets/:setId/results', async (req, res, next) => {
  try {
    const data = await getResults(hostIdFromRequest(req), req.params.setId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.post('/speaking-check/join', async (req, res, next) => {
  try {
    const data = await joinSet(req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.get('/speaking-check/sessions/:participantUid', async (req, res, next) => {
  try {
    const data = await getSession(req.params.participantUid);
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.post(
  '/speaking-check/sessions/:participantUid/responses',
  audioUpload.single('audio'),
  speakingAudioUploadError,
  async (req, res, next) => {
    try {
      const data = await submitResponse(req.params.participantUid, req.body || {}, req.file || null);
      return res.json({ success: true, data });
    } catch (error) {
      return sendServiceError(res, next, error);
    }
  },
);

module.exports = router;
