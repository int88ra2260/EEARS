// middlewares/errorHandler.js
const { createAPIError, logError } = require('../utils/errorMessages');
const logger = require('../utils/logger');

/**
 * 全域錯誤處理中間件
 */
const errorHandler = (err, req, res, next) => {
  // 預設錯誤訊息
  let statusCode = 500;
  let errorKey = 'SERVER_ERROR';
  let details = null;

  // Sequelize 錯誤處理
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    errorKey = 'DATABASE_QUERY_FAILED';
    details = err.errors.map(error => error.message).join(', ');
    logError('DATABASE_QUERY_FAILED', err, details);
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    errorKey = 'DATABASE_QUERY_FAILED';
    details = '重複的資料';
    logError('DATABASE_QUERY_FAILED', err, details);
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    errorKey = 'DATABASE_QUERY_FAILED';
    details = '外鍵約束錯誤';
    logError('DATABASE_QUERY_FAILED', err, details);
  } else if (err.name === 'SequelizeConnectionError') {
    statusCode = 503;
    errorKey = 'DATABASE_CONNECTION_FAILED';
    logError('DATABASE_CONNECTION_FAILED', err);
  } else if (err.name === 'SequelizeTimeoutError') {
    statusCode = 504;
    errorKey = 'SERVICE_UNAVAILABLE';
    details = '請求超時';
    logError('SERVICE_UNAVAILABLE', err, details);
  } else if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    errorKey = 'DATABASE_QUERY_FAILED';
    logError('DATABASE_QUERY_FAILED', err);
  }

  // JWT錯誤處理
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorKey = 'TOKEN_INVALID';
    logError('TOKEN_INVALID', err);
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorKey = 'TOKEN_INVALID';
    details = '令牌已過期';
    logError('TOKEN_INVALID', err, details);
  }
  // 頻率限制錯誤
  else if (err.status === 429) {
    statusCode = 429;
    errorKey = 'RATE_LIMIT_EXCEEDED';
    logError('RATE_LIMIT_EXCEEDED', err);
  }
  // multipart / busboy 解析失敗（未走路由層 upload error handler 時的後備）
  else if (
    typeof err.message === 'string'
    && (
      err.message.includes('Unexpected end of form')
      || err.message.includes('Multipart: Boundary not found')
      || err.message.includes('Unexpected end of multipart data')
    )
  ) {
    statusCode = 400;
    errorKey = 'REQUIRED_FIELD_MISSING';
    details = '上傳資料不完整或格式錯誤，請重新整理頁面後再試一次';
    logError('REQUIRED_FIELD_MISSING', err, details);
  }
  // 輸入驗證錯誤
  else if (err.status === 400) {
    statusCode = 400;
    errorKey = 'REQUIRED_FIELD_MISSING';
    details = err.message;
    logError('REQUIRED_FIELD_MISSING', err, details);
  }
  // 權限錯誤
  else if (err.status === 403) {
    statusCode = 403;
    errorKey = 'INSUFFICIENT_PERMISSIONS';
    logError('INSUFFICIENT_PERMISSIONS', err);
  }
  // 資源不存在錯誤
  else if (err.status === 404) {
    statusCode = 404;
    errorKey = 'NO_DATA_FOUND';
    logError('NO_DATA_FOUND', err);
  }
  // 請求體過大錯誤
  else if (err.type === 'entity.too.large') {
    statusCode = 413;
    errorKey = 'SERVER_ERROR';
    details = '請求資料過大';
    logError('SERVER_ERROR', err, details);
  }
  // JSON 解析錯誤
  else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    errorKey = 'REQUIRED_FIELD_MISSING';
    details = 'JSON 格式錯誤';
    logError('REQUIRED_FIELD_MISSING', err, details);
  }
  // 其他錯誤
  else {
    logError('SERVER_ERROR', err);
  }

  // 生成API錯誤響應
  const apiError = createAPIError(errorKey, statusCode, details);
  
  // 開發環境顯示詳細錯誤
  const response = {
    ...apiError,
    requestId: req.requestId || null,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.originalError = err.message;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 錯誤處理中間件
 */
const notFoundHandler = (req, res) => {
  const apiError = createAPIError('NO_DATA_FOUND', 404);
  res.status(404).json({
    ...apiError,
    requestId: req.requestId || null,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
};

/**
 * 未捕獲的 Promise 拒絕處理
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未處理的 Promise 拒絕', reason instanceof Error ? reason : new Error(String(reason)));
    logger.debug('unhandledRejection promise', { promise: String(promise) });
  });
};

/**
 * 未捕獲的異常處理
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (error) => {
    logger.error('未捕獲的異常', error);
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException
};