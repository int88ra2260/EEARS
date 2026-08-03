// utils/errorHandler.js - 前端統一的錯誤處理工具

// 錯誤訊息映射
const ERROR_MESSAGES = {
  // 網路相關錯誤
  NETWORK_ERROR: {
    zh: '網路異常，請檢查連線',
    en: 'Network connection error, please check your internet connection'
  },
  SERVER_ERROR: {
    zh: '伺服器錯誤，請稍後再試',
    en: 'Server error, please try again later'
  },
  TIMEOUT_ERROR: {
    zh: '請求超時，請稍後重試（必要時可重新整理頁面）',
    en: 'Request timeout, please try again later'
  },
  
  // 認證相關錯誤
  UNAUTHORIZED: {
    zh: '未授權，請重新登入',
    en: 'Unauthorized, please login again'
  },
  FORBIDDEN: {
    zh: '無權限',
    en: 'Insufficient permissions'
  },
  
  // 驗證相關錯誤
  VALIDATION_ERROR: {
    zh: '請求資料錯誤',
    en: 'Input validation error'
  },
  REQUIRED_FIELD: {
    zh: '請填寫所有必填欄位',
    en: 'Please fill in all required fields'
  },
  INVALID_FORMAT: {
    zh: '格式不正確',
    en: 'Invalid format'
  },
  
  // 業務邏輯錯誤
  EVENT_NOT_FOUND: {
    zh: '找不到資料',
    en: 'Data not found'
  },
  EVENT_FULL: {
    zh: '活動名額已滿',
    en: 'Event is full'
  },
  ALREADY_RESERVED: {
    zh: '您已預約此活動',
    en: 'You have already reserved this event'
  },
  BLACKLISTED: {
    zh: '您的帳號已被列入黑名單',
    en: 'Your account has been blacklisted'
  },
  SURVEY_REQUIRED: {
    zh: '請先完成問卷調查',
    en: 'Please complete the survey first'
  },
  
  // 系統錯誤
  UNKNOWN_ERROR: {
    zh: '未知錯誤',
    en: 'Unknown error'
  },
  LOADING_ERROR: {
    zh: '載入失敗',
    en: 'Loading failed'
  }
};

// 生成雙語錯誤訊息
export function createErrorMessage(errorKey, details = null) {
  const message = ERROR_MESSAGES[errorKey] || ERROR_MESSAGES.UNKNOWN_ERROR;
  const zhMessage = details ? `${message.zh}: ${details}` : message.zh;
  const enMessage = details ? `${message.en}: ${details}` : message.en;
  
  return {
    zh: zhMessage,
    en: enMessage,
    display: `${zhMessage} (${enMessage})`
  };
}

// 處理API錯誤響應
export function handleAPIError(error, response = null) {
  console.error('❌ API錯誤:', error);

  const requestId =
    error?.requestId ||
    response?.requestId ||
    response?.headers?.get?.('x-request-id') ||
    response?.headers?.get?.('X-Request-Id') ||
    error?.apiError?.requestId ||
    null;

  const finalize = (msg) => {
    if (!requestId) return msg;
    return {
      ...msg,
      display: `${msg.display}（錯誤識別碼：${requestId}）`,
      zh: `${msg.zh}（錯誤識別碼：${requestId}）`,
    };
  };
  
  // 網路錯誤
  if (!navigator.onLine) {
    return finalize(createErrorMessage('NETWORK_ERROR'));
  }
  
  // 請求超時
  if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
    return finalize(createErrorMessage('TIMEOUT_ERROR'));
  }
  
  // 沒有響應
  if (!response) {
    // 若 error 物件已附帶狀態與資料（例如 fetch/axios 的封裝），嘗試依此分類
    if (error?.status && (error?.apiError || error?.data || error?.response?.data)) {
      const inferredResponse = {
        status: error.status,
        data: error.apiError || error.data || error.response?.data || {},
        requestId,
      };
      return handleAPIError(null, inferredResponse);
    }
    return finalize(createErrorMessage('NETWORK_ERROR'));
  }
  
  // 安全地處理 response.data
  const responseData = response?.data || {};
  
  // 根據HTTP狀態碼處理
  switch (response.status) {
    case 400:
      return finalize(createErrorMessage('VALIDATION_ERROR'));
    case 401:
      if (responseData?.code === 'ACCESS_PROFILE_STALE') {
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          localStorage.removeItem('username');
          localStorage.removeItem('teacherName');
          localStorage.removeItem('mustResetPassword');
          window.dispatchEvent(new CustomEvent('eears:access-stale', { detail: responseData }));
        } catch (_) {
          // ignore
        }
        return finalize(createErrorMessage('UNAUTHORIZED', '你的權限已更新，請重新登入'));
      }
      return finalize(createErrorMessage('UNAUTHORIZED'));
    case 403:
      return finalize(createErrorMessage('FORBIDDEN'));
    case 404:
      return finalize(createErrorMessage('EVENT_NOT_FOUND'));
    case 409:
      // 409 可能是問卷必填或其他衝突，由調用者處理
      return finalize(createErrorMessage('ALREADY_RESERVED'));
    case 429:
      return finalize(createErrorMessage('TIMEOUT_ERROR', '請求過於頻繁'));
    case 500:
    case 502:
    case 503:
    case 504:
      return finalize(createErrorMessage('SERVER_ERROR'));
    default:
      return finalize(createErrorMessage('UNKNOWN_ERROR'));
  }
}

// 顯示錯誤訊息給用戶
export function showErrorMessage(error, container = null) {
  const errorMsg = typeof error === 'string' ? error : error.display || error.zh || '未知錯誤';
  
  console.error('顯示錯誤訊息:', errorMsg);
  
  if (container) {
    // 在指定容器中顯示錯誤
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <strong>錯誤：</strong>${errorMsg}
      </div>
    `;
  } else {
    // Phase 1：改為全站統一互動層（ToastProvider）事件橋接，避免 window.alert
    try {
      window.dispatchEvent(new CustomEvent('eears:toast', { detail: { message: `錯誤：${errorMsg}`, variant: 'danger' } }));
    } catch (_) {
      // fallback：不要阻斷原流程
      console.error(`錯誤：${errorMsg}`);
    }
  }
}

// 顯示成功訊息給用戶
export function showSuccessMessage(message, container = null) {
  const successMsg = typeof message === 'string' ? message : message.zh || '操作成功';
  
  console.log('顯示成功訊息:', successMsg);
  
  if (container) {
    // 在指定容器中顯示成功訊息
    container.innerHTML = `
      <div class="alert alert-success" role="alert">
        <strong>成功：</strong>${successMsg}
      </div>
    `;
  } else {
    // Phase 1：改為全站統一互動層（ToastProvider）事件橋接，避免 window.alert
    try {
      window.dispatchEvent(new CustomEvent('eears:toast', { detail: { message: `成功：${successMsg}`, variant: 'success' } }));
    } catch (_) {
      console.log(`成功：${successMsg}`);
    }
  }
}

// 安全的API調用包裝器
export async function safeAPICall(apiFunction, errorHandler = null) {
  try {
    const result = await apiFunction();
    return { success: true, data: result };
  } catch (error) {
    console.error('API調用失敗:', error);
    
    const errorMessage = handleAPIError(error, error.response);
    
    if (errorHandler) {
      errorHandler(errorMessage);
    } else {
      showErrorMessage(errorMessage);
    }
    
    return { success: false, error: errorMessage };
  }
}

// 帶有令牌過期處理的API調用
export async function authenticatedAPICall(url, options = {}, onTokenExpired = null) {
  try {
    const response = await fetch(url, options);
    
    // 檢查是否為認證錯誤
    if (response.status === 401 || response.status === 403) {
      const data = await response.json().catch(() => ({}));
      
      // 檢查是否為令牌過期
      if (data.error && (data.error.includes('expired') || data.error.includes('過期'))) {
        if (onTokenExpired) {
          onTokenExpired();
        } else {
          // 預設處理：顯示友好訊息並跳轉到登入頁面（用 toast 取代 alert）
          try {
            window.dispatchEvent(new CustomEvent('eears:toast', { detail: { message: '登入已過期，請重新登入', variant: 'warning' } }));
          } catch (_) {}
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          localStorage.removeItem('username');
          window.location.href = '/login';
        }
        return { success: false, error: 'TOKEN_EXPIRED' };
      }
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || errorData.message || 'API request failed');
      error.response = response;
      error.data = errorData;
      error.status = response.status;
      throw error;
    }
    
    const data = await response.json().catch(() => null);
    return { success: true, data };
  } catch (error) {
    console.error('認證API調用失敗:', error);
    return { success: false, error };
  }
}

// 表單驗證錯誤處理
export function handleValidationError(validationResult, setError = null) {
  if (!validationResult.isValid) {
    const errorMessage = validationResult.errors.join(', ');
    
    if (setError) {
      setError(errorMessage);
    } else {
      showErrorMessage(createErrorMessage('VALIDATION_ERROR', errorMessage));
    }
    
    return false;
  }
  return true;
}

// 載入狀態管理
export function withLoadingState(asyncFunction, setLoading = null) {
  return async (...args) => {
    try {
      if (setLoading) setLoading(true);
      const result = await asyncFunction(...args);
      return result;
    } catch (error) {
      throw error;
    } finally {
      if (setLoading) setLoading(false);
    }
  };
}

const errorHandler = {
  createErrorMessage,
  handleAPIError,
  showErrorMessage,
  showSuccessMessage,
  safeAPICall,
  authenticatedAPICall,
  handleValidationError,
  withLoadingState
};

export default errorHandler;
