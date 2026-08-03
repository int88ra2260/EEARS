const crypto = require('crypto');

const DEFAULT_TTL_SEC = 60 * 60; // 1 hour

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET 未設定，無法產生預覽連結');
  }
  return secret;
}

function createPreviewToken(reportId, ttlSec = DEFAULT_TTL_SEC) {
  const id = Number(reportId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('無效的週報 ID');
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Number(ttlSec) || DEFAULT_TTL_SEC);
  const payload = `${id}:${exp}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 32);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyPreviewToken(token) {
  if (!token) return null;
  try {
    const decoded = Buffer.from(String(token), 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [idStr, expStr, sig] = parts;
    const id = Number(idStr);
    const exp = Number(expStr);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(exp)) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    const payload = `${id}:${exp}`;
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 32);
    if (sig !== expected) return null;
    return { id };
  } catch {
    return null;
  }
}

module.exports = {
  createPreviewToken,
  verifyPreviewToken,
  DEFAULT_TTL_SEC,
};
