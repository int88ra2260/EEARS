'use strict';

const {
  buildAnalyticExamRows,
  sumResourceBefore,
} = require('../services/learningJourney/analytics/analyticRebuildService');
const { EVENT_TYPES, EVENT_STATUS } = require('../constants/learningJourneyEventConstants');

describe('analyticRebuildService', () => {
  const snapshotVersion = 'test-v1';
  const derivedAt = new Date('2026-06-15');

  const baseEvents = [
    {
      id: 1,
      studentId: 'S001',
      eventType: EVENT_TYPES.COURSE,
      eventDate: '2025-03-01',
      hours: 18,
      excludeFlag: false,
      status: EVENT_STATUS.VALID,
    },
    {
      id: 2,
      studentId: 'S001',
      eventType: EVENT_TYPES.ACTIVITY,
      eventDate: '2025-06-01',
      hours: 1,
      excludeFlag: false,
      status: EVENT_STATUS.VALID,
    },
    {
      id: 10,
      studentId: 'S001',
      eventType: EVENT_TYPES.EXAM,
      eventDate: '2025-06-01',
      instrument: 'TOEIC',
      skill: 'listening',
      rawScore: 500,
      cefrLevel: 'B2',
      excludeFlag: false,
      status: EVENT_STATUS.VALID,
      timing: 'in_course',
    },
    {
      id: 11,
      studentId: 'S001',
      eventType: EVENT_TYPES.EXAM,
      eventDate: '2026-01-15',
      instrument: 'TOEIC',
      skill: 'listening',
      rawScore: 550,
      cefrLevel: 'B2',
      excludeFlag: false,
      status: EVENT_STATUS.VALID,
      timing: 'voluntary',
    },
  ];

  it('computes exam_seq within same instrument and skill', () => {
    const rows = buildAnalyticExamRows(baseEvents, snapshotVersion, derivedAt);
    const listening = rows.filter((r) => r.skill === 'listening');
    expect(listening).toHaveLength(2);
    expect(listening[0].examSeq).toBe(1);
    expect(listening[1].examSeq).toBe(2);
    expect(listening[0].examRound).toBe(1);
    expect(listening[1].examRound).toBe(2);
    expect(listening[0].testPhase).toBe('pre_test');
    expect(listening[1].testPhase).toBe('post_test');
    expect(listening[1].retestFlag).toBe(true);
    expect(listening[1].exposureWindowStart).toBe('2025-06-01');
  });

  it('computes delta only for same instrument and skill', () => {
    const rows = buildAnalyticExamRows(baseEvents, snapshotVersion, derivedAt);
    const second = rows.find((r) => r.examSeq === 2);
    expect(second.deltaRawScore).toBe(50);
    expect(second.improvedFlag).toBe(true);
  });

  it('does not count same-day activity as before exam exposure', () => {
    const before = sumResourceBefore('2025-06-01', baseEvents.filter((e) => e.studentId === 'S001'));
    expect(before.courseHours).toBe(18);
    expect(before.activityHours).toBe(0);
    expect(before.activityCount).toBe(0);
  });

  it('round 2 exposure starts from round 1 session end, not lifetime', () => {
    const events = [
      {
        id: 1,
        studentId: 'S002',
        eventType: EVENT_TYPES.COURSE,
        eventDate: '2025-03-01',
        hours: 18,
        excludeFlag: false,
        status: EVENT_STATUS.VALID,
      },
      {
        id: 2,
        studentId: 'S002',
        eventType: EVENT_TYPES.COURSE,
        eventDate: '2025-09-01',
        hours: 36,
        excludeFlag: false,
        status: EVENT_STATUS.VALID,
      },
      {
        id: 10,
        studentId: 'S002',
        eventType: EVENT_TYPES.EXAM,
        eventDate: '2025-06-01',
        instrument: 'TOEIC',
        skill: 'listening',
        rawScore: 500,
        cefrLevel: 'B2',
        excludeFlag: false,
        status: EVENT_STATUS.VALID,
      },
      {
        id: 11,
        studentId: 'S002',
        eventType: EVENT_TYPES.EXAM,
        eventDate: '2026-01-15',
        instrument: 'TOEIC',
        skill: 'listening',
        rawScore: 550,
        cefrLevel: 'B2',
        excludeFlag: false,
        status: EVENT_STATUS.VALID,
      },
    ];
    const rows = buildAnalyticExamRows(events, snapshotVersion, derivedAt);
    const round2 = rows.find((r) => r.examRound === 2);
    expect(round2.courseHoursBeforeExam).toBe(36);
    expect(round2.exposureWindowStart).toBe('2025-06-01');
  });

  it('excludes in_progress course events from exam exposure totals', () => {
    const events = [
      {
        id: 1,
        studentId: 'S003',
        eventType: EVENT_TYPES.COURSE,
        eventDate: '2025-03-01',
        hours: 54,
        excludeFlag: true,
        status: EVENT_STATUS.VALID,
      },
      {
        id: 10,
        studentId: 'S003',
        eventType: EVENT_TYPES.EXAM,
        eventDate: '2025-06-01',
        instrument: 'TOEIC',
        skill: 'listening',
        rawScore: 500,
        cefrLevel: 'B2',
        excludeFlag: false,
        status: EVENT_STATUS.VALID,
      },
    ];
    const rows = buildAnalyticExamRows(events, snapshotVersion, derivedAt);
    expect(rows[0].courseHoursBeforeExam).toBe(0);
  });

  it('excludes cross-tool delta when instruments differ', () => {
    const events = [
      ...baseEvents.filter((e) => e.id !== 11),
      {
        id: 12,
        studentId: 'S001',
        eventType: EVENT_TYPES.EXAM,
        eventDate: '2026-02-01',
        instrument: 'BESTEP',
        skill: 'listening',
        rawScore: 120,
        cefrLevel: 'B2',
        excludeFlag: false,
        status: EVENT_STATUS.VALID,
        timing: 'voluntary',
      },
    ];
    const rows = buildAnalyticExamRows(events, snapshotVersion, derivedAt);
    const bestep = rows.find((r) => r.instrument === 'BESTEP');
    expect(bestep.deltaRawScore).toBeNull();
    expect(bestep.improvedFlag).toBeNull();
  });
});
