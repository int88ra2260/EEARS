'use strict';

function hasCjk(str) {
  return /[\u3400-\u9FFF]/.test(String(str || ''));
}

function mojibakeScore(str) {
  const s = String(str || '');
  const matches = s.match(/[ÃÂâåäæçèéêëïîôöùûüÿœÐÑÞð]/g);
  return matches ? matches.length : 0;
}

function looksLikeMojibake(name) {
  const raw = String(name || '');
  if (!raw) return false;
  if (hasCjk(raw)) return false;
  return mojibakeScore(raw) >= 2 || /[ÃÂâœðŸ�]/.test(raw);
}

function safeNormalizeFilename(originalname) {
  const raw = String(originalname || '').trim();
  if (!raw) return '';
  if (!looksLikeMojibake(raw)) return raw;
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8').trim();
    if (!decoded) return raw;
    if (decoded.includes('\uFFFD')) return raw;
    if (hasCjk(decoded)) return decoded;
    if (mojibakeScore(decoded) < mojibakeScore(raw) && !looksLikeMojibake(decoded)) {
      return decoded;
    }
    return raw;
  } catch (_) {
    return raw;
  }
}

module.exports = {
  safeNormalizeFilename
};
