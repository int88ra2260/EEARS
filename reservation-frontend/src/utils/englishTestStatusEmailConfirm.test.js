import {
  getEnglishTestStatusEmailConfirm,
  getEnglishTestBatchEmailConfirm,
} from './englishTestStatusEmailConfirm';

describe('englishTestStatusEmailConfirm', () => {
  test('revision/failed include email wording', () => {
    const revision = getEnglishTestStatusEmailConfirm({ status: 'revision', count: 1 });
    expect(revision.title).toContain('請修正');
    expect(revision.description).toContain('寄送通知信');
    expect(revision.confirmText).toBe('確認並寄信');

    const failedBulk = getEnglishTestStatusEmailConfirm({ status: 'failed', count: 3 });
    expect(failedBulk.description).toContain('3 筆');
    expect(failedBulk.description).toContain('寄送通知信');
  });

  test('batch send confirms mention irreversibility', () => {
    const success = getEnglishTestBatchEmailConfirm('success');
    expect(success.message).toContain('報名成功');
    expect(success.message).toContain('無法撤回');
    expect(success.confirmLabel).toBe('確認並寄信');

    const group = getEnglishTestBatchEmailConfirm('group_promo');
    expect(group.title).toContain('團體推廣');
  });
});
