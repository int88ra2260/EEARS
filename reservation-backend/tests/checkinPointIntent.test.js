'use strict';

const { parseCheckinPointIntent } = require('../utils/checkinPointIntent');

describe('parseCheckinPointIntent', () => {
  it('defaults to class-credit check-in', () => {
    expect(parseCheckinPointIntent({})).toEqual({
      excludeFromClassCredit: false,
      countsTowardPassport: false,
    });
  });

  it('keeps passport when requested', () => {
    expect(parseCheckinPointIntent({ countsTowardPassport: true })).toEqual({
      excludeFromClassCredit: false,
      countsTowardPassport: true,
    });
  });

  it('attendance without a student card skips both passport and class credit', () => {
    expect(parseCheckinPointIntent({
      countsTowardPassport: true,
      excludeFromClassCredit: 'true',
    })).toEqual({
      excludeFromClassCredit: true,
      countsTowardPassport: false,
    });
  });
});
