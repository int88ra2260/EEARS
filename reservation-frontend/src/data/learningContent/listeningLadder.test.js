import {
  scoreForCorrect,
  adjustLevel,
  computeAccuracy,
  LADDER_UP_STREAK,
} from './listeningLadderScoring';
import {
  buildSoundMatchOptions,
  getListeningLadderItems,
  pickQuestion,
  maxLevel,
  countItemsByLevel,
  LISTENING_LADDER_ITEMS,
} from './listeningLadderBank';
import { LISTENING_LADDER_LEVELS } from '../../constants/learningContentTypes';

describe('listeningLadderScoring', () => {
  test('scoreForCorrect adds streak bonus at threshold', () => {
    expect(scoreForCorrect('A1', 2)).toBe(50);
    expect(scoreForCorrect('A1', 3)).toBe(70);
    expect(scoreForCorrect('B2', 3)).toBe(150);
    expect(scoreForCorrect('C1', 3)).toBe(190);
  });

  test('adjustLevel moves within A1-C1', () => {
    expect(adjustLevel('A1', 'up')).toBe('A2');
    expect(adjustLevel('B2', 'up')).toBe('C1');
    expect(adjustLevel('C1', 'up')).toBe('C1');
    expect(adjustLevel('A1', 'down')).toBe('A1');
    expect(adjustLevel('B1', 'down')).toBe('A2');
  });

  test('computeAccuracy', () => {
    expect(computeAccuracy(3, 4)).toBe(75);
    expect(computeAccuracy(0, 0)).toBe(0);
  });
});

describe('listeningLadderBank', () => {
  test('covers all ladder levels with sufficient items', () => {
    expect(LISTENING_LADDER_ITEMS).toHaveLength(152);
    LISTENING_LADDER_LEVELS.forEach((level) => {
      const n = countItemsByLevel(level);
      expect(n).toBeGreaterThanOrEqual(28);
      expect(n).toBeLessThanOrEqual(36);
    });
  });

  test('buildSoundMatchOptions returns 4 Chinese options with one correct', () => {
    const item = getListeningLadderItems({ level: 'A1' })[0];
    const options = buildSoundMatchOptions(item);
    expect(options).toHaveLength(4);
    expect(options.filter((o) => o.isCorrect)).toHaveLength(1);
    expect(options.find((o) => o.isCorrect)?.text).toBe(item.translationZh);
    options.forEach((option) => {
      expect(option.text).toMatch(/[\u4e00-\u9fff]/);
    });
  });

  test('pickQuestion excludes used ids', () => {
    const all = getListeningLadderItems({ level: 'A1' });
    const used = all.map((i) => i.id);
    const next = pickQuestion({ level: 'A1', excludeIds: used });
    expect(next).toBeTruthy();
  });

  test('maxLevel keeps highest', () => {
    expect(maxLevel('B1', 'A2')).toBe('B1');
    expect(maxLevel('A1', 'C1')).toBe('C1');
  });
});

describe('ladder constants', () => {
  test('LADDER_UP_STREAK is 2', () => {
    expect(LADDER_UP_STREAK).toBe(2);
  });
});
