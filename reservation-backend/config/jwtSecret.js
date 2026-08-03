/**
 * JWT 簽章／驗證用密鑰（單一來源）。
 * - production：必須設定 JWT_SECRET，否則於載入時 throw（另由 envValidation 於啟動時 fail fast）。
 * - development / test：未設定時使用僅供本機的 fallback，並只 warn 一次。
 */

const DEV_TEST_FALLBACK =
  'EEARS_DEVELOPMENT_ONLY_JWT_SECRET_DO_NOT_USE_IN_PRODUCTION_48CHARS_MIN';

let warnedMissingSecret = false;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function resolveJwtSecretOnce() {
  const fromEnv = process.env.JWT_SECRET != null ? String(process.env.JWT_SECRET).trim() : '';
  if (fromEnv) {
    return fromEnv;
  }
  if (isProduction()) {
    throw new Error('JWT_SECRET is required in production.');
  }
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[EEARS][jwt] JWT_SECRET is not set; using a development-only fallback. ' +
        'Set JWT_SECRET in .env before any real deployment. This fallback must never be used in production.'
    );
  }
  return DEV_TEST_FALLBACK;
}

/** 與舊程式碼相容：程序啟動時解析一次 */
const secretKey = resolveJwtSecretOnce();

function getJwtSecret() {
  return secretKey;
}

module.exports = {
  secretKey,
  getJwtSecret,
};
