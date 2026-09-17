'use strict';

const {
  calculateReservationTime,
} = require('../utils/reservationTime');
const eventTypeService = require('../services/eventTypeService');

describe('event types catalog + reservation time rules', () => {
  it('resolves legacy display names to codes', () => {
    const cfg = eventTypeService.resolveTypeConfigSync('English Table');
    expect(cfg.code).toBe('english_table');
    expect(cfg.cutoffHours).toBe(2);
  });

  it('English Table opens at noon the day before', () => {
    const event = { eventType: 'english_table', date: '2026-03-10', startTime: '14:00' };
    const { openStart, openEnd, cutoffHours } = calculateReservationTime(event);
    expect(cutoffHours).toBe(2);
    expect(openStart.format('YYYY-MM-DD HH:mm')).toBe('2026-03-09 12:00');
    expect(openEnd.format('YYYY-MM-DD HH:mm')).toBe('2026-03-10 12:00');
  });

  it('accepts legacy English Table name with same open window', () => {
    const event = { eventType: 'English Table', date: '2026-03-10', startTime: '14:00' };
    const { openStart } = calculateReservationTime(event);
    expect(openStart.format('YYYY-MM-DD HH:mm')).toBe('2026-03-09 12:00');
  });

  it('uses configurable cutoffHours from type config', () => {
    const event = { eventType: 'english_table', date: '2026-03-10', startTime: '14:00' };
    const base = eventTypeService.resolveTypeConfigSync('english_table');
    const { openEnd } = calculateReservationTime(event, { ...base, cutoffHours: 4 });
    expect(openEnd.format('YYYY-MM-DD HH:mm')).toBe('2026-03-10 10:00');
  });

  it('Job Talk opens 7 days before at noon', () => {
    const event = { eventType: 'job_talk', date: '2026-03-17', startTime: '15:00' };
    const { openStart } = calculateReservationTime(event);
    expect(openStart.format('YYYY-MM-DD HH:mm')).toBe('2026-03-10 12:00');
  });

  it('treats english_table as grouped capacity', () => {
    expect(eventTypeService.isGroupedCapacityMode('english_table')).toBe(true);
    expect(eventTypeService.isGroupedCapacityMode('job_talk')).toBe(false);
  });

  it('survey gate follows type flag', () => {
    expect(eventTypeService.isSurveyGateEnabledForType('english_table')).toBe(true);
    expect(eventTypeService.isSurveyGateEnabledForType('job_talk')).toBe(false);
  });

  it('maps event type to dynamic scope code', () => {
    const { eventTypeToScope } = require('../auth/accessProfile');
    expect(eventTypeToScope('English Table')).toBe('english_table');
    expect(eventTypeToScope('job_talk')).toBe('job_talk');
    expect(eventTypeToScope('Unknown')).toBe(null);
  });
});
