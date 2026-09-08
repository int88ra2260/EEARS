/**
 * Multer / busboy 上傳錯誤 → 穩定 400 回應（避免 Unexpected end of form 變成 500）
 */
const multer = require('multer');
const logger = require('../utils/logger');

function isMultipartParseError(err) {
  const msg = String((err && err.message) || '');
  return (
    msg.includes('Unexpected end of form')
    || msg.includes('Multipart: Boundary not found')
    || msg.includes('Unexpected end of multipart data')
  );
}

function createMulterUploadErrorHandler(options = {}) {
  const logLabel = options.logLabel || 'Multer 錯誤';

  return function multerUploadErrorHandler(error, req, res, next) {
    if (error instanceof multer.MulterError) {
      logger.error(logLabel, error);
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          code: 'UPLOAD_FILE_TOO_LARGE',
          error: '檔案大小超過限制 (5MB)',
        });
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          code: 'UPLOAD_FILE_COUNT_EXCEEDED',
          error: '檔案數量超過限制',
        });
      }
      return res.status(400).json({
        success: false,
        code: 'UPLOAD_ERROR',
        error: `檔案上傳錯誤: ${error.message}`,
      });
    }

    if (isMultipartParseError(error)) {
      logger.warn('Multipart 解析失敗', {
        message: error.message,
        path: req.originalUrl || req.path,
        contentType: req.headers && req.headers['content-type'],
        contentLength: req.headers && req.headers['content-length'],
      });
      return res.status(400).json({
        success: false,
        code: 'MULTIPART_PARSE_FAILED',
        error: '上傳資料不完整或格式錯誤，請重新整理頁面後再試一次',
      });
    }

    if (error && error.message && String(error.message).includes('只允許上傳')) {
      return res.status(400).json({
        success: false,
        code: 'UPLOAD_FILE_TYPE_REJECTED',
        error: error.message,
      });
    }

    return next(error);
  };
}

module.exports = {
  isMultipartParseError,
  createMulterUploadErrorHandler,
};
