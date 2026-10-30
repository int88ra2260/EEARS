const {
  assertPublishableSet,
  normalizeJoinCode,
  normalizeDisplayName,
  normalizeSpeakingCheckRating,
  normalizeClientFeatures,
} = require('../services/speakingCheckSetValidation');

describe('speaking check set validation', () => {
  test('rejects a single-question set', () => {
    expect(() => assertPublishableSet([
      { title: 'Library', targetText: 'The library is quiet today.' },
    ])).toThrow('至少要有 2 題');
  });

  test('keeps question order for a publishable set', () => {
    const items = assertPublishableSet([
      { title: 'One', targetText: 'Please keep your voice low.' },
      { title: '', targetText: 'You can borrow books at the front desk.' },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('One');
    expect(items[1].title).toBe('第 2 題');
  });

  test('normalizes a spaced join code and requires a display name', () => {
    expect(normalizeJoinCode('12 34-56')).toBe('123456');
    expect(() => normalizeDisplayName('   ')).toThrow('請填你的名字');
    expect(normalizeDisplayName('  Amy  ')).toBe('Amy');
  });

  test('keeps teacher ratings on a 1 to 5 scale and drops unknown pause fields', () => {
    expect(normalizeSpeakingCheckRating({
      fluency: 4,
      pronunciationIntelligibility: 3,
      taskAchievement: 5,
      comments: '  third sentence restarted  ',
    })).toMatchObject({
      fluency: 4,
      pronunciationIntelligibility: 3,
      taskAchievement: 5,
      grammar: null,
      vocabulary: null,
      rubricVersion: 'speaking-check-v1',
    });
    expect(() => normalizeSpeakingCheckRating({ fluency: 6, pronunciationIntelligibility: 3, taskAchievement: 5 })).toThrow('1 到 5');
    expect(normalizeClientFeatures('{"pauseCount":2,"secret":"no"}')).toEqual({ pauseCount: 2 });
  });
});
