/**
 * 啟動時安全相關環境變數檢查（fail fast，不輸出 secret 內容）。
 */

function validateSecurityEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  if (isProd) {
    const jwt = process.env.JWT_SECRET != null ? String(process.env.JWT_SECRET).trim() : '';
    if (!jwt) {
      // eslint-disable-next-line no-console
      console.error('FATAL: JWT_SECRET is required in production.');
      process.exit(1);
    }
    if (jwt.length < 32) {
      // eslint-disable-next-line no-console
      console.error('FATAL: JWT_SECRET must be at least 32 characters in production.');
      process.exit(1);
    }

    const cors = process.env.CORS_ORIGINS != null ? String(process.env.CORS_ORIGINS).trim() : '';
    if (!cors) {
      // eslint-disable-next-line no-console
      console.error(
        'FATAL: CORS_ORIGINS is required in production. Set a comma-separated allowlist (e.g. https://app.example.com).'
      );
      process.exit(1);
    }
    return;
  }

  const jwt = process.env.JWT_SECRET != null ? String(process.env.JWT_SECRET).trim() : '';
  if (jwt && jwt.length < 32) {
    // eslint-disable-next-line no-console
    console.warn(
      '[EEARS][security] JWT_SECRET is shorter than 32 characters. Use at least 32 characters in production.'
    );
  }
}

module.exports = {
  validateSecurityEnv,
};
