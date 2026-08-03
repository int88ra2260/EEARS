const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { safeNormalizeFilename } = require('../services/learningJourney/utils/safeNormalizeFilename');

const uploadDir = path.join(__dirname, '..', 'uploads', 'regulations-forms');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIME = new Set(['application/pdf']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = safeNormalizeFilename(file.originalname).replace(/[^a-zA-Z0-9._\u3400-\u9FFF-]/g, '_');
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}-${safe}`);
  },
});

const regulationsFormsUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('不支援的檔案格式（僅支援 PDF）'));
  },
});

module.exports = {
  regulationsFormsUpload,
  uploadDir,
};

