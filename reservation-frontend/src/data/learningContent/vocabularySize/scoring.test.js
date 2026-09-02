import {
  computeVocabularySizeResult,
  estimateVocabularySize,
  mapSizeToCefr,
} from './scoring';
import { buildVocabularySizeDeck } from './sampling';
import { validateFrequencyBank } from './frequencyBank';

describe('vocabularySize scoring', () => {
  beforeAll(() => {
    validateFrequencyBank();
  });

  test('frequency bank meets minimum size', () => {
    validateFrequencyBank();
  });

  test('estimateVocabularySize extrapolates from band recognition', () => {
    const bandStats = [
      { band: 1, known: 5, sampled: 5 },
      { band: 2, known: 4, sampled: 5 },
      ...Array.from({ length: 8 }, (_, i) => ({ band: i + 3, known: 0, sampled: 5 })),
    ];
    const size = estimateVocabularySize(bandStats);
    expect(size).toBe(1800);
  });

  test('mapSizeToCefr maps thresholds', () => {
    expect(mapSizeToCefr(800)).toBe('A1');
    expect(mapSizeToCefr(1500)).toBe('A2');
    expect(mapSizeToCefr(2800)).toBe('B1');
    expect(mapSizeToCefr(9000)).toBe('C2');
  });

  test('computeVocabularySizeResult', () => {
    const answerLog = [
      { word: 'hello', band: 1, known: true },
      { word: 'book', band: 1, known: true },
      { word: 'water', band: 1, known: false },
      { word: 'friend', band: 1, known: true },
      { word: 'school', band: 1, known: true },
    ];
    const result = computeVocabularySizeResult({
      traceId: 'vs_test',
      durationMs: 120000,
      answerLog,
      totalKnown: 4,
      totalSampled: 5,
    });
    expect(result.estimatedWords).toBeGreaterThan(0);
    expect(result.estimatedLevel).toBeTruthy();
    expect(result.recognitionRate).toBe(0.8);
    expect(result.bandStats).toHaveLength(10);
  });

  test('buildVocabularySizeDeck has 50 unique words', () => {
    const deck = buildVocabularySizeDeck();
    expect(deck).toHaveLength(50);
    const words = new Set(deck.map((d) => d.word));
    expect(words.size).toBe(50);
  });
});
