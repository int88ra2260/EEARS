import { mergeLearningResourceMiniGames } from './miniGamesCatalog';

describe('mergeLearningResourceMiniGames', () => {
  test('returns full catalog when API is empty', () => {
    const rows = mergeLearningResourceMiniGames([]);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.titleKey)).toEqual([
      'wordBridge.title',
      'listeningLadder.title',
      'vocabularyDepth.title',
      'vocabularySize.title',
    ]);
  });

  test('appends missing catalog games from partial API', () => {
    const rows = mergeLearningResourceMiniGames([
      {
        id: 1,
        titleKey: 'wordBridge.title',
        introKey: 'miniGames.wordBridgeIntro',
        tag: 'Vocabulary',
        href: '/activities/word-bridge',
        sortOrder: 0,
        isActive: true,
      },
      {
        id: 2,
        titleKey: 'listeningLadder.title',
        introKey: 'miniGames.listeningLadderIntro',
        tag: 'Listening',
        href: '/activities/games/listening-ladder',
        sortOrder: 1,
        isActive: true,
      },
    ]);

    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.titleKey === 'wordBridge.title')?.href).toBe('/practice/word-bridge');
    expect(rows.find((r) => r.titleKey === 'vocabularyDepth.title')?.href).toBe('/practice/vocabulary-depth');
    expect(rows.find((r) => r.titleKey === 'vocabularySize.title')?.href).toBe('/practice/vocabulary-size');
  });
});
