/**
 * 與後端 piiMask 規則一致的前端顯示用遮罩（後台列表／詳情）。
 */

export function maskIdNumber(value) {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (s.includes('****')) return s;
  if (s.length <= 4) return '*'.repeat(s.length);
  if (s.length <= 6) {
    return `${s.slice(0, 1)}****${s.slice(-1)}`;
  }
  return `${s.slice(0, 3)}****${s.slice(-3)}`;
}

export function displayIdNumber(registration) {
  if (!registration) return '-';
  return (
    registration.idNumberMasked
    || maskIdNumber(registration.idNumber || registration.nationalId)
    || '-'
  );
}

export function maskEmail(value) {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (s.includes('***@')) return s;
  const at = s.indexOf('@');
  if (at <= 0) return '***';
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const show = Math.min(2, local.length);
  return `${local.slice(0, show)}***@${domain}`;
}

/** 問卷填答紀錄後台顯示用 */
export function displayStudentEmail(row) {
  if (!row) return '-';
  return (
    row.studentEmailMasked
    || row.emailMasked
    || maskEmail(row.studentEmail || row.email)
    || '-'
  );
}
