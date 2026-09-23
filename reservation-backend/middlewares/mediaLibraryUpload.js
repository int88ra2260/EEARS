const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { safeNormalizeFilename } = require('../services/learningJourney/utils/safeNormalizeFilename');

const MEDIA_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'media');
if (!fs.existsSync(MEDIA_UPLOAD_DIR)) fs.mkdirSync(MEDIA_UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf']);

/**
 * 磁碟檔名僅用 ASCII（時間戳 + uuid + 副檔名），避免 Windows／IIS 中文路徑亂碼。
 * 顯示用中文檔名存 DB 的 label / originalName。
 */
function buildStoredFilename(originalname) {
  const decoded = safeNormalizeFilename(originalname);
  let ext = path.extname(decoded || originalname || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    // 後備：從原始名再取一次
    ext = path.extname(String(originalname || '')).toLowerCase();
  }
  if (!ALLOWED_EXT.has(ext)) ext = '';
  return `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MEDIA_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    cb(null, buildStoredFilename(file.originalname));
  },
});

const mediaLibraryUpload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB（含 PDF）
  fileFilter: (_req, file, cb) => {
    // 先還原可能的 latin1 mojibake，再判斷副檔名
    const decoded = safeNormalizeFilename(file.originalname);
    const ext = path.extname(decoded || file.originalname || '').toLowerCase();
    const mimeOk = ALLOWED_MIME.has(file.mimetype);
    const extOk = ALLOWED_EXT.has(ext);
    if (mimeOk && extOk) return cb(null, true);
    if (ext === '.pdf' && (file.mimetype === 'application/pdf' || file.mimetype === 'application/octet-stream')) {
      return cb(null, true);
    }
    cb(new Error('不支援的檔案格式（僅支援 JPG / PNG / WebP / GIF / PDF）'));
  },
});

module.exports = {
  mediaLibraryUpload,
  MEDIA_UPLOAD_DIR,
  ALLOWED_MIME,
  ALLOWED_EXT,
  buildStoredFilename,
};
