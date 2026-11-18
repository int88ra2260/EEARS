const crypto = require('crypto');

const DEFAULT_TTL_SEC = 60 * 60;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    const err = new Error('JWT_SECRET 未設定，無法產生預覽連結');
    err.status = 503;
    throw err;
  }
  return secret;
}

function createAnnouncementPreviewToken(announcementId, ttlSec = DEFAULT_TTL_SEC) {
  const id = Number(announcementId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error('無效的公告 ID');
    err.status = 400;
    throw err;
  }
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Number(ttlSec) || DEFAULT_TTL_SEC);
  const payload = `ann:${id}:${exp}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 32);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyAnnouncementPreviewToken(token) {
  if (!token) return null;
  try {
    const decoded = Buffer.from(String(token), 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4 || parts[0] !== 'ann') return null;
    const id = Number(parts[1]);
    const exp = Number(parts[2]);
    const sig = parts[3];
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(exp)) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    const payload = `ann:${id}:${exp}`;
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 32);
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return { id, exp };
  } catch {
    return null;
  }
}

module.exports = {
  createAnnouncementPreviewToken,
  verifyAnnouncementPreviewToken,
  DEFAULT_TTL_SEC,
};
