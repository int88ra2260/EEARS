import { extractEnglishTestQueryResult } from './englishTestQueryResponse';

describe('extractEnglishTestQueryResult', () => {
  it('returns defaults for empty input', () => {
    expect(extractEnglishTestQueryResult(null)).toEqual({
      found: false,
      registration: null,
      canEdit: false,
      statusMessage: null,
      semester: null,
      legacySemesterInferred: false,
    });
  });

  it('parses nested data payload from public query API', () => {
    const result = extractEnglishTestQueryResult({
      found: true,
      data: {
        semester: '115-1',
        canEdit: true,
        statusMessage: null,
        legacySemesterInferred: true,
        registration: { id: 1, semester: null, studentId: 'B123456789' },
      },
    });

    expect(result.found).toBe(true);
    expect(result.semester).toBe('115-1');
    expect(result.legacySemesterInferred).toBe(true);
    expect(result.registration.id).toBe(1);
  });
});
