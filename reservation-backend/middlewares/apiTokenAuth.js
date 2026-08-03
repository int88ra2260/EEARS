/**
 * API Token 驗證中間件
 * 支援透過環境變數設定的 API Token 進行驗證
 * 用於允許外部工具（如 Cursor Agent）呼叫 API
 */

/**
 * 建立 API Token 驗證中間件
 * @param {string} tokenEnvVar - 環境變數名稱，用於儲存 API Token
 * @param {object} options - 選項
 * @param {function} options.fallbackAuth - 當 API Token 不符時的備用驗證函數
 * @returns {function} Express 中間件
 */
function createApiTokenAuth(tokenEnvVar, options = {}) {
  return (req, res, next) => {
    const apiToken = process.env[tokenEnvVar];
    const authHeader = req.headers.authorization;

    // 調試輸出
    console.log('[apiTokenAuth] Checking:', {
      tokenEnvVar,
      hasApiToken: !!apiToken,
      apiTokenLength: apiToken ? apiToken.length : 0,
      authHeader: authHeader || 'none',
      expectedHeader: apiToken ? `Bearer ${apiToken.substring(0, 8)}...` : 'N/A',
    });

    // 檢查是否使用 API Token
    if (apiToken && authHeader === `Bearer ${apiToken}`) {
      // 設定虛擬用戶資訊
      req.user = {
        id: 0,
        username: 'cursor-agent',
        role: 'admin',
        isApiToken: true,
      };
      return next();
    }

    // 使用備用驗證
    if (options.fallbackAuth) {
      return options.fallbackAuth(req, res, next);
    }

    // 無 API Token 且無備用驗證
    return res.status(401).json({ error: '未授權的請求' });
  };
}

/**
 * 週報 API Token 驗證中間件
 * 環境變數：WEEKLY_REPORT_API_TOKEN
 */
function weeklyReportApiTokenAuth(fallbackAuth) {
  return createApiTokenAuth('WEEKLY_REPORT_API_TOKEN', { fallbackAuth });
}

module.exports = {
  createApiTokenAuth,
  weeklyReportApiTokenAuth,
};
