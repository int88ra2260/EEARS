'use strict';

jest.mock('../models', () => ({
  LjStudentEvent: { count: jest.fn() },
  LjAnalyticStudent: { findOne: jest.fn() },
  CourseEnrollment: { count: jest.fn() },
  ActivityParticipation: { count: jest.fn() },
  EtExamAttempt: { count: jest.fn() },
}));

jest.mock('../services/learningJourney/analytics/eventProjectorService', () => ({
  projectAllEvents: jest.fn(),
  normSid: (v) => String(v || '').trim().toUpperCase(),
}));

jest.mock('../services/learningJourney/analytics/analyticRebuildService', () => ({
  rebuildAnalytics: jest.fn(),
}));

const {
  LjStudentEvent,
  LjAnalyticStudent,
  CourseEnrollment,
  ActivityParticipation,
  EtExamAttempt,
} = require('../models');
const { projectAllEvents } = require('../services/learningJourney/analytics/eventProjectorService');
const { rebuildAnalytics } = require('../services/learningJourney/analytics/analyticRebuildService');
const {
  ensureStudentAnalyticsReady,
  studentNeedsEventProjection,
} = require('../services/learningJourney/analytics/studentAnalyticsSyncService');

describe('studentAnalyticsSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CourseEnrollment.count.mockResolvedValue(0);
    ActivityParticipation.count.mockResolvedValue(0);
    EtExamAttempt.count.mockResolvedValue(0);
    LjStudentEvent.count.mockResolvedValue(0);
    LjAnalyticStudent.findOne.mockResolvedValue({ snapshotVersion: 'snap-1' });
    projectAllEvents.mockResolvedValue({ total: 1 });
    rebuildAnalytics.mockResolvedValue({ analyticStudentCount: 1 });
  });

  test('studentNeedsEventProjection returns false when no operational data', async () => {
    const needed = await studentNeedsEventProjection('B12000001');
    expect(needed).toBe(false);
  });

  test('studentNeedsEventProjection returns true when enrollments exist but no events', async () => {
    CourseEnrollment.count.mockResolvedValue(2);
    LjStudentEvent.count.mockResolvedValue(0);

    const needed = await studentNeedsEventProjection('B12000001');
    expect(needed).toBe(true);
  });

  test('ensureStudentAnalyticsReady projects and rebuilds when analytic row missing', async () => {
    CourseEnrollment.count.mockResolvedValue(1);
    LjStudentEvent.count.mockResolvedValue(0);
    LjAnalyticStudent.findOne.mockResolvedValue(null);

    const result = await ensureStudentAnalyticsReady('b12000001');

    expect(result.projected).toBe(true);
    expect(result.rebuilt).toBe(true);
    expect(projectAllEvents).toHaveBeenCalledWith({ studentIds: ['B12000001'] });
    expect(rebuildAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ studentIds: ['B12000001'], scope: 'student' })
    );
  });

  test('ensureStudentAnalyticsReady skips projection when events already exist', async () => {
    CourseEnrollment.count.mockResolvedValue(1);
    ActivityParticipation.count.mockResolvedValue(0);
    EtExamAttempt.count.mockResolvedValue(0);
    LjStudentEvent.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await ensureStudentAnalyticsReady('B12000001');

    expect(result.projected).toBe(false);
    expect(projectAllEvents).not.toHaveBeenCalled();
  });
});
