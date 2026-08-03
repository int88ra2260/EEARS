'use strict';

const { shouldRunAsync } = require('../services/learningJourney/analytics/analyticRebuildJobService');

describe('analyticRebuildJobService.shouldRunAsync', () => {
  it('forces async for global scope', () => {
    expect(shouldRunAsync({ scope: 'global' })).toBe(true);
  });

  it('forces async for semester scope', () => {
    expect(shouldRunAsync({ scope: 'semester', semesterId: '115-1' })).toBe(true);
  });

  it('allows sync for small manual student list', () => {
    expect(shouldRunAsync({ scope: 'manual', studentIds: ['S001', 'S002'] })).toBe(false);
  });

  it('forces async when more than 20 students', () => {
    const studentIds = Array.from({ length: 21 }, (_, i) => `S${i}`);
    expect(shouldRunAsync({ scope: 'manual', studentIds })).toBe(true);
  });

  it('respects explicit async flag', () => {
    expect(shouldRunAsync({ async: false, scope: 'global' })).toBe(false);
    expect(shouldRunAsync({ async: true, studentIds: ['S001'] })).toBe(true);
  });
});
