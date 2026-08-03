'use strict';

const {
  mapEventTypeToActivityEnum,
  mapCheckinToAttendance,
  activityParticipationKey,
} = require('../services/learningJourney/analytics/eventProjectorService');

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
});
