/**
 * 培力英檢一鍵發信。
 */
import { useState, useCallback } from 'react';
import { sendStatusEmails } from '../services/englishTestApi';
import { getEnglishTestBatchEmailConfirm } from '../utils/englishTestStatusEmailConfirm';

export function useEnglishTestEmails({ token, openConfirm, showToast }) {
  const [sendingEmails, setSendingEmails] = useState(false);

  const handleSendStatusEmails = useCallback((status) => {
    if (!['success', 'failed', 'group_promo'].includes(status)) return;
    const dialog = getEnglishTestBatchEmailConfirm(status);

    openConfirm({
      title: dialog.title,
      message: dialog.message,
      confirmLabel: dialog.confirmLabel,
      variant: dialog.variant,
      onConfirm: async () => {
        setSendingEmails(true);
        try {
          const data = await sendStatusEmails(token, status);
          showToast(
            data.message + (data.failed > 0 ? `，${data.failed} 筆發送失敗` : ''),
            data.failed > 0 ? 'warning' : 'success'
          );
        } catch (e) {
          console.error(e);
          showToast(e.message || '發信時發生錯誤', e.isGmailLocked ? 'warning' : 'danger');
        } finally {
          setSendingEmails(false);
        }
      }
    });
  }, [token, openConfirm, showToast]);

  return {
    sendingEmails,
    handleSendStatusEmails
  };
}
