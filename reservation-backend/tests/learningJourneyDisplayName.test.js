const { pickDisplayName } = require('../services/learningJourney/migration/studentMigrationService');
const { courseRowToTimelineEvent } = require('../services/learningJourney/learningJourneyTimelineService');

describe('learning journey display name and course timeline', () => {
  test('prefers roster name over snapshot and course names', () => {
    expect(pickDisplayName('B123', {
      rosterName: '王小明',
      snapshotName: '其他',
      courseName: '修課名',
    })).toBe('王小明');
  });

  test('falls back to the student id when no real name exists', () => {
    expect(pickDisplayName('B123', { rosterName: 'B123', snapshotName: '  ' })).toBe('B123');
  });

  test('maps a course enrollment into a timeline event', () => {
    expect(courseRowToTimelineEvent({
      id: 4,
      semesterId: '114-1',
      enrollmentStatus: 'enrolled',
      passStatus: 'in_progress',
      createdAt: '2026-09-01',
      course: { courseCode: 'ENG101', courseName: '英語寫作', semesterId: '114-1' },
    })).toEqual({
      type: 'course',
      eventId: 'course_4',
      semesterId: '114-1',
      courseCode: 'ENG101',
      courseName: '英語寫作',
      enrollmentStatus: 'enrolled',
      passStatus: 'in_progress',
      at: '2026-09-01',
    });
  });
});