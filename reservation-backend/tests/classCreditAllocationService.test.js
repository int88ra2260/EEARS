'use strict';

const {
  hoursForEventType,
  hoursToPoints,
  roundHours,
  roundSignedHours,
  combineClassCredit,
} = require('../utils/classCreditHours');

describe('classCreditHours', () => {
  test('ET is 0.5h before 115-1, 0.75h from 2026-08-01; club/jt/if stay 1h', () => {
    expect(hoursForEventType('english_table')).toBe(0.5);
    expect(hoursForEventType('English Table')).toBe(0.5);
    expect(hoursForEventType('ET')).toBe(0.5);
    expect(hoursForEventType('english_table', { eventDate: '2026-07-31' })).toBe(0.5);
    expect(hoursForEventType('english_table', { eventDate: '2026-08-01' })).toBe(0.75);
    expect(hoursForEventType('ET', { use45MinEnglishTable: true })).toBe(0.75);
    expect(hoursForEventType('English Table', { use45MinEnglishTable: true })).toBe(0.75);
    expect(hoursForEventType('english_club', { use45MinEnglishTable: true })).toBe(1);
    expect(hoursForEventType('job_talk')).toBe(1);
    expect(hoursForEventType('international_forum')).toBe(1);
    expect(hoursForEventType('unknown')).toBe(0);
    expect(hoursToPoints(0.75)).toBe(1.5);
  });

  test('signed adjustments add or deduct without going below a displayed zero', () => {
    expect(roundSignedHours(-0.54)).toBe(-0.54);
    expect(roundSignedHours(-0.24)).toBe(-0.24);
    expect(combineClassCredit(2, 1.5)).toMatchObject({
      allocatedHours: 2,
      adjustmentHours: 1.5,
      displayHours: 3.5,
      displayPoints: 7,
    });
    expect(combineClassCredit(1, -1.5)).toMatchObject({
      adjustmentHours: -1.5,
      effectiveHours: -0.5,
      displayHours: 0,
      displayPoints: 0,
    });
    expect(roundHours(-1)).toBe(0);
  });

  test('points = round(hours * 2)', () => {
    expect(hoursToPoints(0.5)).toBe(1);
    expect(hoursToPoints(1)).toBe(2);
    expect(hoursToPoints(2.5)).toBe(5);
    expect(roundHours(0.75)).toBe(0.75);
    expect(roundHours(1.24)).toBe(1.24);
    expect(roundHours(1.254)).toBe(1.25);
  });
});

describe('resolveAllocationStatus', () => {
  const { resolveAllocationStatus } = require('../services/classCreditAllocationService');

  test('multi-class with zero earned hours has no pending label', () => {
    expect(resolveAllocationStatus({
      classCount: 2,
      allocatedToThisClass: 0,
      totalAllocated: 0,
      locked: false,
      earnedHours: 0,
    })).toMatchObject({
      allocationStatus: 'none',
      allocationStatusLabel: null,
    });
  });

  test('multi-class with earned hours still pending before the deadline', () => {
    expect(resolveAllocationStatus({
      classCount: 2,
      allocatedToThisClass: 0,
      totalAllocated: 0,
      locked: false,
      earnedHours: 1.5,
    })).toMatchObject({
      allocationStatus: 'pending',
      allocationStatusLabel: '待配置',
    });
  });
});

describe('resolveAdjustmentHours', () => {
  const { resolveAdjustmentHours } = require('../services/classCreditAllocationService');

  test('add and deduct use a positive amount', () => {
    expect(resolveAdjustmentHours(1.5, 'add')).toBe(1.5);
    expect(resolveAdjustmentHours(-1.5, 'add')).toBe(1.5);
    expect(resolveAdjustmentHours(0.75, 'deduct')).toBe(-0.75);
    expect(() => resolveAdjustmentHours(0, 'deduct')).toThrow('時數須大於 0');
  });
});

describe('classifyReminderCandidate', () => {
  const { classifyReminderCandidate } = require('../services/classCreditAllocationService');

  test('only multi-class students with remaining hours and an email are sent', () => {
    expect(classifyReminderCandidate({
      classCount: 1, earnedHours: 2, allocatedHours: 0, email: 'a@b.com',
    })).toBe('single_class');
    expect(classifyReminderCandidate({
      classCount: 2, earnedHours: 0, allocatedHours: 0, email: 'a@b.com',
    })).toBe('no_hours');
    expect(classifyReminderCandidate({
      classCount: 2, earnedHours: 1.5, allocatedHours: 1.5, email: 'a@b.com',
    })).toBe('fully_allocated');
    expect(classifyReminderCandidate({
      classCount: 2, earnedHours: 0.75, allocatedHours: 0, email: '',
    })).toBe('no_email');
    expect(classifyReminderCandidate({
      classCount: 2, earnedHours: 0.75, allocatedHours: 0, email: 'student@example.com',
    })).toBe('send');
  });
});

describe('isPastDeadline', () => {
  const { isPastDeadline } = require('../services/classCreditAllocationService');

  test('null deadline is never locked', () => {
    expect(isPastDeadline(null)).toBe(false);
  });

  test('locks after end of deadline day Taipei', () => {
    expect(isPastDeadline('2026-06-01', new Date('2026-06-01T15:00:00+08:00'))).toBe(false);
    expect(isPastDeadline('2026-06-01', new Date('2026-06-02T00:00:01+08:00'))).toBe(true);
  });
});
