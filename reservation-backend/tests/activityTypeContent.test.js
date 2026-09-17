'use strict';

const {
  buildActivityTypeContentSeedItems,
  usesLegacyActivityPresentation,
  activityTypeContentKey,
} = require('../utils/activityTypeContent');

describe('activityTypeContent (backend)', () => {
  test('skips legacy presentation codes', () => {
    expect(usesLegacyActivityPresentation('english_table')).toBe(true);
    expect(buildActivityTypeContentSeedItems({
      code: 'english_table',
      displayName: 'English Table',
    })).toEqual([]);
  });

  test('seeds eight fields for a custom type', () => {
    const items = buildActivityTypeContentSeedItems({
      code: 'cafe_chat',
      displayName: 'Cafe Chat',
      abbreviation: 'CC',
    });
    expect(items).toHaveLength(8);
    expect(items[0].contentKey).toBe(activityTypeContentKey('cafe_chat', 'title'));
    expect(items.every((row) => row.valueZh && row.valueEn)).toBe(true);
  });
});
