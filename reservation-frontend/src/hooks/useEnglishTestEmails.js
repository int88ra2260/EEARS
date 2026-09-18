/**
 * 培力英檢一鍵發信。
 * 確認後立即關閉對話框，改以頁面「寄送中」橫幅回饋；完成後再以較長 toast 顯示結果。
 */
import { useState, useCallback } from 'react';
import { sendStatusEmails } from '../services/englishTestApi';
import { getEnglishTestBatchEmailConfirm } from '../utils/englishTestStatusEmailConfirm';

const EMAIL_KIND_LABEL = {
  success: '報名成功信',
  failed: '報名失敗信',
  group_promo: '團體推廣信',
};

function formatBatchEmailResult(data) {
  const sent = Number(data?.sent) || 0;
  const failed = Number(data?.failed) || 0;
  const total = data?.total != null ? Number(data.total) : sent + failed;
  const base = data?.message || '寄送完成';

  if (total <= 0) return base;

  if (failed > 0) {
    return `${base}（成功 ${sent}／共 ${total}，失敗 ${failed}）`;
  }
  return `${base}（成功 ${sent}／共 ${total}）`;
}

export function useEnglishTestEmails({ token, openConfirm, showToast }) {
  const [sendingEmails, setSendingEmails] = useState(false);
  const [sendingEmailKind, setSendingEmailKind] = useState(null);

  const handleSendStatusEmails = useCallback((status) => {
    if (!['success', 'failed', 'group_promo'].includes(status)) return;
    if (sendingEmails) return;

    const dialog = getEnglishTestBatchEmailConfirm(status);
    const kindLabel = EMAIL_KIND_LABEL[status] || '通知信';

    openConfirm({
      title: dialog.title,
      message: dialog.message,
      confirmLabel: dialog.confirmLabel,
      variant: dialog.variant,
      // 不 await 整批寄信：讓確認框立刻關閉，避免使用者以為卡住
      onConfirm: () => {
        void (async () => {
          setSendingEmails(true);
          setSendingEmailKind(status);
          try {
            const data = await sendStatusEmails(token, status);
            const failed = Number(data?.failed) || 0;
            showToast(formatBatchEmailResult(data), failed > 0 ? 'warning' : 'success', {
              duration: 12000,
            });
          } catch (e) {
            console.error(e);
            showToast(
              e.message || `寄送${kindLabel}時發生錯誤`,
              e.isGmailLocked ? 'warning' : 'danger',
              { duration: 10000 },
            );
          } finally {
            setSendingEmails(false);
            setSendingEmailKind(null);
          }
        })();
      },
    });
  }, [token, openConfirm, showToast, sendingEmails]);

  return {
    sendingEmails,
    sendingEmailKind,
    sendingEmailLabel: sendingEmailKind ? EMAIL_KIND_LABEL[sendingEmailKind] : null,
    handleSendStatusEmails,
  };
}
