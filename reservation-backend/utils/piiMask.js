/**
 * PII 遮罩工具（列表／詳情 API、日誌 metadata 等）。
 * 完整身分證字號僅限 export 或伺服器內部必要流程使用。
 */

function maskIdNumber(value) {
  if (value === null || value === undefined) return value;
  const s = String(value).trim();
  if (!s) return s;
  if (s.length <= 4) return '*'.repeat(s.length);
  if (s.length <= 6) {
    return `${s.slice(0, 1)}****${s.slice(-1)}`;
  }
  return `${s.slice(0, 3)}****${s.slice(-3)}`;
}

function maskPhone(value) {
  if (value === null || value === undefined) return value;
  const s = String(value).trim();
  if (!s) return s;
  if (s.length <= 2) return '***';
  return `***${s.slice(-2)}`;
}

function maskEmail(value) {
  if (value === null || value === undefined) return value;
  const email = String(value).trim();
  if (!email) return email;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const show = Math.min(2, local.length);
  return `${local.slice(0, show)}***@${domain}`;
}

function maskStudentId(value) {
  if (value === null || value === undefined) return value;
  const s = String(value).trim();
  if (!s) return s;
  if (s.length <= 4) return '*'.repeat(s.length);
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}

module.exports = {
  maskIdNumber,
  maskPhone,
  maskEmail,
  maskStudentId,
};
