'use strict';

const {
  toBool,
  GRANT_STATUS,
  RULE_CODE,
  MAX_TIMES,
} = require('../services/englishLearningPassport/eventPassportPointsService');
const { RULE_CODES } = require('../services/englishLearningPassport/constants');

describe('eventPassportPointsService', () => {
  it('使用 SELF_LEARNING_ACTIVITY 規則且上限 12 次', () => {
    expect(RULE_CODE).toBe(RULE_CODES.SELF_LEARNING_ACTIVITY);
    expect(MAX_TIMES).toBe(12);
  });

  it('toBool 正確解析勾選值', () => {
    expect(toBool(true)).toBe(true);
    expect(toBool('true')).toBe(true);
    expect(toBool(1)).toBe(true);
    expect(toBool('1')).toBe(true);
    expect(toBool(false)).toBe(false);
    expect(toBool('false')).toBe(false);
    expect(toBool(0)).toBe(false);
    expect(toBool(null)).toBe(false);
  });

  it('GRANT_STATUS 含 pending / granted / blocked_limit', () => {
    expect(GRANT_STATUS.PENDING).toBe('pending');
    expect(GRANT_STATUS.GRANTED).toBe('granted');
    expect(GRANT_STATUS.BLOCKED_LIMIT).toBe('blocked_limit');
  });
});
