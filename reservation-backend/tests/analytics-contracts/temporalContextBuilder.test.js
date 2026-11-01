'use strict';

const { buildTemporalContext, toSafeQueryBoundaries } = require('../../analytics-contracts');

describe('temporal context builder', () => {
  test('does not fill the current semester when the code is outside the config', () => {
    expect(() => buildTemporalContext({
      metricId: 'ops.event.count',
      temporalContractId: 'TC-OPS-DATE-SEMESTER',
      boundaries: { eventSemesterRange: { semesterId: '090-1' } },
    })).toThrow(expect.objectContaining({ code: 'TEMPORAL_SEMANTIC_MISMATCH' }));
  });

  test('a file semester is not rewritten into the first day of that semester', () => {
    const context = buildTemporalContext({
      metricId: 'bestep.file.four_skill_cefr_b2',
      temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
      boundaries: { fileSemester: { semesterId: '114-2' } },
    });
    const described = toSafeQueryBoundaries(context);
    expect(described.items).toEqual([
      expect.objectContaining({
        fieldSemantic: 'file_semester',
        semesterId: '114-2',
        startInclusive: null,
        endExclusive: null,
      }),
    ]);
    expect(described.safety.allowSqlInterpolation).toBe(false);
    expect(described.safety.allowSequelizeWhereDerivation).toBe(false);
  });

  test('rolling 30 days requires an explicit end and does not use now', () => {
    expect(() => buildTemporalContext({
      metricId: 'trace.micro_learning.30d',
      temporalContractId: 'TC-TRACE-ROLLING-30D',
      boundaries: { rollingDays: 30 },
    })).toThrow(expect.objectContaining({ code: 'MISSING_REQUIRED_BOUNDARY' }));

    const context = buildTemporalContext({
      metricId: 'trace.micro_learning.30d',
      temporalContractId: 'TC-TRACE-ROLLING-30D',
      boundaries: { rollingDays: 30, windowEnd: '2026-03-31T00:00:00+08:00' },
    });
    expect(context.boundaries.reportingPeriod.startInclusive).toBe('2026-03-01T00:00:00+08:00');
    expect(context.boundaries.reportingPeriod.endExclusive).toBe('2026-03-31T00:00:00+08:00');
    expect(context.boundaries.reportingPeriod.anchoredToRequestTime).toBe(false);
  });

  test('rejects a semester code placed in a date field and rejects slash dates', () => {
    expect(() => buildTemporalContext({
      metricId: 'bestep.file.skill_level',
      temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
      boundaries: { fileSemester: { semesterId: '114-2' }, assessmentDate: '114-2' },
    })).toThrow(expect.objectContaining({ code: 'INVALID_DATE_FORMAT' }));
    expect(() => buildTemporalContext({
      metricId: 'bestep.file.skill_level',
      temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
      boundaries: { fileSemester: { semesterId: '114-2' }, assessmentDate: '2026/3/1' },
    })).toThrow(expect.objectContaining({ code: 'INVALID_DATE_FORMAT' }));
  });
});
