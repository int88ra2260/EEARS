'use strict';

const { buildTemporalContext, validateTemporalContext } = require('../../analytics-contracts');

describe('temporal boundary validator', () => {
  test('a built event context stays valid', () => {
    const context = buildTemporalContext({
      metricId: 'ops.reservation.row_count',
      temporalContractId: 'TC-OPS-DATE-SEMESTER',
      boundaries: { eventSemesterRange: { semesterId: '115-1' } },
    });
    expect(validateTemporalContext(context)).toEqual({ ok: true, errors: [] });
    expect(context.boundaries.eventSemesterRange.startInclusive).toBe('2026-08-01T00:00:00+08:00');
    expect(context.boundaries.eventSemesterRange.endExclusive).toBe('2027-02-01T00:00:00+08:00');
  });

  test('an unfinished object is not valid', () => {
    const result = validateTemporalContext({ timezone: 'UTC' });
    expect(result.ok).toBe(false);
    expect(result.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      'MISSING_REQUIRED_BOUNDARY',
      'TEMPORAL_SEMANTIC_MISMATCH',
    ]));
  });

  test('custom half-open ranges must declare the bound kind', () => {
    expect(() => buildTemporalContext({
      metricId: 'ops.event.count',
      temporalContractId: 'TC-OPS-DATE-SEMESTER',
      boundaries: {
        eventSemesterRange: {
          startInclusive: '2026-02-01T00:00:00+08:00',
          endExclusive: '2026-02-01T00:00:00+08:00',
          boundKind: 'half_open',
        },
      },
    })).toThrow(expect.objectContaining({ code: 'INVALID_TIME_RANGE' }));
  });

  test('import time cannot be smuggled in as the assessment date', () => {
    expect(() => buildTemporalContext({
      metricId: 'bestep.file.skill_score',
      temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
      boundaries: {
        fileSemester: { semesterId: '114-2' },
        assessmentDate: {
          value: '2026-06-01T00:00:00+08:00',
          sourceField: 'bestep_exam_scores.importedAt',
        },
      },
    })).toThrow(expect.objectContaining({ code: 'TEMPORAL_SEMANTIC_MISMATCH' }));
  });
});
