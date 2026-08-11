const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { safeNormalizeFilename } = require('../services/learningJourney/utils/safeNormalizeFilename');

const MEDIA_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'media');
if (!fs.existsSync(MEDIA_UPLOAD_DIR)) fs.mkdirSync(MEDIA_UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MEDIA_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = safeNormalizeFilename(file.originalname).replace(/[^a-zA-Z0-9._\u3400-\u9FFF-]/g, '_');
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}-${safe}`);
  },
});

const mediaLibraryUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('不支援的檔案格式（僅支援 JPG / PNG / WebP / GIF）'));
  },
});

module.exports = {
  mediaLibraryUpload,
  MEDIA_UPLOAD_DIR,
  ALLOWED_MIME,
};
