const {
  buildSemesterEventFilter,
  isEventDateInSemester
} = require('../services/learningJourney/utils/semesterEventFilter');

describe('buildSemesterEventFilter', () => {
  it('returns empty filter when semesterId is missing', () => {
    const filter = buildSemesterEventFilter('');
    expect(filter.join).toBe('');
    expect(filter.where).toBe('');
    expect(filter.replacements).toEqual({});
  });

  it('includes semesters, et_semesters and static semester ranges', () => {
    const filter = buildSemesterEventFilter('114-2');
    expect(filter.replacements.semesterId).toBe('114-2');
    expect(filter.replacements.semesterStart).toBe('2026-02-01');
    expect(filter.replacements.semesterEnd).toBe('2026-07-31');
    expect(filter.join).toContain('et_semesters et_requested');
    expect(filter.where).toContain('event_semester.code = :semesterId');
    expect(filter.where).toContain('e.date >= :semesterStart');
    expect(filter.where).toContain('e.date <= :semesterEnd');
  });

  it('matches event dates inside configured semester ranges', () => {
    expect(isEventDateInSemester('2026-03-23', '114-2')).toBe(true);
    expect(isEventDateInSemester('2025-05-25', '114-2')).toBe(false);
  });
});
