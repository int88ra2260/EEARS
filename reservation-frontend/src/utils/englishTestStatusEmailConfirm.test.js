import {
  getEnglishTestStatusEmailConfirm,
  getEnglishTestBatchEmailConfirm,
} from './englishTestStatusEmailConfirm';

describe('englishTestStatusEmailConfirm', () => {
  test('revision/failed include email wording', () => {
    const revision = getEnglishTestStatusEmailConfirm({ status: 'revision', count: 2, semester: '115-1' });
    expect(revision.description).toContain('115-1');
    expect(revision.description).toContain('不會寄給其他學期');
    expect(revision.title).toContain('請修正');
    expect(revision.description).toContain('寄送通知信');
    expect(revision.confirmText).toBe('確認並寄信');

    const failedBulk = getEnglishTestStatusEmailConfirm({ status: 'failed', count: 3 });
    expect(failedBulk.description).toContain('3 筆');
    expect(failedBulk.description).toContain('寄送通知信');
  });

  test('batch send confirms mention irreversibility and wait hint', () => {
    const success = getEnglishTestBatchEmailConfirm('success', '115-1');
    expect(success.message).toContain('報名成功');
    expect(success.message).toContain('115-1');
    expect(success.message).toContain('不會寄給其他學期');
    expect(success.message).toContain('無法撤回');
    expect(success.message).toContain('寄送中');
    expect(success.confirmLabel).toBe('確認並寄信');

    const group = getEnglishTestBatchEmailConfirm('group_promo');
    expect(group.title).toContain('團體推廣');
    expect(group.message).toContain('寄送中');
  });
});
