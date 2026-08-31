'use strict';

const { normalizeCourseKey, isLegacyCourseCode } = require('../services/learningJourney/legacyCourseDedupUtils');

describe('legacyCourseDedupUtils', () => {
  it('normalizes full-width punctuation for course matching', () => {
    expect(
      normalizeCourseKey('通過體驗式學習自信地說英語（中級）', '李香蘭')
    ).toBe(
      normalizeCourseKey('通過體驗式學習自信地說英語(中級)', '李香蘭')
    );
  });

  it('detects legacy worksheet course codes', () => {
    expect(isLegacyCourseCode('工作表1028')).toBe(true);
    expect(isLegacyCourseCode('EAP001')).toBe(false);
  });
});
