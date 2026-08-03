// utils/errorMessages.js - 統一的錯誤訊息管理
const ERROR_MESSAGES = {
  // 數據庫相關錯誤
  DATABASE_CONNECTION_FAILED: {
    zh: '資料庫連線失敗',
    en: 'Database connection failed'
  },
  DATABASE_QUERY_FAILED: {
    zh: '資料庫查詢失敗',
    en: 'Database query failed'
  },
  NO_DATA_FOUND: {
    zh: '查無符合資料',
    en: 'No data found'
  },
  DATA_INSERT_FAILED: {
    zh: '資料插入失敗',
    en: 'Data insertion failed'
  },
  DATA_UPDATE_FAILED: {
    zh: '資料更新失敗',
    en: 'Data update failed'
  },
  DATA_DELETE_FAILED: {
    zh: '資料刪除失敗',
    en: 'Data deletion failed'
  },

  // 驗證相關錯誤
  INVALID_STUDENT_ID: {
    zh: '學號格式不正確',
    en: 'Invalid student ID format'
  },
  INVALID_EMAIL: {
    zh: '請輸入有效的電子郵件',
    en: 'Please enter a valid email address'
  },
  INVALID_NAME: {
    zh: '姓名格式不正確',
    en: 'Invalid name format'
  },
  REQUIRED_FIELD_MISSING: {
    zh: '缺少必要欄位',
    en: 'Required field is missing'
  },
  INVALID_DATE_FORMAT: {
    zh: '日期格式不正確',
    en: 'Invalid date format'
  },
  INVALID_TIME_FORMAT: {
    zh: '時間格式不正確',
    en: 'Invalid time format'
  },
  INVALID_NUMBER: {
    zh: '請輸入有效的數字',
    en: 'Please enter a valid number'
  },

  // 認證相關錯誤
  TOKEN_MISSING: {
    zh: '未提供認證令牌',
    en: 'Authentication token is missing'
  },
  TOKEN_INVALID: {
    zh: '認證令牌無效',
    en: 'Authentication token is invalid'
  },
  TOKEN_EXPIRED: {
    zh: '認證令牌已過期，請重新登入',
    en: 'Authentication token has expired, please login again'
  },
  ACCESS_PROFILE_STALE: {
    zh: '權限資料已更新，請重新登入',
    en: 'Access profile changed, please login again'
  },
  ACCOUNT_DISABLED: {
    zh: '此帳號已停用，請聯絡管理員',
    en: 'This account is disabled; contact an administrator'
  },
  INSUFFICIENT_PERMISSIONS: {
    zh: '權限不足',
    en: 'Insufficient permissions'
  },
  LOGIN_FAILED: {
    zh: '登入失敗',
    en: 'Login failed'
  },
  INVALID_CREDENTIALS: {
    zh: '帳號或密碼錯誤',
    en: 'Invalid username or password'
  },

  // 業務邏輯錯誤
  EVENT_NOT_FOUND: {
    zh: '活動不存在',
    en: 'Event not found'
  },
  EVENT_FULL: {
    zh: '活動名額已滿',
    en: 'Event is full'
  },
  RESERVATION_EXISTS: {
    zh: '您已預約此活動',
    en: 'You have already reserved this event'
  },
  RESERVATION_NOT_FOUND: {
    zh: '預約不存在',
    en: 'Reservation not found'
  },
  SURVEY_REQUIRED: {
    zh: '請先完成問卷調查',
    en: 'Please complete the survey first'
  },
  BLACKLISTED_USER: {
    zh: '您的帳號已被列入黑名單',
    en: 'Your account has been blacklisted'
  },

  // 系統錯誤
  SERVER_ERROR: {
    zh: '伺服器內部錯誤',
    en: 'Internal server error'
  },
  NETWORK_ERROR: {
    zh: '網路連線錯誤',
    en: 'Network connection error'
  },
  SERVICE_UNAVAILABLE: {
    zh: '服務暫時無法使用',
    en: 'Service temporarily unavailable'
  },
  RATE_LIMIT_EXCEEDED: {
    zh: '請求過於頻繁，請稍後再試',
    en: 'Too many requests, please try again later'
  },

  // 文件操作錯誤
  FILE_UPLOAD_FAILED: {
    zh: '檔案上傳失敗',
    en: 'File upload failed'
  },
  FILE_NOT_FOUND: {
    zh: '檔案不存在',
    en: 'File not found'
  },
  INVALID_FILE_FORMAT: {
    zh: '檔案格式不正確',
    en: 'Invalid file format'
  }
};

// 生成雙語錯誤訊息
function createErrorMessage(errorKey, details = null) {
  const message = ERROR_MESSAGES[errorKey];
  if (!message) {
    return {
      zh: '未知錯誤',
      en: 'Unknown error',
      error: 'Invalid error key'
    };
  }

  const zhMessage = details ? `${message.zh}: ${details}` : message.zh;
  const enMessage = details ? `${message.en}: ${details}` : message.en;

  return {
    zh: zhMessage,
    en: enMessage,
    error: `${zhMessage} (${enMessage})`
  };
}

// 記錄錯誤到控制台
function logError(errorKey, error, details = null) {
  const errorMessage = createErrorMessage(errorKey, details);
  
  // 根據錯誤類型使用不同的日誌格式
  if (errorKey === 'TOKEN_EXPIRED') {
    console.log(`🔒 令牌過期：${errorMessage.zh}`);
    if (details) {
      console.log(`   過期時間：${details}`);
    }
  } else if (errorKey === 'TOKEN_INVALID') {
    console.log(`❌ 無效令牌：${errorMessage.zh}`);
  } else if (errorKey === 'TOKEN_MISSING') {
    console.log(`⚠️ 缺少令牌：${errorMessage.zh}`);
  } else {
    console.error(`❌ 錯誤：${errorMessage.error}`);
    if (error) {
      console.error('錯誤詳情:', error.message || error);
      if (process.env.NODE_ENV === 'development') {
        console.error('錯誤堆疊:', error.stack);
      }
    }
  }
}

// 生成API響應錯誤
function createAPIError(errorKey, statusCode = 500, details = null) {
  const errorMessage = createErrorMessage(errorKey, details);
  return {
    statusCode,
    error: errorMessage.zh,
    errorEn: errorMessage.en,
    message: errorMessage.error
  };
}

module.exports = {
  ERROR_MESSAGES,
  createErrorMessage,
  logError,
  createAPIError
};
