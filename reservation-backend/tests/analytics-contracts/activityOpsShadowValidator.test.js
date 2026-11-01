'use strict';

const fs = require('fs');
const path = require('path');
const {
  getActivityOpsFieldCard,
  halfOpenFromConfiguredSemester,
  inspectActivityOpsFieldBinding,
  isActivityOpsShadowEnabled,
  listActivityOpsFieldCards,
  listDecisionGates,
  listDomains,
  listMetricDefinitions,
  listProposedActivityOpsMetrics,
  listTemporalContracts,
  PROPOSED_VIOLATION_METRIC_ID,
  runActivityOpsShadow,
  validateActivityOpsOverview,
} = require('../../analytics-contracts');
const validator = require('../../analytics-contracts/pilots/activityOpsShadowValidator');

function sampleOverview() {
  return {
    semester: '114-2',
    totalReservations: 10,
    totalEventCapacity: 20,
    bookingRate: 50,
    attendanceRate: 40,
    violationRate: 5,
    englishPassRate: 12.5,
    capacityBreakdown: {
      semester: '114-2',
      range: { startDate: '2026-02-01', endDate: '2026-07-31' },
      items: [{
        eventType: 'english_table',
        reservedCount: 10,
        capacity: 20,
        utilizationRate: 50,
      }],
      summary: { reservedCount: 10, capacity: 20, utilizationRate: 50 },
      byEventType: [{
        eventType: 'english_table',
        totalEventCapacity: 20,
        totalReservations: 10,
        bookingRate: 50,
      }],
      byEvent: [{
        eventId: 9,
        eventName: 'Secret Session',
        eventDate: '2026-03-01 18:00:00',
        eventType: 'english_table',
        maxCapacity: 20,
        totalReservations: 10,
        bookingRate: 50,
      }],
    },
  };
}

function reportFor(legacyResult, semesterId = '114-2') {
  return validateActivityOpsOverview({ semesterId, legacyResult });
}

describe('activity ops field contract and shadow validator', () => {
  test('E01 shadow flag defaults off and production cannot enable it', () => {
    expect(isActivityOpsShadowEnabled({})).toBe(false);
    expect(isActivityOpsShadowEnabled({
      ANALYTICS_SEMANTIC_SHADOW_ENABLED: 'true',
      NODE_ENV: 'production',
    })).toBe(false);
    expect(isActivityOpsShadowEnabled({
      ANALYTICS_SEMANTIC_SHADOW_ENABLED: 'true',
    })).toBe(false);
    expect(isActivityOpsShadowEnabled({
      ANALYTICS_SEMANTIC_SHADOW_ENABLED: 'true',
      NODE_ENV: 'staging',
    })).toBe(true);
  });

  test('E02 flag off does not execute the validator', () => {
    const spy = jest.spyOn(validator, 'validateActivityOpsOverview');
    const payload = sampleOverview();
    const result = runActivityOpsShadow({ semesterId: '114-2', legacyResult: payload }, {});
    expect(result).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('E06 totalReservations maps to the reservation row metric', () => {
    const row = reportFor(sampleOverview()).fields.find((field) => field.fieldPath === 'totalReservations');
    expect(row.semanticType).toBe('metric');
    expect(row.metricId).toBe('ops.reservation.row_count');
    expect(row.temporalContractId).toBe('TC-OPS-DATE-SEMESTER');
  });

  test('E07 bookingRate maps to reservation rows over seats', () => {
    const row = reportFor(sampleOverview()).fields.find((field) => field.fieldPath === 'bookingRate');
    expect(row.metricId).toBe('ops.capacity.reservation_over_seats');
    expect(row.semanticType).toBe('metric');
  });

  test('E08 attendanceRate maps to the check-in row rate', () => {
    const row = reportFor(sampleOverview()).fields.find((field) => field.fieldPath === 'attendanceRate');
    expect(row.metricId).toBe('ops.reservation.checkin_row_rate');
    expect(getActivityOpsFieldCard('attendanceRate').analysisUnit).toBe('reservation_row');
  });

  test('E09 englishPassRate stays a cross-domain legacy supplement', () => {
    const report = reportFor(sampleOverview());
    const row = report.fields.find((field) => field.fieldPath === 'englishPassRate');
    expect(row.semanticType).toBe('legacy_supplement');
    expect(row.metricId).toBe('ops.registration.legacy_has_cefr_b2');
    expect(row.temporalContractId).toBe('TC-BESTEP-FILE-SEMESTER');
    expect(report.warnings.map((item) => item.code)).toContain('CROSS_DOMAIN_LEGACY_FIELD');
    expect(getActivityOpsFieldCard('englishPassRate').sourceTables).toEqual(['english_test_registrations']);
  });

  test('E10 semester is query context and has no metric id', () => {
    const row = reportFor(sampleOverview()).fields.find((field) => field.fieldPath === 'semester');
    expect(row.semanticType).toBe('query_context');
    expect(row.metricId).toBeNull();
  });

  test('E11 totalEventCapacity is the booking denominator, not a new metric', () => {
    const card = getActivityOpsFieldCard('totalEventCapacity');
    const row = reportFor(sampleOverview()).fields.find((field) => field.fieldPath === 'totalEventCapacity');
    expect(row.semanticType).toBe('derived_value');
    expect(row.metricId).toBeNull();
    expect(card.population).toMatch(/沒有預約/);
    expect(card.sourceTables).toEqual(['events']);
  });

  test('E12 violationRate keeps a proposed id outside the registry', () => {
    const report = reportFor(sampleOverview());
    const card = getActivityOpsFieldCard('violationRate');
    expect(card.semanticType).toBe('derived_value');
    expect(card.metricId).toBeNull();
    expect(card.proposedMetricId).toBe(PROPOSED_VIOLATION_METRIC_ID);
    expect(card.proposalStatus).toBe('PROPOSED');
    expect(report.unmappedFields).toContain('violationRate');
    expect(report.warnings.map((item) => item.code)).toContain('FIELD_UNMAPPED');
  });

  test('E13 capacityBreakdown children stay traceable', () => {
    const paths = listActivityOpsFieldCards().map((row) => row.fieldPath);
    expect(paths).toEqual(expect.arrayContaining([
      'capacityBreakdown',
      'capacityBreakdown.range.startDate',
      'capacityBreakdown.range.endDate',
      'capacityBreakdown.items[].eventType',
      'capacityBreakdown.items[].reservedCount',
      'capacityBreakdown.summary.utilizationRate',
      'capacityBreakdown.byEventType[].bookingRate',
      'capacityBreakdown.byEvent[].eventDate',
      'capacityBreakdown.byEvent[].maxCapacity',
    ]));
    expect(getActivityOpsFieldCard('capacityBreakdown').semanticType).toBe('breakdown');
    expect(getActivityOpsFieldCard('capacityBreakdown.byEvent[].eventName').semanticType).toBe('dimension');
  });

  test('E14 unknown response fields are detected without being registered', () => {
    const payload = sampleOverview();
    payload.distinctStudents = 3;
    const report = reportFor(payload);
    expect(report.errors.map((item) => item.code)).toContain('UNKNOWN_RESPONSE_FIELD');
    expect(report.errors.find((item) => item.fieldPath === 'distinctStudents').detail)
      .toBe('response field is not in the field contract');
    expect(listMetricDefinitions().some((row) => row.metricId === 'distinctStudents')).toBe(false);
  });

  test('E15 proposed violation metric is not added to the registry', () => {
    const before = listMetricDefinitions().map((row) => row.metricId);
    reportFor(sampleOverview());
    const after = listMetricDefinitions().map((row) => row.metricId);
    expect(after).toEqual(before);
    expect(after).not.toContain(PROPOSED_VIOLATION_METRIC_ID);
    expect(listProposedActivityOpsMetrics()[0].registryStatus).toBe('not_registered');
    expect(JSON.stringify(reportFor(sampleOverview()))).not.toContain(PROPOSED_VIOLATION_METRIC_ID);
  });

  test('E16 incompatible time models produce diagnostics', () => {
    const issues = inspectActivityOpsFieldBinding({
      fieldPath: 'totalReservations',
      metricId: 'ops.reservation.row_count',
      temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
      populationDefinition: '預約列',
      timeField: 'reservations.timestamp',
    });
    expect(issues.map((item) => item.code)).toEqual(expect.arrayContaining([
      'TEMPORAL_CONTRACT_MISMATCH',
      'UNSUPPORTED_TIME_COMPARISON',
    ]));
    expect(reportFor(sampleOverview()).warnings.map((item) => item.code))
      .toContain('UNSUPPORTED_TIME_COMPARISON');
  });

  test('E17 114-2 keeps the configured half-open boundary', () => {
    const window = halfOpenFromConfiguredSemester('114-2');
    expect(window.startInclusive).toBe('2026-02-01T00:00:00+08:00');
    expect(window.endExclusive).toBe('2026-08-01T00:00:00+08:00');
    expect(getActivityOpsFieldCard('capacityBreakdown.range.endDate').businessMeaning).toMatch(/2026-07-31/);
  });

  test('E18 shadow modules do not call SQL or the legacy service', () => {
    const dir = path.join(__dirname, '../../analytics-contracts/pilots');
    ['activityOpsShadowValidator.js', 'activityOpsShadowRuntime.js'].forEach((name) => {
      const source = fs.readFileSync(path.join(dir, name), 'utf8');
      expect(source).not.toMatch(/require\([^)]*sequelize/);
      expect(source).not.toMatch(/require\([^)]*analyticsService/);
      expect(source).not.toMatch(/sequelize\.query/);
      expect(source).not.toMatch(/getReservationOverview/);
    });
  });

  test('E19 validator does not modify the legacy object', () => {
    const payload = sampleOverview();
    const before = JSON.stringify(payload);
    reportFor(payload);
    expect(JSON.stringify(payload)).toBe(before);
    expect(Object.keys(payload).sort()).toEqual([
      'attendanceRate',
      'bookingRate',
      'capacityBreakdown',
      'englishPassRate',
      'semester',
      'totalEventCapacity',
      'totalReservations',
      'violationRate',
    ]);
  });

  test('E20 diagnostics omit student and activity values', () => {
    const payload = sampleOverview();
    payload.studentId = 'B12345678';
    payload.studentEmail = 'student@example.com';
    payload.authorization = 'Bearer secret-token';
    const text = JSON.stringify(reportFor(payload, 'B12345678'));
    expect(text).not.toContain('B12345678');
    expect(text).not.toContain('student@example.com');
    expect(text).not.toContain('Secret Session');
    expect(text).not.toContain('Bearer');
    expect(text).not.toContain('secret-token');
    expect(text).toContain('UNKNOWN_RESPONSE_FIELD');
  });

  test('E25 registry governance stays unchanged', () => {
    const metrics = listMetricDefinitions();
    expect(metrics).toHaveLength(32);
    expect(listTemporalContracts()).toHaveLength(9);
    expect(listDomains()).toHaveLength(7);
    expect(listDecisionGates()).toHaveLength(11);
    expect(listDecisionGates().every((gate) => gate.status === 'pending')).toBe(true);
    expect(metrics.filter((row) => row.implementationStatus === 'not_implemented').map((row) => row.metricId).sort())
      .toEqual(['ops.participation.streak', 'roster.pair_pass.both_pairs']);
    expect(metrics.every((row) => row.officialUseAllowed === false && row.causalClaimAllowed === false)).toBe(true);
  });

  test('missing population, unknown metric, null result, and bad breakdown are diagnosed', () => {
    expect(inspectActivityOpsFieldBinding({
      fieldPath: 'bookingRate',
      metricId: 'ops.capacity.reservation_over_seats',
      temporalContractId: 'TC-OPS-DATE-SEMESTER',
      populationDefinition: '',
    }).map((item) => item.code)).toContain('POPULATION_DEFINITION_MISSING');

    expect(inspectActivityOpsFieldBinding({
      fieldPath: 'violationRate',
      metricId: PROPOSED_VIOLATION_METRIC_ID,
      temporalContractId: 'TC-OPS-DATE-SEMESTER',
      populationDefinition: '預約列',
    }).map((item) => item.code)).toContain('METRIC_CONTRACT_NOT_FOUND');

    expect(reportFor(null).errors.map((item) => item.code)).toContain('UNVERIFIED_LEGACY_CALCULATION');
    expect(reportFor('not-an-object').status).toBe('error');

    const broken = sampleOverview();
    broken.capacityBreakdown = 'bad';
    expect(reportFor(broken).errors.find((item) => item.fieldPath === 'capacityBreakdown').code)
      .toBe('UNVERIFIED_LEGACY_CALCULATION');

    const badRow = sampleOverview();
    badRow.capacityBreakdown.items = ['not-a-row'];
    expect(reportFor(badRow).errors.map((item) => item.fieldPath)).toContain('capacityBreakdown.items[]');
  });

  test('every response card uses a known semantic type', () => {
    const allowed = new Set([
      'metric',
      'query_context',
      'dimension',
      'breakdown',
      'derived_value',
      'legacy_supplement',
      'unknown',
    ]);
    const cards = listActivityOpsFieldCards();
    expect(cards.length).toBeGreaterThan(8);
    expect(cards.every((row) => allowed.has(row.semanticType))).toBe(true);
    expect(cards.filter((row) => row.semanticType === 'metric').map((row) => row.fieldPath).sort())
      .toEqual(['attendanceRate', 'bookingRate', 'totalReservations']);
    expect(cards.filter((row) => row.semanticType === 'legacy_supplement')).toHaveLength(1);
  });
});
