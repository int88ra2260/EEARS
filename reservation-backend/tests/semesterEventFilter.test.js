const { SEMESTER_RANGES } = require('../utils/semesterConstants');
const {
  buildSemesterEventFilter,
  isEventDateInSemester
} = require('../services/learningJourney/utils/semesterEventFilter');

function compactSql(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim();
}

describe('buildSemesterEventFilter', () => {
  it('T4-P1 returns empty filter when semesterId is missing', () => {
    const filter = buildSemesterEventFilter('');
    expect(filter.join).toBe('');
    expect(filter.where).toBe('');
    expect(filter.replacements).toEqual({});
  });

  it('T4-P2 identifies semesters, et_semesters and static ranges without snapshotting SQL', () => {
    const filter = buildSemesterEventFilter('114-2');
    const range = SEMESTER_RANGES['114-2'];
    const join = compactSql(filter.join);
    const where = compactSql(filter.where);

    expect(filter.replacements).toEqual({
      semesterId: '114-2',
      semesterStart: range.start,
      semesterEnd: range.end,
    });
    expect(join).toContain('LEFT JOIN semesters event_semester');
    expect(join).toContain('LEFT JOIN semesters requested_semester');
    expect(join).toContain('LEFT JOIN et_semesters et_requested');
    expect(where).toContain('event_semester.code = :semesterId');
    expect(where).toContain('e.semesterId = requested_semester.id');
    expect(where).toContain('et_requested.startDate');
    expect(where).toContain('e.date >= :semesterStart');
    expect(where).toContain('e.date <= :semesterEnd');
  });

  it('T4-P3 matches inclusive semester date boundaries from config', () => {
    const range = SEMESTER_RANGES['114-1'];
    expect(isEventDateInSemester(range.start, '114-1')).toBe(true);
    expect(isEventDateInSemester(range.end, '114-1')).toBe(true);
    expect(isEventDateInSemester('2025-07-31', '114-1')).toBe(false);
    expect(isEventDateInSemester('2026-02-01', '114-1')).toBe(false);
  });

  it('T4-N1 unknown semester codes do not invent static dates', () => {
    const filter = buildSemesterEventFilter('999-9');
    const join = compactSql(filter.join);
    expect(filter.replacements).toEqual({ semesterId: '999-9' });
    expect(filter.replacements).not.toHaveProperty('semesterStart');
    expect(filter.replacements).not.toHaveProperty('semesterEnd');
    expect(join).toContain('semesters event_semester');
    expect(join).toContain('et_semesters et_requested');
    expect(compactSql(filter.where)).not.toContain(':semesterStart');
  });

  it('T4-N2 treats null and whitespace like an empty semester', () => {
    expect(buildSemesterEventFilter(null)).toEqual(buildSemesterEventFilter(''));
    expect(buildSemesterEventFilter('   ')).toEqual(buildSemesterEventFilter(''));
    expect(buildSemesterEventFilter(undefined)).toEqual(buildSemesterEventFilter(''));
  });
});
