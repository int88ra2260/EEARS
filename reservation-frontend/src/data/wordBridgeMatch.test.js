import {
  MATCH_MIN_PAIRS_TO_START,
  MATCH_PAIRS_PER_ROUND,
  buildB1PlusMistakeWords,
  canStartWordBridgeMatch,
  pairsToMatchCards,
  pickMatchRoundPairs,
} from './wordBridgeMatch';

describe('wordBridgeMatch', () => {
  const pool = [
    { en: 'deadline', zh: '截止日期', level: 'B1' },
    { en: 'feedback', zh: '回饋', level: 'B1' },
    { en: 'research', zh: '研究', level: 'B1' },
    { en: 'argument', zh: '論點', level: 'B1' },
    { en: 'abstract', zh: '摘要', level: 'B2' },
    { en: 'analyze', zh: '分析', level: 'B2' },
    { en: 'collaborate', zh: '合作', level: 'B2' },
    { en: 'conference', zh: '會議', level: 'B2' },
    { en: 'statistics', zh: '統計', level: 'B2' },
    { en: 'hypothesis', zh: '假設', level: 'C1' },
  ];

  test('buildB1PlusMistakeWords filters A1/A2', () => {
    const rows = buildB1PlusMistakeWords([
      { level: 'A1', reason: 'wrong_group', words: ['book', 'pen'] },
      { level: 'B1', reason: 'wrong_group', words: ['deadline', 'feedback'] },
    ]);
    expect(rows.map((row) => row.en)).toEqual(['deadline', 'feedback']);
  });

  test('canStartWordBridgeMatch requires 4 B1+ words', () => {
    expect(canStartWordBridgeMatch(pool.slice(0, 3))).toBe(false);
    expect(canStartWordBridgeMatch(pool.slice(0, 4))).toBe(true);
    expect(MATCH_MIN_PAIRS_TO_START).toBe(4);
  });

  test('pickMatchRoundPairs uses up to 8 pairs (16 cards)', () => {
    const { pairs } = pickMatchRoundPairs(pool, new Set());
    expect(pairs).toHaveLength(MATCH_PAIRS_PER_ROUND);
    expect(pairsToMatchCards(pairs)).toHaveLength(16);
  });

  test('pickMatchRoundPairs fills from mastered when few unmatched remain', () => {
    const mastered = new Set(pool.slice(0, 8).map((word) => word.en));
    const { pairs } = pickMatchRoundPairs(pool, mastered);
    expect(pairs).toHaveLength(8);
    expect(pairs.filter((word) => word.isReview).length).toBeGreaterThan(0);
    expect(pairs.some((word) => word.en === 'hypothesis')).toBe(true);
  });

  test('pickMatchRoundPairs completes when all mastered', () => {
    const mastered = new Set(pool.map((word) => word.en));
    const { complete, pairs } = pickMatchRoundPairs(pool, mastered);
    expect(complete).toBe(true);
    expect(pairs).toHaveLength(0);
  });
});
