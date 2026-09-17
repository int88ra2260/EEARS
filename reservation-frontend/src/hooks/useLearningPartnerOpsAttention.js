import { useCallback, useEffect, useState } from 'react';
import {
  getLearningPartnerOpsAttentionUserKey,
  LP_OPS_ATTENTION_EVENT,
  markLearningPartnerOpsAttentionSeen,
  shouldShowLearningPartnerOpsAttention,
} from '../utils/learningPartnerOpsAttention';

/**
 * 執行長營運成效未讀紅點狀態。
 */
export default function useLearningPartnerOpsAttention(accessProfile, usernameFallback = '') {
  const [showAttention, setShowAttention] = useState(() => (
    shouldShowLearningPartnerOpsAttention(accessProfile, usernameFallback)
  ));

  useEffect(() => {
    const sync = () => {
      setShowAttention(shouldShowLearningPartnerOpsAttention(accessProfile, usernameFallback));
    };
    sync();
    window.addEventListener(LP_OPS_ATTENTION_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(LP_OPS_ATTENTION_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [accessProfile, usernameFallback]);

  const markSeen = useCallback(() => {
    const userKey = getLearningPartnerOpsAttentionUserKey(accessProfile, usernameFallback);
    markLearningPartnerOpsAttentionSeen(userKey);
    setShowAttention(false);
  }, [accessProfile, usernameFallback]);

  return { showAttention, markSeen };
}
