'use strict';

const {
  assertInExposureWindow,
  sumResourceInExposureWindow,
  buildInstrumentSessions,
  resolveTestPhase,
} = require('../services/learningJourney/analytics/examSessionService');
const { EVENT_TYPES } = require('../constants/learningJourneyEventConstants');

describe('examSessionService', () => {
  it('counts resources from previous session end (inclusive) for round 2', () => {
    const resources = [
      { eventType: EVENT_TYPES.COURSE, eventDate: '2025-03-01', hours: 18 },
      { eventType: EVENT_TYPES.COURSE, eventDate: '2025-09-01', hours: 18 },
      { eventType: EVENT_TYPES.ACTIVITY, eventDate: '2025-06-01', hours: 2 },
    ];
    const round1End = '2025-06-01';
    const round2Exam = '2026-01-15';

    const before = sumResourceInExposureWindow(round2Exam, resources, round1End);
    expect(before.courseHours).toBe(18);
    expect(before.activityHours).toBe(2);
    expect(before.resourceHours).toBe(20);
    expect(before.courseCount).toBe(1);
  });

  it('excludes resources before previous session end for round 2', () => {
    expect(assertInExposureWindow('2026-01-15', '2025-03-01', '2025-06-01')).toBe(false);
    expect(assertInExposureWindow('2026-01-15', '2025-06-01', '2025-06-01')).toBe(true);
    expect(assertInExposureWindow('2026-01-15', '2025-09-01', '2025-06-01')).toBe(true);
  });

  it('assigns pre/post test phase for two rounds', () => {
    const exams = [
      { instrument: 'BESTEP', skill: 'listening', examDate: '2024-03-01', rawScore: 100, excludeFlag: false },
      { instrument: 'BESTEP', skill: 'listening', examDate: '2025-09-01', rawScore: 130, excludeFlag: false },
    ];
    const sessions = buildInstrumentSessions(exams, 'BESTEP');
    expect(sessions).toHaveLength(2);
    expect(resolveTestPhase(1, 2)).toBe('pre_test');
    expect(resolveTestPhase(2, 2)).toBe('post_test');
  });

  it('merges BESTEP split-session dates in the same semester into one round', () => {
    const exams = [
      { instrument: 'BESTEP', skill: 'listening', examDate: '2024-03-01', rawScore: 100, excludeFlag: false },
      { instrument: 'BESTEP', skill: 'speaking', examDate: '2024-04-20', rawScore: 90, excludeFlag: false },
    ];
    const sessions = buildInstrumentSessions(exams, 'BESTEP');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionStart).toBe('2024-03-01');
    expect(sessions[0].sessionEnd).toBe('2024-04-20');
    expect(sessions[0].semesterId).toBe('112-2');
  });

  it('keeps non-BESTEP instruments on the day-window clustering rule', () => {
    const exams = [
      { instrument: 'TOEIC', skill: 'listening', examDate: '2024-03-01', rawScore: 500, excludeFlag: false },
      { instrument: 'TOEIC', skill: 'listening', examDate: '2024-04-20', rawScore: 550, excludeFlag: false },
    ];
    const sessions = buildInstrumentSessions(exams, 'TOEIC');
    expect(sessions).toHaveLength(2);
  });
});
