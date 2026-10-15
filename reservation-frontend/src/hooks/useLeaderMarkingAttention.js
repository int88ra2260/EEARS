import { useCallback, useEffect, useState } from 'react';
import { P } from '../constants/permissions';
import { fetchLeaderMarkingAttention } from '../services/etGroupingApi';
import { hasPermission } from '../utils/accessControl';

export const LEADER_MARKING_ATTENTION_EVENT = 'eears-leader-marking-attention';

export function notifyLeaderMarkingAttention() {
  window.dispatchEvent(new Event(LEADER_MARKING_ATTENTION_EVENT));
}

export default function useLeaderMarkingAttention(token, accessProfile) {
  const canMark = hasPermission(accessProfile, P.CAN_MARK_ET_SESSION_TASKS);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!token || !canMark) {
      setCount(0);
      return;
    }
    try {
      const data = await fetchLeaderMarkingAttention(token);
      setCount(Number(data?.count) || 0);
    } catch {
      setCount(0);
    }
  }, [token, canMark]);

  useEffect(() => {
    refresh();
    const onChange = () => { refresh(); };
    window.addEventListener('focus', onChange);
    window.addEventListener(LEADER_MARKING_ATTENTION_EVENT, onChange);
    return () => {
      window.removeEventListener('focus', onChange);
      window.removeEventListener(LEADER_MARKING_ATTENTION_EVENT, onChange);
    };
  }, [refresh]);

  return { count };
}
