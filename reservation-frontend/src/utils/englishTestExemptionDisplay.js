/**
 * 培力英檢抵免審核（學生端顯示用）— 與後端 exemptionUtils / 管理端標籤對齊
 */

function nonEmpty(v) {
  return v != null && String(v).trim() !== '';
}

/** 是否有填寫 B2 成績（與後端 hasB2ScoresFilled 一致） */
export function hasB2ScoresFilled(reg) {
  if (!reg) return false;
  const hasCEFRB2 = String(reg.hasCEFRB2 || '').trim();
  const hasB2Qualified =
    hasCEFRB2 === '是'
    || hasCEFRB2.toLowerCase() === 'yes'
    || hasCEFRB2.toLowerCase() === 'true';
  if (!hasB2Qualified) return false;
  return [
    reg.listeningScore,
    reg.readingScore,
    reg.speakingScore,
    reg.writingScore,
  ].some((s) => nonEmpty(s));
}

export function mapExemptionReviewStatusToLabel(status) {
  if (status == null || status === '') return '未審核';
  const m = {
    pending: '審核中',
    approved: '已通過',
    rejected: '已拒絕',
    revision: '退回修正',
  };
  return m[status] || String(status);
}

export function mapExemptionVerifiedTypeToZh(code) {
  if (!code || code === 'NONE') return '無';
  const m = {
    LRSW: '聽讀說寫',
    LR: '聽讀',
    SW: '說寫',
    NONE: '無',
  };
  return m[code] || '無';
}

export function getExemptionReviewBadgeVariant(status) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'revision') return 'warning';
  if (status === 'pending') return 'info';
  return 'secondary';
}
