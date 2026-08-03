/**
 * 培力英檢一鍵發信。
 */
import { useState, useCallback } from 'react';
import { sendStatusEmails } from '../services/englishTestApi';

export function useEnglishTestEmails({ token, openConfirm, showToast }) {
  const [sendingEmails, setSendingEmails] = useState(false);

  const handleSendStatusEmails = useCallback((status) => {
    if (!['success', 'failed', 'group_promo'].includes(status)) return;
    const msg = status === 'success'
      ? '確定要對所有「報名成功」者發送通知信嗎？'
      : status === 'failed'
        ? '確定要對所有「報名失敗」者發送通知信嗎？'
        : '確定要對所有「報名成功」且「四項皆報考」者發送團體推廣信嗎？';

    openConfirm({
      title: '確認發送信件',
      message: msg,
      confirmLabel: '發送',
      variant: 'primary',
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
