'use strict';

const {
  normalizeEventCapacityInput,
  resolveLegacyGroupCount,
} = require('../utils/eventCapacity');

describe('eventCapacity', () => {
  it('computes ET total from group count and per-group capacity', () => {
    const result = normalizeEventCapacityInput({
      eventType: 'English Table',
      groupCount: 6,
      perGroupCapacity: 5,
    });
    expect(result.error).toBeUndefined();
    expect(result).toEqual({
      groupCount: 6,
      perGroupCapacity: 5,
      maxCapacity: 30,
    });
  });

  it('rejects mismatched ET total', () => {
    const result = normalizeEventCapacityInput({
      eventType: 'English Table',
      groupCount: 9,
      perGroupCapacity: 4,
      maxCapacity: 30,
    });
    expect(result.error).toContain('總人數須等於組數×每組人數');
  });

  it('allows non-ET events with total only', () => {
    const result = normalizeEventCapacityInput({
      eventType: 'Job Talk',
      maxCapacity: 40,
    });
    expect(result).toEqual({
      groupCount: null,
      perGroupCapacity: null,
      maxCapacity: 40,
    });
  });

  it('lets other events use a total or grouped capacity', () => {
    expect(normalizeEventCapacityInput({
      eventType: 'other',
      maxCapacity: 25,
      capacityMode: 'simple',
    })).toEqual({
      groupCount: null,
      perGroupCapacity: null,
      maxCapacity: 25,
    });

    expect(normalizeEventCapacityInput({
      eventType: 'other',
      groupCount: 3,
      perGroupCapacity: 8,
      capacityMode: 'grouped',
    })).toEqual({
      groupCount: 3,
      perGroupCapacity: 8,
      maxCapacity: 24,
    });
  });

  it('does not let non-other types switch into grouped capacity', () => {
    expect(normalizeEventCapacityInput({
      eventType: 'job_talk',
      maxCapacity: 40,
      groupCount: 4,
      perGroupCapacity: 10,
      capacityMode: 'grouped',
    })).toEqual({
      groupCount: null,
      perGroupCapacity: null,
      maxCapacity: 40,
    });
  });

  it('falls back legacy group count to 9', () => {
    expect(resolveLegacyGroupCount({ groupCount: 7 })).toBe(7);
    expect(resolveLegacyGroupCount({})).toBe(9);
  });
});
