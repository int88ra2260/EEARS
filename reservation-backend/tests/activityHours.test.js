'use strict';

const {
  hoursFromStartEndTime,
  hoursForActivityParticipation,
  hoursForActivityType,
  parseTimeToMinutes
} = require('../services/learningJourney/utils/activityHours');

describe('activityHours', () => {
  it('parseTimeToMinutes accepts HH:MM and HH:MM:SS', () => {
    expect(parseTimeToMinutes('16:00:00')).toBe(16 * 60);
    expect(parseTimeToMinutes('16:30')).toBe(16 * 60 + 30);
    expect(parseTimeToMinutes('bad')).toBeNull();
  });

  it('hoursFromStartEndTime computes duration in hours', () => {
    expect(hoursFromStartEndTime('16:00:00', '17:00:00')).toBe(1);
    expect(hoursFromStartEndTime('16:30:00', '18:00:00')).toBe(1.5);
    // 50-minute consultation
    expect(hoursFromStartEndTime('18:00:00', '18:50:00')).toBe(0.83);
    expect(hoursFromStartEndTime('23:00:00', '01:00:00')).toBe(2);
    expect(hoursFromStartEndTime(null, '17:00:00')).toBeNull();
  });

  it('hoursForActivityParticipation prefers StartTime/EndTime over type map', () => {
    expect(hoursForActivityParticipation('EWL', {
      startTime: '16:00:00',
      endTime: '17:00:00'
    })).toBe(1);
    expect(hoursForActivityParticipation('EWL', {
      StartTime: '16:30:00',
      EndTime: '18:00:00'
    })).toBe(1.5);
    expect(hoursForActivityParticipation('ET', {})).toBe(0.5);
    expect(hoursForActivityParticipation('EWL', {})).toBe(0);
    expect(hoursForActivityType('EWL')).toBe(0);
  });
});
