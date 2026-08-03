import { buildMistakeWordRows, getWordZh } from './wordBridgeGlossary';

describe('wordBridgeGlossary', () => {
  test('getWordZh returns Traditional Chinese for theme words', () => {
    expect(getWordZh('book')).toBe('書');
    expect(getWordZh('hypothesis')).toBeTruthy();
  });

  test('buildMistakeWordRows deduplicates and preserves order', () => {
    const rows = buildMistakeWordRows([
      { level: 'A1', reason: 'wrong_group', words: ['book', 'pen', 'book'] },
      { level: 'A2', reason: 'timeout', words: [] },
      { level: 'B1', reason: 'wrong_group', words: ['deadline', 'book'] },
    ]);

    expect(rows.map((row) => row.en)).toEqual(['book', 'pen', 'deadline']);
    expect(rows[0]).toMatchObject({ en: 'book', level: 'A1', count: 3 });
    expect(rows[0].zh).toBe('書');
    expect(rows[2].zh).toBeTruthy();
  });
});
