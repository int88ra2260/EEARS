/**
 * 執行長「學習有伴營運成效」未讀提示（紅點）
 * 看過一次後以 localStorage 記住，之後不再顯示。
 */

const STORAGE_PREFIX = 'eears:lp-ops-attention-seen:v1:';
export const LP_OPS_ATTENTION_EVENT = 'eears:lp-ops-attention-seen';
export const LP_OPS_ATTENTION_PATH = '/admin/english-test?tab=group&lpView=funnel';

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function getLearningPartnerOpsAttentionUserKey(accessProfile, usernameFallback = '') {
  const fromProfile = accessProfile?.username || accessProfile?.userId || accessProfile?.id;
  if (fromProfile) return String(fromProfile);
  try {
    const username = usernameFallback || localStorage.getItem('username') || '';
    if (username) return String(username);
  } catch {
    /* ignore */
  }
  return 'anonymous';
}

export function isLearningPartnerOpsAttentionAudience(accessProfile) {
  return Boolean(accessProfile?.isExecutive);
}

export function hasSeenLearningPartnerOpsAttention(userKey) {
  if (!userKey) return false;
  return safeGetItem(`${STORAGE_PREFIX}${userKey}`) === '1';
}

export function markLearningPartnerOpsAttentionSeen(userKey) {
  if (!userKey) return false;
  const ok = safeSetItem(`${STORAGE_PREFIX}${userKey}`, '1');
  if (ok && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LP_OPS_ATTENTION_EVENT, { detail: { userKey } }));
  }
  return ok;
}

export function shouldShowLearningPartnerOpsAttention(accessProfile, usernameFallback = '') {
  if (!isLearningPartnerOpsAttentionAudience(accessProfile)) return false;
  const userKey = getLearningPartnerOpsAttentionUserKey(accessProfile, usernameFallback);
  return !hasSeenLearningPartnerOpsAttention(userKey);
}
