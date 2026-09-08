/**
 * 培力英檢信箱驗證碼：是否略過全站 IP rate limit（仍保留專用 OTP 限流）。
 * 以 Settings 持久化，記憶體快取避免每次請求打 DB。
 */

const { Settings } = require('../models');

const SETTING_KEY = 'english_test_email_otp_skip_global_rate_limit';
/** 預設開啟：報名季共用 IP 時避免驗證碼被全站限流連坐 */
const DEFAULT_SKIP = true;
const CACHE_TTL_MS = 5 * 1000;

let cacheValue = DEFAULT_SKIP;
let cacheLoaded = false;
let cacheAt = 0;
let loadPromise = null;

function parseSettingBool(setting, defaultValue) {
  if (!setting) return defaultValue;
  if (setting.valueBool !== null && setting.valueBool !== undefined) {
    return setting.valueBool === true;
  }
  if (setting.value == null) return defaultValue;
  return String(setting.value).toLowerCase() === 'true';
}

async function loadFromDb() {
  try {
    const setting = await Settings.findOne({ where: { key: SETTING_KEY } });
    cacheValue = parseSettingBool(setting, DEFAULT_SKIP);
  } catch (_) {
    // DB 未就緒時維持快取／預設，不阻斷請求
    if (!cacheLoaded) cacheValue = DEFAULT_SKIP;
  }
  cacheLoaded = true;
  cacheAt = Date.now();
  return cacheValue;
}

async function ensureCache() {
  const now = Date.now();
  if (cacheLoaded && now - cacheAt < CACHE_TTL_MS) {
    return cacheValue;
  }
  if (!loadPromise) {
    loadPromise = loadFromDb().finally(() => {
      loadPromise = null;
    });
  }
  return loadPromise;
}

/** 同步讀快取（供 rate-limit skip）；必要時觸發背景刷新 */
function shouldSkipGlobalRateLimitForEnglishTestEmailOtp() {
  const now = Date.now();
  if (!cacheLoaded || now - cacheAt >= CACHE_TTL_MS) {
    void ensureCache();
  }
  return cacheValue;
}

async function getSkipGlobalForEnglishTestEmailOtp() {
  return ensureCache();
}

async function setSkipGlobalForEnglishTestEmailOtp(enabled) {
  const next = enabled === true;
  const [setting, created] = await Settings.findOrCreate({
    where: { key: SETTING_KEY },
    defaults: {
      value: String(next),
      valueBool: next,
    },
  });
  if (!created) {
    await setting.update({
      value: String(next),
      valueBool: next,
    });
  }
  cacheValue = next;
  cacheLoaded = true;
  cacheAt = Date.now();
  return next;
}

function resetCacheForTests(value = DEFAULT_SKIP) {
  cacheValue = value;
  cacheLoaded = true;
  cacheAt = Date.now();
  loadPromise = null;
}

module.exports = {
  SETTING_KEY,
  DEFAULT_SKIP,
  shouldSkipGlobalRateLimitForEnglishTestEmailOtp,
  getSkipGlobalForEnglishTestEmailOtp,
  setSkipGlobalForEnglishTestEmailOtp,
  resetCacheForTests,
  ensureCache,
};
