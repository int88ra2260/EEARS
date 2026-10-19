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

describe('classifyCreditCheckin', () => {
  const {
    classifyCreditCheckin,
    mapCreditCheckinRow,
    mapEwlCreditRow,
    collectEwlCreditRecords,
  } = require('../services/classCreditAllocationService');

  test('checked-in English Table from 115-1 counts 0.75 hours', () => {
    expect(classifyCreditCheckin({
      eventType: 'english_table',
      eventDate: '2026-09-15',
      countsTowardPassport: 0,
      excludeFromClassCredit: 0,
    })).toMatchObject({
      hours: 0.75,
      rawHours: 0.75,
      creditStatus: 'counted',
      creditStatusLabel: '計入時數',
    });
  });

  test('passport check-in does not count toward class hours', () => {
    expect(classifyCreditCheckin({
      eventType: 'english_club',
      eventDate: '2026-09-15',
      countsTowardPassport: 1,
      excludeFromClassCredit: false,
    })).toMatchObject({
      hours: 0,
      rawHours: 1,
      creditStatus: 'passport',
      creditStatusLabel: '計入護照',
    });
  });

  test('no-credit attendance and unknown types do not count', () => {
    expect(classifyCreditCheckin({
      eventType: 'job_talk',
      eventDate: '2026-09-15',
      countsTowardPassport: '0',
      excludeFromClassCredit: '1',
    })).toMatchObject({
      hours: 0,
      rawHours: 1,
      creditStatus: 'excluded',
    });
    expect(classifyCreditCheckin({
      eventType: 'workshop',
      eventDate: '2026-09-15',
    })).toMatchObject({
      hours: 0,
      rawHours: 0,
      creditStatus: 'zero',
    });
  });

  test('maps a check-in row for the admin lookup', () => {
    expect(mapCreditCheckinRow({
      reservationId: 12,
      eventId: 8,
      eventName: 'English Table A',
      eventDate: '2026-09-15',
      startTime: '12:10:00',
      eventType: 'english_table',
      countsTowardPassport: 0,
      excludeFromClassCredit: 0,
    })).toMatchObject({
      reservationId: 12,
      eventName: 'English Table A',
      eventDate: '2026-09-15',
      startTime: '12:10',
      hours: 0.75,
      points: 1.5,
      creditStatus: 'counted',
    });
  });

  test('attended writing-workshop sessions use the actual duration as class points', () => {
    const range = { start: '2026-08-01', end: '2027-01-31' };
    const records = collectEwlCreditRecords([
      {
        id: 9,
        activityType: 'EWL',
        attendanceStatus: 'attended',
        eventId: 'ewl-501',
        metaJson: {
          eventName: '線上一對一諮詢',
          eventDate: '2026-09-24',
          startTime: '14:00',
          endTime: '15:00',
        },
      },
      {
        id: 10,
        activityType: 'EWL',
        attendanceStatus: 'registered',
        eventId: 'ewl-502',
        metaJson: {
          eventName: '線上一對一諮詢',
          eventDate: '2026-09-25',
          startTime: '14:00',
          endTime: '15:00',
        },
      },
      {
        id: 11,
        activityType: 'ET',
        attendanceStatus: 'attended',
        metaJson: { eventDate: '2026-09-24', hours: 1 },
      },
      {
        id: 12,
        activityType: 'EWL',
        attendanceStatus: 'attended',
        metaJson: {
          eventName: '工作坊',
          eventDate: '2026-07-01',
          startTime: '10:00',
          endTime: '12:00',
        },
      },
    ], range);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      reservationId: 'ewl:9',
      eventName: '線上一對一諮詢',
      eventDate: '2026-09-24',
      startTime: '14:00',
      eventType: 'EWL',
      hours: 1,
      points: 2,
      creditStatus: 'counted',
    });
    expect(mapEwlCreditRow({
      id: 13,
      activityType: 'EWL',
      attendanceStatus: 'attended',
      metaJson: { eventName: '實體一對一諮詢', eventDate: '2026-10-01' },
    })).toMatchObject({
      hours: 0,
      points: 0,
      creditStatus: 'zero',
      creditStatusLabel: '不計時數',
    });
  });

  test('a Date object still uses the calendar day for 45-minute English Table', () => {
    expect(mapCreditCheckinRow({
      reservationId: 13,
      eventId: 9,
      eventName: 'English Table B',
      eventDate: new Date(2026, 8, 15),
      startTime: '18:00:00',
      eventType: 'ET',
      countsTowardPassport: 0,
      excludeFromClassCredit: 0,
    })).toMatchObject({
      eventDate: '2026-09-15',
      startTime: '18:00',
      hours: 0.75,
      creditStatus: 'counted',
    });
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
