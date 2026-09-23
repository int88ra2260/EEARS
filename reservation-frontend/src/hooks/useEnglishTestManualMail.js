/**
 * 培力英檢指定寄信：勾選學生後選郵件設定範本、自訂範本，或本次貼上。
 */
import { useCallback, useState } from 'react';
import { sendSelectedEmails } from '../services/englishTestApi';

export function useEnglishTestManualMail({ token, showToast }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState('send');
  const [sending, setSending] = useState(false);

  const openPanel = useCallback((next) => {
    setPanel(next || 'send');
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    if (sending) return;
    setOpen(false);
  }, [sending]);

  const sendSelected = useCallback(async (payload) => {
    setSending(true);
    try {
      const data = await sendSelectedEmails(token, payload);
      const failed = Number(data?.failed) || 0;
      showToast(data?.message || '寄送完成', failed > 0 ? 'warning' : 'success', { duration: 12000 });
      return data;
    } catch (error) {
      showToast(error.message || '寄信時發生錯誤', error.isGmailLocked ? 'warning' : 'danger', {
        duration: 10000,
      });
      throw error;
    } finally {
      setSending(false);
    }
  }, [token, showToast]);

  return {
    open,
    panel,
    setPanel,
    sending,
    openPanel,
    close,
    sendSelected,
  };
}
