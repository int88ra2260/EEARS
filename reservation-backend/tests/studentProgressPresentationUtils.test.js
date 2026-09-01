const {
  dedupeCourseRecords,
  dedupeBestepScoresBySemester,
  compactBestepAttendance,
  dedupeEnglishTestRegistrations,
  normalizeCourseTitle,
} = require('../services/studentProgress/studentProgressPresentationUtils');

describe('studentProgressPresentationUtils', () => {
  it('merges course records with different class name formats in same semester', () => {
    const items = dedupeCourseRecords([
      { semester: '114-2', className: '英文短篇小說 (高級) (賴淑芳)', department: '電機工程學系' },
      { semester: '114-2', className: '英文短篇小說 (高級) GESP410', department: '電機工程學系' },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].semester).toBe('114-2');
    expect(items[0].className).toContain('英文短篇小說');
    expect(items[0].className).toContain('高級');
  });

  it('keeps distinct courses in the same semester', () => {
    const items = dedupeCourseRecords([
      { semester: '114-2', className: '英文短篇小說 (高級)', department: 'A' },
      { semester: '114-2', className: '商用英文', department: 'A' },
    ]);
    expect(items).toHaveLength(2);
  });

  it('compacts BESTEP attendance to LR/SW when composites exist', () => {
    const rows = compactBestepAttendance([
      { semester: '114-2', examType: 'L', attended: true },
      { semester: '114-2', examType: 'R', attended: true },
      { semester: '114-2', examType: 'S', attended: true },
      { semester: '114-2', examType: 'W', attended: true },
      { semester: '114-2', examType: 'LR', attended: true },
      { semester: '114-2', examType: 'SW', attended: true },
    ]);

    expect(rows.map((r) => r.examType)).toEqual(['LR', 'SW']);
  });

  it('keeps atomic BESTEP attendance when no composite rows exist', () => {
    const rows = compactBestepAttendance([
      { semester: '114-1', examType: 'L', attended: true },
      { semester: '114-1', examType: 'R', attended: false },
    ]);
    expect(rows.map((r) => r.examType)).toEqual(['L', 'R']);
  });

  it('dedupes english test registrations by semester', () => {
    const rows = dedupeEnglishTestRegistrations([
      { id: 1, semester: '114-2', status: 'pending', updatedAt: '2026-01-01' },
      { id: 2, semester: '114-2', status: 'success', updatedAt: '2026-02-01' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(2);
  });
});
