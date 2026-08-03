'use strict';

const { EVENT_STATUS } = require('../constants/learningJourneyEventConstants');
const {
  assertEventQuality,
  assertExamDeltaPair,
  assertBeforeExposure,
} = require('../services/learningJourney/utils/eventQualityAssertions');

describe('eventQualityAssertions', () => {
  it('flags registered_no_score with non-null score', () => {
    const issues = assertEventQuality({
      event_date: '2025-01-01',
      status: EVENT_STATUS.REGISTERED_NO_SCORE,
      raw_score: 400,
      sem_index: 1,
    });
    expect(issues.some((i) => i.code === 'REGISTERED_NO_SCORE_MUST_BE_NULL')).toBe(true);
  });

  it('rejects cross instrument delta', () => {
    const issues = assertExamDeltaPair(
      { instrument: 'TOEIC', skill: 'listening' },
      { instrument: 'BESTEP', skill: 'listening' }
    );
    expect(issues.some((i) => i.code === 'CROSS_INSTRUMENT_DELTA')).toBe(true);
  });

  it('before exposure is strict less than exam date', () => {
    expect(assertBeforeExposure('2025-06-01', '2025-05-31')).toBe(true);
    expect(assertBeforeExposure('2025-06-01', '2025-06-01')).toBe(false);
    expect(assertBeforeExposure('2025-06-01', '2025-06-02')).toBe(false);
  });
});
