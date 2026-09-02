'use strict';

const {
  mapEventTypeToActivityEnum,
  mapCheckinToAttendance,
  activityParticipationKey,
  pruneOrphanedCourseEnrollmentEvents,
} = require('../services/learningJourney/analytics/eventProjectorService');

jest.mock('../models', () => ({
  LjStudentEvent: { findAll: jest.fn(), update: jest.fn() },
  CourseEnrollment: { findAll: jest.fn() },
}));

const { LjStudentEvent, CourseEnrollment } = require('../models');

describe('eventProjectorService reservation helpers', () => {
  it('maps event types to activity enums including Job Talk', () => {
    expect(mapEventTypeToActivityEnum('ET')).toBe('ET');
    expect(mapEventTypeToActivityEnum('English Club')).toBe('EC');
    expect(mapEventTypeToActivityEnum('Job Talk')).toBe('JT');
    expect(mapEventTypeToActivityEnum('unknown')).toBeNull();
  });

  it('maps checkin status to attendance', () => {
    expect(mapCheckinToAttendance('已簽到')).toBe('attended');
    expect(mapCheckinToAttendance('已登記違規')).toBe('absent');
    expect(mapCheckinToAttendance('未簽到')).toBe('registered');
  });

  it('builds dedupe keys for activity participations', () => {
    expect(activityParticipationKey('s001', 42)).toBe('S001|42');
    expect(activityParticipationKey('', 42)).toBeNull();
  });

  it('voids course events whose enrollment row no longer exists', async () => {
    LjStudentEvent.findAll.mockResolvedValue([
      { id: 1, sourceRecordId: '10' },
      { id: 2, sourceRecordId: '11' },
    ]);
    CourseEnrollment.findAll.mockResolvedValue([{ id: 10 }]);
    LjStudentEvent.update.mockResolvedValue([1]);

    const result = await pruneOrphanedCourseEnrollmentEvents();

    expect(result).toEqual({ voided: 1 });
    expect(LjStudentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'void', excludeFlag: true }),
      expect.objectContaining({ where: expect.objectContaining({ id: expect.anything() }) }),
    );
  });
});
