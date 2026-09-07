import { parseAnnouncementBodyBlocks } from './parseAnnouncementBodyBlocks';

describe('parseAnnouncementBodyBlocks', () => {
  test('splits decision and changelog sections', () => {
    const raw = [
      '各位同學好：',
      '',
      '目前相關問題皆已修復。',
      '',
      '【請依下列情況處理】',
      '• 已成功提交報名：無須重填。',
      '• 提交失敗：請重新進入報名流程。',
      '',
      '【本次已修復項目】',
      '1. 報名表單題目順序',
      '2. 通訊地址預填',
      '',
      '全英語卓越教學中心　敬啟',
    ].join('\n');

    const blocks = parseAnnouncementBodyBlocks(raw);
    expect(blocks.map((b) => b.type)).toEqual([
      'paragraphs',
      'paragraphs',
      'decision',
      'changelog',
      'paragraphs',
    ]);
    expect(blocks[2].items).toEqual([
      { caseLabel: '已成功提交報名', actionText: '無須重填。' },
      { caseLabel: '提交失敗', actionText: '請重新進入報名流程。' },
    ]);
    expect(blocks[3].items).toEqual(['報名表單題目順序', '通訊地址預填']);
  });

  test('falls back to paragraphs when no special headings', () => {
    const blocks = parseAnnouncementBodyBlocks('你好\n\n第二段');
    expect(blocks).toEqual([
      { type: 'paragraphs', text: '你好' },
      { type: 'paragraphs', text: '第二段' },
    ]);
  });
});
