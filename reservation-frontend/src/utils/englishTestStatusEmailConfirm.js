/**
 * 培力英檢後台：會寄信給學生的狀態變更防呆文案。
 */

export function getEnglishTestStatusEmailConfirm({ status, count = 1 } = {}) {
  const n = Number(count) || 1;
  const plural = n > 1 ? `${n} 位學生` : '該學生';

  if (status === 'revision') {
    return {
      title: '確認寄送「請修正」通知信？',
      description:
        n > 1
          ? `將把選取的 ${n} 筆改為「請修正」，並立即寄送通知信給學生。確定繼續？`
          : '將把狀態改為「請修正」，並立即寄送通知信給該學生。確定繼續？',
      confirmText: '確認並寄信',
      cancelText: '取消',
      variant: 'warning',
    };
  }

  if (status === 'failed') {
    return {
      title: '確認寄送「報名失敗」通知信？',
      description:
        n > 1
          ? `將把選取的 ${n} 筆改為「報名失敗」，並立即寄送通知信給學生。確定繼續？`
          : '將把狀態改為「報名失敗」，並立即寄送通知信給該學生。確定繼續？',
      confirmText: '確認並寄信',
      cancelText: '取消',
      variant: 'warning',
    };
  }

  return {
    title: '確認寄送通知信？',
    description: `此操作將寄送通知信給${plural}。確定繼續？`,
    confirmText: '確認並寄信',
    cancelText: '取消',
    variant: 'warning',
  };
}

export function getEnglishTestBatchEmailConfirm(status) {
  if (status === 'success') {
    return {
      title: '確認寄送通知信？',
      message: '將對目前所有「報名成功」者寄送通知信。此操作無法撤回，確定繼續？',
      confirmLabel: '確認並寄信',
      variant: 'warning',
    };
  }
  if (status === 'failed') {
    return {
      title: '確認寄送通知信？',
      message: '將對目前所有「報名失敗」者寄送通知信。此操作無法撤回，確定繼續？',
      confirmLabel: '確認並寄信',
      variant: 'warning',
    };
  }
  if (status === 'group_promo') {
    return {
      title: '確認寄送團體推廣信？',
      message: '將對所有「報名成功」且「四項皆報考」者寄送團體推廣信。此操作無法撤回，確定繼續？',
      confirmLabel: '確認並寄信',
      variant: 'warning',
    };
  }
  return {
    title: '確認寄送通知信？',
    message: '確定要寄送通知信嗎？',
    confirmLabel: '確認並寄信',
    variant: 'warning',
  };
}
