'use strict';

const { spawnSync } = require('child_process');
const {
  buildTemporalContext,
  validateTemporalContext,
  evaluateTemporalCompatibility,
  toSafeQueryBoundaries,
  adaptLegacyTimeFields,
  instantInHalfOpen,
  ContractRegistryError,
} = require('../../analytics-contracts');

function eventContext(metricId, contractId, semesterId) {
  return buildTemporalContext({
    metricId,
    temporalContractId: contractId,
    source: 'synthetic',
    boundaries: { eventSemesterRange: { semesterId } },
  });
}

describe('temporal golden cases T01–T20', () => {
  test('T01 semester becomes a named half-open event period', () => {
    const context = eventContext('ops.event.count', 'TC-OPS-DATE-SEMESTER', '114-2');
    const range = context.boundaries.eventSemesterRange;
    expect(range.semantic).toBe('event_time');
    expect(range.sourceBoundaryType).toBe('academic_semester');
    expect(range.startInclusive).toBe('2026-02-01T00:00:00+08:00');
    expect(range.endExclusive).toBe('2026-08-01T00:00:00+08:00');
    expect(range.legacyEnd).toBe('2026-07-31');
    expect(context.timezone).toBe('Asia/Taipei');
  });

  test('T02 event date and import time stay distinct', () => {
    const adapted = adaptLegacyTimeFields([
      { field: 'events.date', value: '2026-04-02' },
      { field: 'bestep_exam_scores.importedAt', value: '2026-06-01T01:00:00Z' },
    ]);
    expect(adapted.named.eventTime.semantic).toBe('event_time');
    expect(adapted.named.importTime.semantic).toBe('import_time');
    expect(() => adaptLegacyTimeFields([{ field: 'cutoffAt', value: '2026-04-02' }])).toThrow(ContractRegistryError);

    const context = buildTemporalContext({
      metricId: 'bestep.file.four_skill_cefr_b2',
      temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
      boundaries: {
        fileSemester: { semesterId: '114-2' },
        assessmentDate: '2026-04-02',
        importTime: '2026-06-01T01:00:00Z',
      },
    });
    expect(context.boundaries.assessmentDate.value).toBe('2026-04-02');
    expect(context.boundaries.importTime.value).toBe('2026-06-01T09:00:00+08:00');
    expect(context.boundaries.assessmentDate.semantic).not.toBe(context.boundaries.importTime.semantic);
  });

  test('T03 exam session without dates does not invent an exam date', () => {
    const context = buildTemporalContext({
      metricId: 'snapshot.gse_raw_delta',
      temporalContractId: 'TC-EXAM-SESSION',
      boundaries: { instrument: 'BESTEP', snapshotVersion: 'snap-synthetic' },
    });
    expect(context.boundaries.assessmentDate).toBeUndefined();
    expect(context.precision.assessment).toBe('unknown');
    expect(context.precision.assessmentDateInvented).toBe(false);
  });

  test('T04 roster semester is not a score cutoff', () => {
    const context = buildTemporalContext({
      metricId: 'roster.best_skill_rank_b2',
      temporalContractId: 'TC-ROSTER-BEST-ASOF-NOW',
      boundaries: { rosterSemester: { semesterId: '114-2' } },
    });
    const described = toSafeQueryBoundaries(context);
    const cohort = described.items.find((row) => row.fieldSemantic === 'cohort_semester');
    expect(cohort.semesterId).toBe('114-2');
    expect(cohort.startInclusive).toBeNull();
    expect(described.items.some((row) => row.fieldSemantic === 'data_as_of')).toBe(false);
    expect(context.claims.asOf).toBe(false);
  });

  test('T05 historical as-of is unsupported', () => {
    const context = buildTemporalContext({
      metricId: 'roster.best_skill_rank_b2',
      temporalContractId: 'TC-ROSTER-BEST-ASOF-NOW',
      boundaries: { rosterSemester: { semesterId: '114-2' } },
    });
    const verdict = evaluateTemporalCompatibility({
      leftContext: context,
      rightContext: context,
      comparisonType: 'historical_as_of',
    });
    expect(verdict.status).toBe('unsupported');
    expect(() => buildTemporalContext({
      metricId: 'roster.best_skill_rank_b2',
      temporalContractId: 'TC-ROSTER-BEST-ASOF-NOW',
      boundaries: { rosterSemester: { semesterId: '114-2' }, asOfDate: '2026-01-31' },
    })).toThrow(ContractRegistryError);
  });

  test('T06 baseline after follow-up is rejected', () => {
    expect(() => buildTemporalContext({
      metricId: 'snapshot.gse_raw_delta',
      temporalContractId: 'TC-EXAM-SESSION',
      boundaries: {
        instrument: 'BESTEP',
        snapshotVersion: 'snap-synthetic',
        baseline: '2026-05-02',
        followUp: '2026-05-01',
      },
    })).toThrow(expect.objectContaining({ code: 'INVALID_TIME_RANGE' }));
  });

  test('T07 UTC instant that crosses Taiwan midnight is converted explicitly', () => {
    const context = buildTemporalContext({
      metricId: 'bestep.file.skill_score',
      temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
      boundaries: {
        fileSemester: { semesterId: '114-2' },
        importTime: '2026-03-31T16:30:00Z',
      },
    });
    expect(context.boundaries.importTime.value).toBe('2026-04-01T00:30:00+08:00');
  });

  test('T08 month end and semester edge use a half-open window', () => {
    const spring = eventContext('ops.event.count', 'TC-OPS-DATE-SEMESTER', '114-2');
    const range = spring.boundaries.eventSemesterRange;
    expect(instantInHalfOpen(range.startInclusive, range.endExclusive, '2026-07-31T23:59:59+08:00')).toBe(true);
    expect(instantInHalfOpen(range.startInclusive, range.endExclusive, '2026-08-01T00:00:00+08:00')).toBe(false);
    expect(instantInHalfOpen(range.startInclusive, range.endExclusive, '2026-07-31T16:00:00Z')).toBe(false);

    const fall = eventContext('ops.event.count', 'TC-OPS-DATE-SEMESTER', '114-1');
    const fallRange = fall.boundaries.eventSemesterRange;
    expect(instantInHalfOpen(fallRange.startInclusive, fallRange.endExclusive, '2026-01-31T23:59:59+08:00')).toBe(true);
    expect(instantInHalfOpen(fallRange.startInclusive, fallRange.endExclusive, '2026-01-31T16:00:00Z')).toBe(false);
  });

  test('T09 snapshot generation time cannot be claimed as data as of', () => {
    expect(() => buildTemporalContext({
      metricId: 'snapshot.exam_cell_rank_b2',
      temporalContractId: 'TC-SNAPSHOT-VERSION',
      boundaries: {
        snapshotVersion: 'global-synthetic-v1',
        snapshotGeneratedAt: { value: '2026-04-01T01:00:00+08:00', role: 'data_as_of' },
      },
    })).toThrow(expect.objectContaining({ code: 'TEMPORAL_SEMANTIC_MISMATCH' }));
  });

  test('T10 same CEFR on different instruments is not full comparability', () => {
    const bestep = buildTemporalContext({
      metricId: 'snapshot.gse_raw_delta',
      temporalContractId: 'TC-EXAM-SESSION',
      boundaries: { instrument: 'BESTEP', snapshotVersion: 'snap-synthetic' },
    });
    const toeic = buildTemporalContext({
      metricId: 'snapshot.gse_raw_delta',
      temporalContractId: 'TC-EXAM-SESSION',
      boundaries: { instrument: 'TOEIC', snapshotVersion: 'snap-synthetic' },
    });
    const verdict = evaluateTemporalCompatibility({
      leftContext: bestep,
      rightContext: toeic,
      comparisonType: 'cefr_label',
    });
    expect(verdict.status).toBe('undetermined');
    expect(verdict.fullAnalysisComparability).not.toBe('compatible');
    expect(verdict.scope).toBe('temporal_only');
  });

  test('T11 semester without an exam date is low precision', () => {
    const context = buildTemporalContext({
      metricId: 'bestep.file.four_skill_cefr_b2',
      temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
      boundaries: { fileSemester: { semesterId: '114-2' } },
    });
    expect(context.precision.assessment).toBe('semester');
    expect(context.boundaries.assessmentDate).toBeUndefined();
    const verdict = evaluateTemporalCompatibility({
      leftContext: context,
      rightContext: context,
      comparisonType: 'assessment_precision',
    });
    expect(verdict.status).toBe('undetermined');
    expect(verdict.reason).toBe('insufficient_time_precision');
  });

  test('T12 different temporal contracts are incompatible for an event-period comparison', () => {
    const cast = eventContext('ops.reservation.checkin_row_rate', 'TC-OPS-DATE-SEMESTER', '114-2');
    const raw = eventContext('ops.roster.distinct_checkin_rate', 'TC-OPS-DATE-STRING', '114-2');
    const verdict = evaluateTemporalCompatibility({
      leftContext: cast,
      rightContext: raw,
      comparisonType: 'same_event_period',
    });
    expect(verdict.status).toBe('incompatible');
    expect(cast.comparisonMode).toBe('cast_date');
    expect(raw.comparisonMode).toBe('string_between');
  });

  test('T13 unknown metric is rejected', () => {
    expect(() => buildTemporalContext({
      metricId: 'not.a.metric',
      temporalContractId: 'TC-OPS-DATE-SEMESTER',
      boundaries: { eventSemesterRange: { semesterId: '114-2' } },
    })).toThrow(expect.objectContaining({ code: 'METRIC_NOT_FOUND' }));
  });

  test('T14 unknown temporal contract is rejected', () => {
    expect(() => buildTemporalContext({
      metricId: 'ops.event.count',
      temporalContractId: 'TC-NOT-REAL',
      boundaries: {},
    })).toThrow(expect.objectContaining({ code: 'TEMPORAL_CONTRACT_NOT_FOUND' }));
  });

  test('T15 metric and contract combination that is not registered is rejected', () => {
    expect(() => buildTemporalContext({
      metricId: 'ops.event.count',
      temporalContractId: 'TC-TRACE-ROLLING-30D',
      boundaries: { rollingDays: 30, windowEnd: '2026-04-01T00:00:00+08:00' },
    })).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_TEMPORAL_CONTRACT' }));
  });

  test('T16 unapproved policy windows stay undetermined', () => {
    const context = buildTemporalContext({
      metricId: 'roster.pair_pass.listening_reading',
      temporalContractId: 'TC-ROSTER-LIFETIME-DEFAULT',
      boundaries: {
        rosterSemester: { semesterId: '114-2' },
        policyKey: 'pair-bothcefr-samedate-g24',
      },
    });
    const verdict = evaluateTemporalCompatibility({
      leftContext: context,
      rightContext: context,
      comparisonType: 'policy_window',
    });
    expect(verdict.status).toBe('undetermined');
    expect(verdict.reason).toBe('policy_not_approved');
    expect(context.claims.officialUseAllowed).toBe(false);
  });

  test('T17 timestamp without a timezone is rejected', () => {
    expect(() => buildTemporalContext({
      metricId: 'bestep.file.skill_score',
      temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
      boundaries: {
        fileSemester: { semesterId: '114-2' },
        importTime: '2026-06-01T08:00:00',
      },
    })).toThrow(expect.objectContaining({ code: 'INVALID_DATE_FORMAT' }));
  });

  test('T18 impossible calendar dates are rejected', () => {
    expect(() => buildTemporalContext({
      metricId: 'bestep.file.skill_level',
      temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
      boundaries: {
        fileSemester: { semesterId: '114-2' },
        assessmentDate: '2026-02-30',
      },
    })).toThrow(expect.objectContaining({ code: 'INVALID_DATE_FORMAT' }));
  });

  test('T19 changing the process timezone does not change the window', () => {
    const script = [
      "const { buildTemporalContext } = require('./analytics-contracts/temporalContextBuilder');",
      "const ctx = buildTemporalContext({ metricId: 'ops.event.count', temporalContractId: 'TC-OPS-DATE-SEMESTER', boundaries: { eventSemesterRange: { semesterId: '114-2' } } });",
      "process.stdout.write(ctx.boundaries.eventSemesterRange.startInclusive + '|' + ctx.boundaries.eventSemesterRange.endExclusive);",
    ].join('');
    const run = (tz) => spawnSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      env: { ...process.env, TZ: tz },
      encoding: 'utf8',
    });
    const utc = run('UTC');
    const other = run('Pacific/Kiritimati');
    expect(utc.status).toBe(0);
    expect(other.status).toBe(0);
    expect(utc.stdout).toBe('2026-02-01T00:00:00+08:00|2026-08-01T00:00:00+08:00');
    expect(other.stdout).toBe(utc.stdout);
  });

  test('T20 repeated builds match and the result cannot be rewritten', () => {
    const range = { semesterId: '114-2' };
    const first = buildTemporalContext({
      metricId: 'ops.event.count',
      temporalContractId: 'TC-OPS-DATE-SEMESTER',
      source: 'synthetic',
      boundaries: { eventSemesterRange: range },
    });
    range.semesterId = '113-2';
    const second = buildTemporalContext({
      metricId: 'ops.event.count',
      temporalContractId: 'TC-OPS-DATE-SEMESTER',
      source: 'synthetic',
      boundaries: { eventSemesterRange: { semesterId: '114-2' } },
    });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.boundaries.eventSemesterRange.semesterId).toBe('114-2');
    expect(validateTemporalContext(first).ok).toBe(true);
    expect(() => {
      first.boundaries.eventSemesterRange.startInclusive = '2020-01-01T00:00:00+08:00';
    }).toThrow(TypeError);
  });
});
