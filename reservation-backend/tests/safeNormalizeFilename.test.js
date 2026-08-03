'use strict';

const { safeNormalizeFilename } = require('../services/learningJourney/utils/safeNormalizeFilename');

describe('safeNormalizeFilename', () => {
  test('保留原本正常中文檔名', () => {
    expect(safeNormalizeFilename('考試成績範例.xlsx')).toBe('考試成績範例.xlsx');
  });

  test('疑似 mojibake 時嘗試 latin1->utf8 還原', () => {
    const mojibake = Buffer.from('考試成績範例.xlsx', 'utf8').toString('latin1');
    expect(safeNormalizeFilename(mojibake)).toBe('考試成績範例.xlsx');
  });

  test('支援常見 å/æ 類亂碼檔名還原', () => {
    const src = '在校生名冊-測試.xlsx';
    const mojibake = Buffer.from(src, 'utf8').toString('latin1');
    expect(safeNormalizeFilename(mojibake)).toBe(src);
  });
});
