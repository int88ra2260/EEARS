/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const {
  PRESENT_LABEL,
  SITTING_B2_NOTE,
  buildBestepAnalyticsExtension,
  buildSittingB2Rates,
} = require('../services/bestepAnalyticsAggregateService');

function registration(overrides) {
  return {
    studentId: 'B123456',
    semester: '114-2',
    status: 'success',
    examType: 'LRSW',
    ...overrides,
  };
}

function attendance(overrides) {
  return {
    studentId: 'B123456',
    semester: '114-2',
    examType: 'L',
    attended: true,
    ...overrides,
  };
}

function score(overrides) {
  return {
    studentId: 'B123456',
    semester: '114-2',
    listeningScore: null,
    readingScore: null,
    speakingScore: null,
    writingScore: null,
    listeningLevel: null,
    readingLevel: null,
    speakingLevel: null,
    writingLevel: null,
    ...overrides,
  };
}

describe('buildBestepAnalyticsExtension', () => {
  it('keeps all registrations separate from successful skill-bearing registrations', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [
        registration({ studentId: 'A1', status: 'pending', examType: 'LRSW' }),
        registration({ studentId: 'A2', status: 'success', examType: 'LR' }),
        registration({ studentId: 'A3', status: 'registered_success', examType: 'NON' }),
        registration({ studentId: 'A4', status: 'failed', examType: 'SW' }),
      ],
    });

    expect(result.registrationSummary.rowCount).toBe(4);
    expect(result.registrationSummary.distinctStudentCount).toBe(4);
    expect(result.registrationSummary.successStudentCount).toBe(2);
    expect(result.registrationSummary.byExamType).toEqual({
      LRSW: 1, LR: 1, SW: 1, NON: 1, other: 0,
    });
    expect(result.registrationSummary.successByExamType.NON).toBe(1);
    expect(result.registrationSummary.examPopulationStudentCount).toBe(1);
  });

  it('does not put NON into the four-skill population', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [
        registration({ studentId: 'N1', examType: '不報考' }),
        registration({ studentId: 'N2', examType: 'LRSW' }),
      ],
      attendance: [
        attendance({ studentId: 'N1', examType: 'L', attended: false }),
        attendance({ studentId: 'N2', examType: 'L', attended: false }),
      ],
    });

    expect(result.registrationSummary.byExamType.NON).toBe(1);
    expect(result.attendance.skills.L.eligible).toBe(1);
    expect(result.attendance.skills.L.markedAbsent).toBe(1);
    expect(result.attendance.unmatchedImportRows).toBe(1);
  });

  it('ignores LR and SW aggregate attendance rows', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [registration({ examType: 'LRSW' })],
      attendance: [
        attendance({ examType: 'L', attended: false }),
        attendance({ examType: 'R', attended: true }),
        attendance({ examType: 'LR', attended: true }),
        attendance({ examType: 'SW', attended: false }),
      ],
    });

    expect(result.attendance.ignoredAggregateRows).toBe(2);
    expect(result.attendance.skills.L.imported).toBe(1);
    expect(result.attendance.skills.L.markedAbsent).toBe(1);
    expect(result.attendance.skills.R.markedPresent).toBe(1);
    expect(result.attendance.skills.S.imported).toBe(0);
    expect(result.attendance.skills.S.markedAbsent).toBe(0);
    expect(result.attendance.skills.S.missingRecord).toBe(1);
  });

  it('does not treat a missing attendance row as absent', () => {
    const none = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [registration()],
    });
    expect(none.attendance.importStatus).toBe('none');
    expect(none.attendance.skills.L.eligible).toBe(1);
    expect(none.attendance.skills.L.markedAbsent).toBeNull();
    expect(none.attendance.skills.L.missingRecord).toBeNull();

    const partial = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [
        registration({ studentId: 'P1' }),
        registration({ studentId: 'P2' }),
      ],
      attendance: [attendance({ studentId: 'P1', examType: 'L', attended: false })],
    });
    expect(partial.attendance.importStatus).toBe('imported');
    expect(partial.attendance.skills.L.markedAbsent).toBe(1);
    expect(partial.attendance.skills.L.missingRecord).toBe(1);
    expect(partial.attendance.skills.R.markedAbsent).toBe(0);
    expect(partial.attendance.skills.R.missingRecord).toBe(2);
  });

  it('keeps an imported present mark unconfirmed', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [registration()],
      attendance: [attendance({ attended: true })],
    });

    expect(result.attendance.skills.L.markedPresent).toBe(1);
    expect(result.attendance.confirmedAttendance).toBe(false);
    expect(result.attendance.presentMeaning).toBe('import_marked_unconfirmed');
    expect(result.attendance.presentLabel).toBe(PRESENT_LABEL);
  });

  it('keeps a student in skills that have scores when other skills are missing', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [registration({ examType: 'LRSW' })],
      scores: [score({ listeningScore: 42, listeningLevel: 'B1' })],
    });

    expect(result.scores.skills.listening.withScore).toBe(1);
    expect(result.scores.skills.listening.cefr.B1).toBe(1);
    expect(result.scores.skills.reading.withScore).toBe(0);
    expect(result.scores.skills.reading.missingAmongEligible).toBe(1);
    expect(result.scores.skills.reading.eligible).toBe(1);
    expect(result.scores.skills.speaking.missingAmongEligible).toBe(1);
    expect(result.scores.skills.writing.missingAmongEligible).toBe(1);
  });

  it('counts a stored zero as a score', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [registration({ examType: 'LR' })],
      scores: [score({ listeningScore: 0, listeningLevel: 'A1', readingScore: '0.00', readingLevel: 'A2' })],
    });

    expect(result.scores.skills.listening.withScore).toBe(1);
    expect(result.scores.skills.listening.missingAmongEligible).toBe(0);
    expect(result.scores.skills.reading.withScore).toBe(1);
    expect(result.scores.skills.speaking.eligible).toBe(0);
  });

  it('keeps stored C1 and C2, and does not promote B2+ or a missing level', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [
        registration({ studentId: 'C1S' }),
        registration({ studentId: 'C2S' }),
        registration({ studentId: 'PLUS' }),
        registration({ studentId: 'NONE' }),
      ],
      scores: [
        score({ studentId: 'C1S', listeningScore: 80, listeningLevel: 'C1' }),
        score({ studentId: 'C2S', listeningScore: 90, listeningLevel: 'c2' }),
        score({ studentId: 'PLUS', listeningScore: 70, listeningLevel: 'B2+' }),
        score({ studentId: 'NONE', listeningScore: 10, listeningLevel: '  ' }),
      ],
    });
    const listening = result.scores.skills.listening;

    expect(listening.cefr.C1).toBe(1);
    expect(listening.cefr.C2).toBe(1);
    expect(listening.cefr.B2).toBe(0);
    expect(listening.cefr.A1).toBe(0);
    expect(listening.cefr.unrecognized).toBe(1);
    expect(listening.cefr.missing).toBe(1);
    expect(listening.withScore).toBe(4);
    expect(listening.denominator).toBe(4);
    expect(listening.b2LevelCount).toBe(0);
    expect(listening.b2OrAboveCount).toBe(2);
  });

  it('keeps a scored student in the denominator when CEFR is missing', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [registration()],
      scores: [score({ listeningScore: 10, listeningLevel: '' })],
    });

    expect(result.scores.skills.listening.withScore).toBe(1);
    expect(result.scores.skills.listening.denominator).toBe(1);
    expect(result.scores.skills.listening.cefr.missing).toBe(1);
    expect(result.scores.skills.listening.b2LevelCount).toBe(0);
    expect(result.scores.skills.listening.b2OrAboveCount).toBe(0);
    expect(result.scores.cefrResolutionNote).toMatch(/不能還原/);
  });

  it('does not merge two raw student ids that fold to the same key', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [
        registration({ studentId: 'Ab1', examType: 'LRSW' }),
        registration({ studentId: 'aB1', examType: 'LR' }),
        registration({ studentId: 'b999', examType: 'SW' }),
      ],
      attendance: [
        attendance({ studentId: 'B999', examType: 'S', attended: false }),
        attendance({ studentId: 'Ab1', examType: 'L', attended: true }),
      ],
      scores: [score({ studentId: 'B999', speakingScore: 3, speakingLevel: 'B2' })],
    });

    expect(result.registrationSummary.sameTableStudentIdCollisions).toBe(1);
    expect(result.registrationSummary.distinctStudentCount).toBe(3);
    expect(result.registrationSummary.examPopulationStudentCount).toBe(1);
    expect(result.attendance.skills.L.eligible).toBe(0);
    expect(result.attendance.skills.S.eligible).toBe(1);
    expect(result.attendance.skills.S.markedAbsent).toBe(1);
    expect(result.attendance.caseFoldMatchCount).toBe(1);
    expect(result.attendance.unmatchedImportRows).toBe(1);
    expect(result.scores.skills.speaking.withScore).toBe(1);
    expect(result.scores.skills.speaking.b2OrAboveCount).toBe(1);
    expect(result.scores.caseFoldMatchCount).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/Ab1|aB1|b999|B999/);
  });

  it('reports a semester with no attendance or score import as not imported', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [registration()],
      attendance: [attendance({ semester: '113-2' })],
      scores: [score({ semester: '113-2', listeningScore: 1, listeningLevel: 'A1' })],
    });

    expect(result.attendance.importStatus).toBe('none');
    expect(result.attendance.ignoredOtherSemesterRows).toBe(1);
    expect(result.attendance.skills.L.markedPresent).toBeNull();
    expect(result.scores.importStatus).toBe('none');
    expect(result.scores.skills.listening.withScore).toBeNull();
    expect(result.scores.ignoredOtherSemesterRows).toBe(1);
    expect(result.registrationSummary.successStudentCount).toBe(1);
  });

  it('refuses to add attendance or scores across all semesters', () => {
    const result = buildBestepAnalyticsExtension({
      semester: 'all',
      registrations: [
        registration({ semester: '114-2' }),
        registration({ studentId: 'C2', semester: '113-2', examType: 'LR' }),
      ],
      attendance: [attendance({ attended: false })],
      scores: [score({ listeningScore: 1, listeningLevel: 'B2' })],
    });

    expect(result.registrationSummary.rowCount).toBe(2);
    expect(result.attendance.importStatus).toBe('not_for_all_semesters');
    expect(result.attendance.skills.L.eligible).toBeNull();
    expect(result.attendance.skills.L.markedAbsent).toBeNull();
    expect(result.scores.importStatus).toBe('not_for_all_semesters');
    expect(result.scores.skills.listening.withScore).toBeNull();
  });

  it('counts blank ids, duplicates, and unmatched imports without emitting student fields', () => {
    const result = buildBestepAnalyticsExtension({
      semester: '114-2',
      registrations: [
        registration({ studentId: '   ' }),
        registration({ studentId: 'D1', status: 'pending' }),
      ],
      attendance: [
        attendance({ studentId: 'D1', examType: 'L' }),
        attendance({ studentId: '', examType: 'R' }),
      ],
      scores: [
        score({ studentId: 'D1', listeningScore: 8, listeningLevel: 'C1' }),
        score({ studentId: 'D1', listeningScore: 9, listeningLevel: 'C2' }),
      ],
    });

    expect(result.registrationSummary.blankStudentIdCount).toBe(1);
    expect(result.registrationSummary.successStudentCount).toBe(0);
    expect(result.attendance.unmatchedImportRows).toBe(2);
    expect(result.scores.unmatchedScoreStudents).toBe(1);
    expect(result.scores.duplicateScoreRows).toBe(1);
    expect(result.scores.skills.listening.withScore).toBe(0);
    expect(Object.keys(result).sort()).toEqual(['attendance', 'registrationSummary', 'scores']);
  });
});

describe('buildSittingB2Rates', () => {
  it('keeps each sitting on its own denominator and counts C1 toward B2 or above', () => {
    const result = buildSittingB2Rates(
      [
        registration({ studentId: 'S1', semester: '114-2' }),
        registration({ studentId: 'S2', semester: '114-2' }),
        registration({ studentId: 'S1', semester: '113-2' }),
        registration({ studentId: 'S3', semester: '114-1' }),
      ],
      [
        score({ studentId: 'S1', semester: '114-2', listeningScore: 80, listeningLevel: 'B2' }),
        score({ studentId: 'S2', semester: '114-2', listeningScore: 10, listeningLevel: 'A1' }),
        score({ studentId: 'S1', semester: '113-2', listeningScore: 90, listeningLevel: 'C1' }),
        score({ studentId: 'S3', semester: '114-1', listeningScore: 40, listeningLevel: 'B1' }),
      ],
    );

    expect(result.sumsPeople).toBe(false);
    expect(result.note).toBe(SITTING_B2_NOTE);
    expect(result.sittings.map((row) => row.semester)).toEqual(['113-2', '114-1', '114-2']);
    expect(result.sittings[0].skills.listening).toEqual({
      label: '聽力', b2OrAboveCount: 1, b2LevelCount: 0, denominator: 1,
    });
    expect(result.sittings[1].skills.listening).toEqual({
      label: '聽力', b2OrAboveCount: 0, b2LevelCount: 0, denominator: 1,
    });
    expect(result.sittings[2].skills.listening).toEqual({
      label: '聽力', b2OrAboveCount: 1, b2LevelCount: 1, denominator: 2,
    });
    expect(result.total).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/S1|S2|S3/);
  });

  it('does not turn a semester without scores into a zero rate', () => {
    const result = buildSittingB2Rates(
      [registration({ studentId: 'S4', semester: '113-1' })],
      [],
    );
    const listening = result.sittings[0].skills.listening;

    expect(result.sittings).toHaveLength(1);
    expect(result.sittings[0].importStatus).toBe('none');
    expect(listening.b2OrAboveCount).toBeNull();
    expect(listening.b2LevelCount).toBeNull();
    expect(listening.denominator).toBeNull();
  });

  it('keeps a scored student without a level in that sitting denominator', () => {
    const result = buildSittingB2Rates(
      [registration({ studentId: 'S5', semester: '114-2' })],
      [score({ studentId: 'S5', semester: '114-2', listeningScore: 10, listeningLevel: '' })],
    );
    const listening = result.sittings[0].skills.listening;

    expect(result.sittings[0].importStatus).toBe('imported');
    expect(listening.denominator).toBe(1);
    expect(listening.b2OrAboveCount).toBe(0);
    expect(listening.b2LevelCount).toBe(0);
  });

  it('does not let a case-folded collision in one sitting change another sitting', () => {
    const result = buildSittingB2Rates(
      [
        registration({ studentId: 'Ab1', semester: '114-2' }),
        registration({ studentId: 'aB1', semester: '114-2' }),
        registration({ studentId: 'OK1', semester: '113-2' }),
      ],
      [
        score({ studentId: 'Ab1', semester: '114-2', listeningScore: 80, listeningLevel: 'B2' }),
        score({ studentId: 'OK1', semester: '113-2', listeningScore: 80, listeningLevel: 'B2' }),
      ],
    );

    expect(result.sittings[0].semester).toBe('113-2');
    expect(result.sittings[0].skills.listening.b2OrAboveCount).toBe(1);
    expect(result.sittings[0].skills.listening.denominator).toBe(1);
    expect(result.sittings[1].skills.listening.denominator).toBe(0);
    expect(result.sittings[1].skills.listening.b2OrAboveCount).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/Ab1|aB1|OK1/);
  });

  it('uses score rows when a sitting has no successful registration and keeps later sittings on registrations', () => {
    const result = buildSittingB2Rates(
      [registration({ studentId: 'NEW1', semester: '115-1', examType: 'LR' })],
      [
        score({
          studentId: 'OLD1',
          semester: '113-2',
          listeningScore: 80,
          listeningLevel: 'B2',
          readingScore: 10,
          readingLevel: 'A2',
        }),
        score({
          studentId: 'NEW1',
          semester: '115-1',
          listeningScore: 70,
          listeningLevel: 'B2',
          readingScore: 70,
          readingLevel: 'B2',
        }),
        score({ studentId: 'GHOST', semester: '115-1', listeningScore: 90, listeningLevel: 'C1' }),
      ],
    );
    const historical = result.sittings.find((row) => row.semester === '113-2');
    const current = result.sittings.find((row) => row.semester === '115-1');

    expect(historical.population).toBe('scores_only');
    expect(historical.skills.listening).toMatchObject({ b2OrAboveCount: 1, denominator: 1 });
    expect(historical.skills.reading).toMatchObject({ b2OrAboveCount: 0, denominator: 1 });
    expect(historical.skills.speaking.denominator).toBe(0);
    expect(current.population).toBe('registered');
    expect(current.skills.listening).toMatchObject({ b2OrAboveCount: 1, denominator: 1 });
    expect(current.skills.speaking.denominator).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/OLD1|NEW1|GHOST/);
  });
});

describe('buildRegistrationCountSeries', () => {
  const { buildRegistrationCountSeries } = require('../services/bestepLegacyRegistrationCounts');

  it('fills a missing semester from a google form constant and does not cover a system count', () => {
    const series = buildRegistrationCountSeries(
      { '115-1': 12, '114-2': 0 },
      { '113-2': 40, '114-2': 80, '115-1': 999 },
    );

    expect(series).toEqual([
      { semester: '113-2', count: 40, source: 'google_form' },
      { semester: '114-2', count: 80, source: 'google_form' },
      { semester: '115-1', count: 12, source: 'system' },
    ]);
    expect(JSON.stringify(series)).not.toMatch(/studentId|學號/);
  });
});

describe('english test analytics route contract', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../routes/englishTestRegistrationRouter.js'),
    'utf8',
  );
  const start = source.indexOf("router.get('/english-test/registrations/stats/analytics'");
  const end = source.indexOf("router.get('/english-test/registrations/exemption-review'");
  const block = source.slice(start, end);

  it('keeps the existing view permission and registration fields', () => {
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('...englishRegViewAuth');
    expect(block).toContain('infoSource');
    expect(block).toContain('department');
    expect(block).toContain('grade');
    expect(block).toContain('semesterCounts');
    expect(block).toContain('availableSemesters');
    expect(block).toContain('activeSemester');
    expect(block).toContain('loadBestepAnalyticsExtension');
    expect(block).toContain('sittingB2Rates');
    expect(block).toContain('registrationCountSeries');
    expect(block).not.toMatch(/ExamAttempt|LearningJourney|bestep-overview/);
  });
});
