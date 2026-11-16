import { useCallback, useEffect, useState } from 'react';
import { P } from '../constants/permissions';
import { fetchAdminStudentFeedbackAttention } from '../services/studentFeedbackApi';
import { hasPermission } from '../utils/accessControl';

export const STUDENT_FEEDBACK_ATTENTION_EVENT = 'eears-staff-feedback-attention';
const POLL_MS = 30000;

export function notifyStudentFeedbackAttention() {
  window.dispatchEvent(new Event(STUDENT_FEEDBACK_ATTENTION_EVENT));
}

export default function useStudentFeedbackAttention(token, accessProfile) {
  const canView = hasPermission(accessProfile, P.CAN_VIEW_STUDENT_FEEDBACK);
  const [attention, setAttention] = useState({ newCount: 0, assignedCount: 0 });

  const refresh = useCallback(async () => {
    if (!token || !canView) {
      setAttention({ newCount: 0, assignedCount: 0 });
      return;
    }
    try {
      const { ok, data } = await fetchAdminStudentFeedbackAttention(token);
      if (!ok) return;
      setAttention({
        newCount: Number(data?.newCount) || 0,
        assignedCount: Number(data?.assignedCount) || 0,
      });
    } catch {
      setAttention({ newCount: 0, assignedCount: 0 });
    }
  }, [token, canView]);

  useEffect(() => {
    refresh();
    const onChange = () => {
      if (document.visibilityState === 'hidden') return;
      refresh();
    };
    const timer = window.setInterval(onChange, POLL_MS);
    window.addEventListener('focus', onChange);
    window.addEventListener(STUDENT_FEEDBACK_ATTENTION_EVENT, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onChange);
      window.removeEventListener(STUDENT_FEEDBACK_ATTENTION_EVENT, refresh);
    };
  }, [refresh]);

  const total = attention.newCount + attention.assignedCount;
  return { ...attention, total };
}
