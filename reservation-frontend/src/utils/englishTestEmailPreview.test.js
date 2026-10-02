import { buildBatchMailPreview, buildSelectedMailPreview, getEnglishTestCatalogMailPreview } from './englishTestEmailPreview';

describe('englishTestEmailPreview', () => {
  test('batch success preview names the semester, count, subject, and letter', () => {
    const preview = buildBatchMailPreview({ kind: 'success', semester: '115-1', total: 12 });
    expect(preview.audience.join(' ')).toContain('115-1');
    expect(preview.audience.join(' ')).toContain('不會寄給其他學期');
    expect(preview.audience.join(' ')).toContain('12');
    expect(preview.subject).toContain('報名成功');
    expect(preview.body).toContain('報名已確認成功');
    expect(preview.empty).toBe(false);
  });

  test('zero recipients is marked empty so confirm can stay disabled', () => {
    const preview = buildBatchMailPreview({ kind: 'failed', semester: '115-1', total: 0 });
    expect(preview.empty).toBe(true);
    expect(preview.audience.join(' ')).toContain('0 封');
  });

  test('selected revision preview includes the chosen reasons', () => {
    const preview = buildSelectedMailPreview({
      kind: 'revision',
      semester: '115-1',
      count: 3,
      reasons: ['1'],
      reasonOther: '',
    });
    expect(preview.audience.join(' ')).toContain('3');
    expect(preview.subject).toContain('請修正');
    expect(preview.body).toContain('照片五官不夠清晰');
  });

  test('catalog template preview resolves the success letter', () => {
    const preview = getEnglishTestCatalogMailPreview('englishTestRegistrationFinalSuccess');
    expect(preview.subject).toContain('報名成功');
    expect(preview.body).toContain('{{姓名}}');
  });
});
