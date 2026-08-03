// 共用 log / audit 資料遮罩與清理工具
// 目標：避免在 DB logs 中寫入敏感資訊，同時維持「可追查」的欄位可用性

const {
  maskIdNumber,
  maskPhone,
  maskEmail,
  maskStudentId,
} = require('./piiMask');

const SENSITIVE_KEYS = new Set([
  'password',
  'oldpassword',
  'newpassword',
  'temporarypassword',
  'token',
  'authorization',
  'refreshtoken',
  'jwt',
  'secret',
  'gmailpass',
  'cookie',
  'accesstoken',
  'bearertoken',
  'answersjson',
  'rawpayload',
]);

// maskEmail / maskPhone / maskIdNumber 由 piiMask.js 提供

function maskStringEdge(value, { head = 2, tail = 2, placeholder = '***' } = {}) {
  if (value === null || value === undefined) return value;
  const s = typeof value === 'string' ? value : String(value);
  if (!s) return s;
  if (s.length <= head + tail) return placeholder;
  return `${s.slice(0, head)}***${s.slice(-tail)}`;
}

function maskNationalId(value) {
  return maskIdNumber(value);
}

function maskAttachmentPath(pathLike) {
  if (!pathLike) return pathLike ?? null;
  const s = typeof pathLike === 'string' ? pathLike : String(pathLike);
  // 避免把實際檔名/路徑寫入 audit
  if (s.includes('uploads/') || s.includes('\\uploads\\') || s.includes('uploads\\')) {
    return '[upload_path]';
  }
  // 檔名（可能含個資）也做裁切
  if (s.includes('/') || s.includes('\\')) {
    return maskStringEdge(s, { head: 2, tail: 0, placeholder: 'file' });
  }
  return maskStringEdge(s, { head: 2, tail: 0, placeholder: 'file' });
}

function sanitizeErrorMessage(err) {
  if (!err) return null;
  const str = typeof err === 'string' ? err : err && err.message ? String(err.message) : String(err);

  // 遮罩 email 地址
  let masked = str.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***');

  // 遮罩疑似電話（保守：長度較短的也可能誤判；此處僅用在 error message）
  masked = masked.replace(/(\+?\d[\d\s-]{7,})/g, (m) => maskPhone(m));

  if (masked.length > 4000) return `${masked.slice(0, 4000)}…`;
  return masked;
}

function shouldRedactKey(key) {
  const lower = String(key || '').toLowerCase();
  if (SENSITIVE_KEYS.has(lower)) return true;
  if (lower.includes('password')) return true;
  if (lower.includes('token')) return true;
  if (lower === 'authorization') return true;
  // refresh / jwt / cookie 之類用上面集合覆蓋
  return false;
}

function sanitizeForAudit(value, depth = 0) {
  if (depth > 8) return '[深度過大略過]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.length > 4000) return `${value.slice(0, 200)}…(已截斷)`;
    return value;
  }

  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitizeForAudit(v, depth + 1));
  }

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const lower = k.toLowerCase();

    if (
      shouldRedactKey(k)
      || lower.includes('password')
      || lower.includes('token')
      || lower === 'answersjson'
      || lower === 'rawpayload'
    ) {
      out[k] = '[已遮罩]';
      continue;
    }

    if (
      lower === 'email'
      || lower === 'studentemail'
      || lower === 'respondentemail'
      || lower === 'contactemail'
    ) {
      out[k] = maskEmail(v);
      continue;
    }

    if (lower === 'idnumber' || lower === 'nationalid' || lower.includes('identityno') || lower.includes('national_id')) {
      out[k] = maskIdNumber(v);
      continue;
    }

    // 常見個資欄位：phone / studentId
    if (lower.includes('phone') || lower.includes('tel')) {
      out[k] = maskPhone(v);
      continue;
    }

    if (lower.includes('studentid')) {
      out[k] = maskStudentId(v);
      continue;
    }

    if (lower.includes('attachment') || lower.includes('file') || lower.includes('filename') || lower.includes('originalname') || lower.includes('path')) {
      out[k] = maskAttachmentPath(v);
      continue;
    }

    out[k] = sanitizeForAudit(v, depth + 1);
  }
  return out;
}

/** 與 sanitizeForAudit 相同；供新程式統一命名 */
const sanitizeSensitiveData = sanitizeForAudit;

module.exports = {
  maskEmail,
  maskPhone,
  maskIdNumber,
  maskNationalId,
  maskStudentId,
  maskAttachmentPath,
  sanitizeErrorMessage,
  sanitizeForAudit,
  sanitizeSensitiveData,
};

