/**
 * 培力英檢一鍵發信。
 * 先算出收件人數並顯示信件內容，使用者按「確認並寄出」後才送出。
 */
import { useCallback, useRef, useState } from 'react';
import { previewStatusEmails, sendStatusEmails } from '../services/englishTestApi';
import { buildBatchMailPreview } from '../utils/englishTestEmailPreview';
import { isValidSemester } from '../utils/semesterUtils';

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

export function useEnglishTestEmails({ token, showToast, semester }) {
  const [sendingEmails, setSendingEmails] = useState(false);
  const [sendingEmailKind, setSendingEmailKind] = useState(null);
  const [outgoingMail, setOutgoingMail] = useState(null);
  const requestRef = useRef(0);

  const closeOutgoingMail = useCallback(() => {
    requestRef.current += 1;
    setOutgoingMail(null);
  }, []);

  const handleSendStatusEmails = useCallback((status) => {
    if (!['success', 'failed', 'group_promo'].includes(status)) return;
    if (sendingEmails) return;

    const semesterCode = String(semester || '').trim();
    if (!isValidSemester(semesterCode)) {
      showToast('請先在篩選條件指定單一學期（例如 115-1），再寄送通知信，避免寄到其他學期。', 'warning');
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setOutgoingMail({
      status,
      semester: semesterCode,
      loading: true,
      error: '',
      total: null,
      preview: buildBatchMailPreview({ kind: status, semester: semesterCode, total: null }),
    });

    previewStatusEmails(token, status, semesterCode)
      .then((data) => {
        if (requestRef.current !== requestId) return;
        const total = Number(data?.total) || 0;
        setOutgoingMail({
          status,
          semester: semesterCode,
          loading: false,
          error: '',
          total,
          preview: buildBatchMailPreview({ kind: status, semester: semesterCode, total }),
        });
      })
      .catch((error) => {
        if (requestRef.current !== requestId) return;
        setOutgoingMail({
          status,
          semester: semesterCode,
          loading: false,
          error: error.message || '無法計算收件人數',
          total: null,
          preview: buildBatchMailPreview({ kind: status, semester: semesterCode, total: null }),
        });
      });
  }, [token, showToast, sendingEmails, semester]);

  const confirmOutgoingMail = useCallback(() => {
    if (!outgoingMail || outgoingMail.loading || outgoingMail.error || !outgoingMail.total) return;
    const { status, semester: semesterCode } = outgoingMail;
    const kindLabel = EMAIL_KIND_LABEL[status] || '通知信';
    setOutgoingMail(null);
    setSendingEmails(true);
    setSendingEmailKind(status);
    void (async () => {
      try {
        const data = await sendStatusEmails(token, status, semesterCode);
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
  }, [outgoingMail, token, showToast]);

  return {
    sendingEmails,
    sendingEmailKind,
    sendingEmailLabel: sendingEmailKind ? EMAIL_KIND_LABEL[sendingEmailKind] : null,
    handleSendStatusEmails,
    outgoingMail,
    closeOutgoingMail,
    confirmOutgoingMail,
  };
}
