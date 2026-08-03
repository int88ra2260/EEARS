const crypto = require('crypto');
const { maskStudentId } = require('./piiMask');

const loginFailureBuckets = new Map();

function parseEnvBool(name, defaultValue) {
  const v = process.env[name];
  if (v == null || v === '') return defaultValue;
  return String(v).toLowerCase() === 'true' || String(v) === '1';
}

function parseEnvNumber(name, defaultValue) {
  const v = process.env[name];
  if (v == null || v === '') return defaultValue;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultValue;
}

function getConfig() {
  return {
    enabled: parseEnvBool('LOGIN_ACCOUNT_COOLDOWN_ENABLED', true),
    threshold: Math.max(1, Math.floor(parseEnvNumber('LOGIN_ACCOUNT_COOLDOWN_THRESHOLD', 5))),
    cooldownMs: Math.max(1000, parseEnvNumber('LOGIN_ACCOUNT_COOLDOWN_MINUTES', 30) * 60 * 1000),
  };
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function maskUsernameForAudit(username) {
  return maskStudentId(normalizeUsername(username));
}

function usernameHashForAudit(username) {
  const key = normalizeUsername(username);
  if (!key) return null;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function pruneExpiredBuckets(now = Date.now()) {
  const { cooldownMs } = getConfig();
  const staleMs = cooldownMs * 2;
  for (const [key, bucket] of loginFailureBuckets) {
    const lockExpired = !bucket.lockedUntil || now >= bucket.lockedUntil;
    const idleExpired = now - (bucket.lastFailedAt || 0) > staleMs;
    if (lockExpired && idleExpired && bucket.count === 0) {
      loginFailureBuckets.delete(key);
    } else if (lockExpired && bucket.lockedUntil && bucket.count > 0) {
      bucket.lockedUntil = null;
      bucket.count = 0;
      bucket.firstFailedAt = null;
    }
  }
  if (loginFailureBuckets.size > 10000) {
    for (const key of [...loginFailureBuckets.keys()].slice(0, 2000)) {
      loginFailureBuckets.delete(key);
    }
  }
}

function getBucket(key) {
  let bucket = loginFailureBuckets.get(key);
  if (!bucket) {
    bucket = {
      count: 0,
      firstFailedAt: null,
      lockedUntil: null,
      lastFailedAt: null,
    };
    loginFailureBuckets.set(key, bucket);
  }
  return bucket;
}

function isLocked(bucket, now = Date.now()) {
  if (!bucket.lockedUntil) return false;
  if (now >= bucket.lockedUntil) {
    bucket.lockedUntil = null;
    return false;
  }
  return true;
}

function retryAfterSeconds(bucket, now = Date.now()) {
  if (!bucket.lockedUntil || now >= bucket.lockedUntil) return 0;
  return Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000));
}

/**
 * @returns {{ blocked: boolean, retryAfterSeconds?: number }}
 */
function checkLoginCooldown(username) {
  const { enabled } = getConfig();
  if (!enabled) return { blocked: false };

  pruneExpiredBuckets();
  const key = normalizeUsername(username);
  if (!key) return { blocked: false };

  const bucket = loginFailureBuckets.get(key);
  if (!bucket || !isLocked(bucket)) {
    return { blocked: false };
  }

  return {
    blocked: true,
    retryAfterSeconds: retryAfterSeconds(bucket),
  };
}

/**
 * @returns {{ triggered: boolean, retryAfterSeconds?: number, failureCount: number }}
 */
function recordLoginFailure(username) {
  const { enabled, threshold, cooldownMs } = getConfig();
  if (!enabled) return { triggered: false, failureCount: 0 };

  pruneExpiredBuckets();
  const key = normalizeUsername(username);
  if (!key) return { triggered: false, failureCount: 0 };

  const now = Date.now();
  const bucket = getBucket(key);

  if (isLocked(bucket, now)) {
    return {
      triggered: false,
      failureCount: bucket.count,
      retryAfterSeconds: retryAfterSeconds(bucket, now),
      alreadyLocked: true,
    };
  }

  bucket.count += 1;
  bucket.lastFailedAt = now;
  if (!bucket.firstFailedAt) bucket.firstFailedAt = now;

  if (bucket.count >= threshold) {
    bucket.lockedUntil = now + cooldownMs;
    return {
      triggered: true,
      failureCount: bucket.count,
      retryAfterSeconds: retryAfterSeconds(bucket, now),
    };
  }

  return { triggered: false, failureCount: bucket.count };
}

function clearLoginCooldown(username) {
  const key = normalizeUsername(username);
  if (!key) return;
  loginFailureBuckets.delete(key);
}

/** 測試用：清空記憶體 bucket */
function resetLoginCooldownBucketsForTest() {
  loginFailureBuckets.clear();
}

function getLoginCooldownBucketForTest(username) {
  const key = normalizeUsername(username);
  return key ? loginFailureBuckets.get(key) || null : null;
}

module.exports = {
  normalizeUsername,
  maskUsernameForAudit,
  usernameHashForAudit,
  checkLoginCooldown,
  recordLoginFailure,
  clearLoginCooldown,
  resetLoginCooldownBucketsForTest,
  getLoginCooldownBucketForTest,
  getConfig,
};
