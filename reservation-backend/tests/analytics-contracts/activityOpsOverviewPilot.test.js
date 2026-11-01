'use strict';

const fs = require('fs');
const path = require('path');
const {
  describeActivityOpsOverview,
  resolveResponseField,
  assertEventTimeField,
  describeMetricBinding,
  listMetricDefinitions,
  listTemporalContracts,
  listDomains,
  listDecisionGates,
  ContractRegistryError,
} = require('../../analytics-contracts');
const { SEMESTER_RANGES } = require('../../../shared/semesterConfig');

const SEMESTER = '114-2';

function shadow() {
  return describeActivityOpsOverview({ semesterId: SEMESTER });
}

function field(name, report = shadow()) {
  return report.fields.find((row) => row.responseField === name);
}

describe('activity ops overview pilot P01–P15', () => {
  test('P01 114-2 event window uses the configured half-open bounds', () => {
    const report = shadow();
    expect(report.timeComparison.contractStartInclusive).toBe('2026-02-01T00:00:00+08:00');
    expect(report.timeComparison.contractEndExclusive).toBe('2026-08-01T00:00:00+08:00');
    expect(report.timeComparison.timezone).toBe('Asia/Taipei');
    const reservations = field('totalReservations', report);
    expect(reservations.temporalContext.boundaries.eventSemesterRange.endExclusive)
      .toBe('2026-08-01T00:00:00+08:00');
  });

  test('P02 the semester window comes from shared semester config', () => {
    const report = shadow();
    expect(SEMESTER_RANGES[SEMESTER]).toEqual({ start: '2026-02-01', end: '2026-07-31' });
    expect(report.timeComparison.legacyStartInclusive).toBe(SEMESTER_RANGES[SEMESTER].start);
    expect(report.timeComparison.legacyEndInclusive).toBe(SEMESTER_RANGES[SEMESTER].end);
  });

  test('P03 legacy response fields keep their own metric ids', () => {
    expect(field('totalReservations').metricId).toBe('ops.reservation.row_count');
    expect(field('bookingRate').metricId).toBe('ops.capacity.reservation_over_seats');
    expect(field('attendanceRate').metricId).toBe('ops.reservation.checkin_row_rate');
    expect(field('englishPassRate').metricId).toBe('ops.registration.legacy_has_cefr_b2');
    expect(field('englishPassRate').temporalContractId).toBe('TC-BESTEP-FILE-SEMESTER');
  });

  test('P04 reservation rows are not described as distinct students', () => {
    const attendance = field('attendanceRate');
    expect(attendance.analysisUnit).toBe('reservation_row');
    expect(attendance.metricId).not.toBe('ops.roster.distinct_checkin_students');
    expect(attendance.populationDefinition).toContain('不是不重複學生');
    expect(field('totalReservations').analysisUnit).toBe('reservation_row');
  });

  test('P05 event date and created at are not interchangeable', () => {
    expect(assertEventTimeField('events.date').interchangeableWithCreatedAt).toBe(false);
    expect(() => assertEventTimeField('reservations.createdAt')).toThrow(ContractRegistryError);
    try {
      assertEventTimeField('reservations.createdAt');
    } catch (err) {
      expect(err.code).toBe('TEMPORAL_SEMANTIC_MISMATCH');
    }
  });

  test('P06 a missing semester boundary is rejected', () => {
    expect(() => describeActivityOpsOverview({})).toThrow(ContractRegistryError);
    try {
      describeActivityOpsOverview({});
    } catch (err) {
      expect(err.code).toBe('MISSING_REQUIRED_BOUNDARY');
    }
  });

  test('P07 an unsupported metric or temporal contract is rejected', () => {
    expect(() => describeMetricBinding('no.such.metric', 'TC-OPS-DATE-SEMESTER', SEMESTER))
      .toThrow(ContractRegistryError);
    try {
      describeMetricBinding('ops.reservation.row_count', 'TC-BESTEP-FILE-SEMESTER', SEMESTER);
    } catch (err) {
      expect(err.code).toBe('UNSUPPORTED_TEMPORAL_CONTRACT');
    }
    try {
      describeMetricBinding('ops.participation.streak', 'TC-OPS-DATE-SEMESTER', SEMESTER);
    } catch (err) {
      expect(err.code).toBe('UNSUPPORTED_TEMPORAL_CONTRACT');
    }
  });

  test('P08 an unknown legacy field is left unmapped', () => {
    const unknown = resolveResponseField('distinctStudents');
    expect(unknown.mappingStatus).toBe('unmapped');
    expect(unknown.metricId).toBeNull();
    expect(field('violationRate').mappingStatus).toBe('unmapped');
    expect(field('violationRate').metricId).toBeNull();
    expect(field('totalEventCapacity').metricId).toBeNull();
    expect(field('capacityBreakdown').metricId).toBeNull();
  });

  test('P09 a caller working set does not replace the full-center population', () => {
    const report = describeActivityOpsOverview({
      semesterId: SEMESTER,
      populationScope: 'class_working_set',
    });
    expect(report.populationScope).toBe('full_center');
    expect(report.populationNote).toContain('class_working_set');
    expect(report.access).toContain('requireFullCenterAnalytics');
  });

  test('P10 the shadow adapter does not change the input object', () => {
    const legacyResult = Object.freeze({
      semester: SEMESTER,
      totalReservations: 17,
      attendanceRate: 50,
      capacityBreakdown: Object.freeze({ summary: Object.freeze({ reservedCount: 17 }) }),
    });
    const before = JSON.stringify(legacyResult);
    describeActivityOpsOverview({ semesterId: SEMESTER, legacyResult });
    expect(JSON.stringify(legacyResult)).toBe(before);
  });

  test('P11 the legacy result values stay outside the metadata', () => {
    const legacyResult = {
      semester: SEMESTER,
      totalReservations: 17,
      attendanceRate: 50,
      violationRate: 3,
    };
    const report = describeActivityOpsOverview({ semesterId: SEMESTER, legacyResult });
    expect(legacyResult.totalReservations).toBe(17);
    expect(JSON.stringify(report)).not.toContain('17');
    expect(report.countsRecomputed).toBe(false);
    expect(field('totalReservations', report).legacyValuePresent).toBe(true);
  });

  test('P12 the pilot module does not execute SQL', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../analytics-contracts/pilots/activityOpsOverviewPilot.js'),
      'utf8',
    );
    expect(source).not.toMatch(/require\([^)]*sequelize/);
    expect(source).not.toMatch(/require\([^)]*analyticsService/);
    expect(source).not.toContain('sequelize.query');
    const report = shadow();
    expect(report.sqlExecuted).toBe(false);
  });

  test('P13 the inclusive legacy end and the half-open contract end stay distinct', () => {
    const report = shadow();
    expect(report.timeComparison.legacyEndInclusive).toBe('2026-07-31');
    expect(report.timeComparison.contractEndExclusive).toBe('2026-08-01T00:00:00+08:00');
    expect(report.timeComparison.mysqlEquivalenceVerified).toBe(false);
    expect(report.timeComparison.compatibilityStatus).toBe('legacy_inclusive_cast_vs_half_open_unverified');
    expect(report.verificationStatus).toBe('synthetic_contract_only');
  });

  test('P14 registry governance stays unchanged', () => {
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

  test('P15 the mounted overview response is still the service payload', () => {
    const controller = fs.readFileSync(
      path.join(__dirname, '../../controllers/analyticsController.js'),
      'utf8',
    );
    const server = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
    const overview = controller.slice(
      controller.indexOf('async function getOverview'),
      controller.indexOf('async function getTeacherDashboard'),
    );
    expect(overview).toContain('res.json(data)');
    expect(overview).not.toContain('analytics-contracts');
    expect(overview).not.toContain('metricId');
    expect(server).not.toContain('analytics-contracts');
    const legacyResult = { totalReservations: 4, attendanceRate: 1 };
    const report = describeActivityOpsOverview({ semesterId: SEMESTER, legacyResult });
    expect(Object.keys(legacyResult).sort()).toEqual(['attendanceRate', 'totalReservations']);
    expect(report.legacyApi).toBe('GET /api/analytics/overview?semester={semester}&kind=reservation');
  });
});
