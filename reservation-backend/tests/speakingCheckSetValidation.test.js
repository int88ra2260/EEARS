const { assertPublishableSet, normalizeJoinCode, normalizeDisplayName } = require('../services/speakingCheckSetValidation');

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
});
