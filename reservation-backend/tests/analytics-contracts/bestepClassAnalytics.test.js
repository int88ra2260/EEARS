'use strict';

const fs = require('fs');
const path = require('path');
const {
  listBestepClassAnalyticsFields,
  getBestepClassAnalyticsField,
  evaluateBestepClassAnalytics,
  listMetricDefinitions,
  listTemporalContracts,
  listDomains,
  listDecisionGates,
} = require('../../analytics-contracts');

const STUDENT = 'SYN-L-1';
const NAME = '合成乙';
const EMAIL = 'person@example.com';

function score(overrides = {}) {
  return {
    listeningScore: 0,
    readingScore: 11,
    speakingScore: 12,
    writingScore: 13,
    listeningLevel: 'B2',
    readingLevel: 'B2',
    speakingLevel: 'B2',
    writingLevel: 'B2',
    totalScore: 36,
    overallLevel: 'B2',
    passed: true,
    ...overrides,
  };
}

function response(overrides = {}) {
  return {
    classInfo: {
      classId: 1,
      className: '合成班',
      semester: '114-1',
      teacherName: '合成師',
    },
    statistics: {
      totalStudents: 2,
      domesticStudentCount: 1,
      registeredCount: 1,
      registrationRate: 25,
      totalExamCount: 4,
      registrationDenominator: 4,
      attendedSlots: 1,
      totalRegistrationExamSlots: 4,
      attendanceRate: 25,
      lrAttendanceRate: 50,
      sAttendanceRate: null,
      wAttendanceRate: null,
      lrTotalSlots: 2,
      lrAttendedSlots: 1,
      sTotalSlots: 1,
      sAttendedSlots: 0,
      wTotalSlots: 1,
      wAttendedSlots: 0,
      fullAttendanceCount: 0,
      passedCount: 1,
      passRate: 100,
      avgScore: 36,
    },
    students: [{
      studentId: STUDENT,
      studentName: NAME,
      department: '外文',
      email: EMAIL,
      grade: '1',
      personalRegistration: {
        status: 'success',
        regId: 9,
        examType: 'LRSW',
        examTypeLabel: '聽讀說寫',
        updatedAt: '2026-01-01',
        exemptionType: null,
        exemption_review_status: null,
        exemptionVerifiedType: null,
      },
      groupRegistration: {
        teamId: 3,
        teamName: '合成隊',
        role: 'member',
        teamStatus: 'approved',
        rank: null,
        rewardAmount: null,
      },
      attendance: {
        L: { attended: true, examDate: '2026-03-01', absentReason: null },
      },
      score: score(),
    }],
    pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    ...overrides,
  };
}

function evaluate(body, extra = {}) {
  return evaluateBestepClassAnalytics({
    response: body,
    queryContext: { semester: '114-1', examType: 'all', page: 1, pageSize: 50 },
    ...extra,
  });
}

describe('BESTEP class analytics semantic pilot', () => {
  test('L01 field contract loads without new registry ids', () => {
    const fields = listBestepClassAnalyticsFields();
    expect(fields.length).toBeGreaterThan(40);
    expect(new Set(fields.map((row) => row.fieldPath)).size).toBe(fields.length);
    expect(fields.every((row) => row.pilotId === 'bestep-class-analytics')).toBe(true);
    const known = new Set(listMetricDefinitions().map((row) => row.metricId));
    fields.forEach((row) => {
      if (row.metricId) expect(known.has(row.metricId)).toBe(true);
      if (row.proposedMetricId) expect(known.has(row.proposedMetricId)).toBe(false);
    });
    expect(listMetricDefinitions()).toHaveLength(32);
    expect(listTemporalContracts()).toHaveLength(9);
  });

  test('L02 L04 L30 legacy response fields are classified and query context is not a metric', () => {
    const body = response();
    const before = JSON.stringify(body);
    const diagnostic = evaluate(body);
    expect(JSON.stringify(body)).toBe(before);
    expect(diagnostic.unknownFields).toEqual([]);
    expect(diagnostic.classifiedFields).toBeGreaterThan(40);
    expect(getBestepClassAnalyticsField('pagination.page').semanticType).toBe('query_context');
    expect(getBestepClassAnalyticsField('pagination.page').metricId).toBeNull();
    expect(diagnostic.recalculated).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(body, 'diagnostics')).toBe(false);
  });

  test('L03 an unknown nested field is reported by path only', () => {
    const body = response();
    body.statistics.notARealField = 1;
    const diagnostic = evaluate(body);
    expect(diagnostic.unknownFields).toContain('statistics.notARealField');
    expect(diagnostic.status).toBe('partial');
  });

  test('L05 L06 L07 L08 grains stay distinct', () => {
    expect(getBestepClassAnalyticsField('statistics.registeredCount').analysisUnit).toBe('student');
    expect(getBestepClassAnalyticsField('statistics.totalExamCount').analysisUnit).toBe('registration_component');
    expect(getBestepClassAnalyticsField('statistics.attendedSlots').analysisUnit).toBe('attendance_item');
    expect(getBestepClassAnalyticsField('statistics.fullAttendanceCount').analysisUnit).toBe('student');
    expect(getBestepClassAnalyticsField('students[].score.listeningScore').analysisUnit).toBe('skill_observation');
    expect(getBestepClassAnalyticsField('students[].score.listeningScore').limitations).toContain('not_an_exam_sitting');
    expect(getBestepClassAnalyticsField('statistics.totalStudents').analysisUnit).toBe('class_membership');
    expect(getBestepClassAnalyticsField('statistics.domesticStudentCount').populationDefinition).toContain('不是 false');
    const diagnostic = evaluate(response());
    expect(diagnostic.examSittings).toBeNull();
  });

  test('L09 L10 L11 L12 attendance tri-state is not turned into a rate', () => {
    const present = evaluate(response());
    expect(present.attendanceEvidence.confirmedPresent).toBe('observed');
    expect(present.recalculated).toBe(false);

    const absent = response();
    absent.students[0].attendance = {
      S: { attended: false, examDate: null, absentReason: null },
    };
    expect(evaluate(absent).attendanceEvidence.confirmedAbsent).toBe('observed');

    const unknown = response();
    unknown.students[0].attendance = {
      W: { attended: null, examDate: null, absentReason: null },
    };
    const unknownDiagnostic = evaluate(unknown);
    expect(unknownDiagnostic.attendanceEvidence.unknown).toBe('observed');
    expect(unknownDiagnostic.attendanceEvidence.confirmedAbsent).toBe('not_observed');
    expect(unknownDiagnostic.absentCount).toBeUndefined();
    expect(unknownDiagnostic.attendanceRate).toBeUndefined();
  });

  test('L13 L14 different legacy rates do not get recalculated', () => {
    const low = response();
    const high = response();
    high.statistics.attendanceRate = 90;
    high.statistics.passRate = 10;
    const left = evaluate(low);
    const right = evaluate(high);
    expect(left).toEqual(right);
    expect(JSON.stringify(left)).not.toContain('90');
    expect(JSON.stringify(left)).not.toContain('25');
    expect(left.recalculated).toBe(false);
  });

  test('L15 L16 L17 plus, registration flag, and formal B2 stay separate', () => {
    const diagnostic = evaluate(response(), {
      claims: { restoreStoredPlus: true, registrationHasCefrB2: true },
    });
    expect(diagnostic.warnings.map((row) => row.code)).toEqual(expect.arrayContaining([
      'PLUS_NOT_RESTORED',
      'REGISTRATION_B2_FLAG_IS_NOT_FOUR_SKILL_PASS',
    ]));
    expect(JSON.stringify(diagnostic)).not.toContain('B2+');
    expect(getBestepClassAnalyticsField('statistics.passRate').metricId).toBe('bestep.file.four_skill_cefr_b2');
    expect(getBestepClassAnalyticsField('statistics.passRate').limitations).toContain('not_formal_b2_kpi');
    expect(getBestepClassAnalyticsField('statistics.passRate').limitations).toContain('not_ops.roster.bestep_pass_over_attendance');
    expect(diagnostic.governance.officialUseAllowed).toBe(false);
  });

  test('L18 L19 L23 file semester, exam date, and class semester stay distinct', () => {
    const diagnostic = evaluate(response(), {
      claims: { fileSemesterEqualsExamDate: true },
      queryContext: { semester: '114-2' },
    });
    expect(diagnostic.warnings.map((row) => row.code)).toEqual(expect.arrayContaining([
      'FILE_SEMESTER_IS_NOT_EXAM_DATE',
      'SOURCE_ASSESSMENT_DATE_UNKNOWN',
      'TEMPORAL_CONTRACT_GAP',
    ]));
    expect(diagnostic.sourceEvidence.scoreAssessmentDate).toBe('unknown');
    expect(getBestepClassAnalyticsField('students[].score.listeningLevel').temporalContractId).toBe('TC-BESTEP-FILE-SEMESTER');
  });

  test('L20 L21 sources and projection states are not merged', () => {
    const diagnostic = evaluate(response(), {
      sourceNotes: {
        records: [
          { sourceId: 'bestep_exam_scores' },
          { sourceId: 'exam_attempts' },
        ],
      },
      claims: { confirmedProjection: true, possibleDuplicate: true },
    });
    expect(diagnostic.warnings.map((row) => row.code)).toEqual(expect.arrayContaining([
      'MULTIPLE_SOURCES_NOT_MERGED',
      'CONFIRMED_PROJECTION',
      'POSSIBLE_DUPLICATE',
    ]));
    expect(diagnostic.sourceEvidence.mergedSources).toBe(false);
    expect(diagnostic.governance.mergePerformed).toBe(false);
    expect(diagnostic.governance.sourcePriorityApplied).toBe(false);
  });

  test('L22 unmapped and proposed metrics stay outside the registry', () => {
    const avg = getBestepClassAnalyticsField('statistics.avgScore');
    expect(avg.metricId).toBeNull();
    expect(avg.metricMapping).toBe('proposed');
    const attendance = getBestepClassAnalyticsField('statistics.attendanceRate');
    expect(attendance.metricId).toBeNull();
    expect(attendance.metricMapping).toBe('proposed');
    expect(listMetricDefinitions().some((row) => row.metricId === attendance.proposedMetricId)).toBe(false);
    const diagnostic = evaluate(response());
    expect(diagnostic.unmappedFields).toContain('statistics.totalStudents');
    expect(diagnostic.proposedFields).toContain('statistics.attendanceRate');
  });

  test('L24 L25 L27 evaluation does not mutate or copy personal values', () => {
    const body = response();
    const frozenStudent = Object.freeze(body.students[0]);
    body.students[0] = frozenStudent;
    const before = JSON.stringify(body);
    const diagnostic = evaluate(body);
    expect(JSON.stringify(body)).toBe(before);
    expect(frozenStudent.studentName).toBe(NAME);
    const text = JSON.stringify(diagnostic);
    expect(text).not.toContain(STUDENT);
    expect(text).not.toContain(NAME);
    expect(text).not.toContain(EMAIL);
  });

  test('L26 L28 the pilot does not touch the database and governance stays closed', () => {
    const validator = fs.readFileSync(path.join(__dirname, '../../analytics-contracts/pilots/bestepClassAnalyticsValidator.js'), 'utf8');
    const contract = fs.readFileSync(path.join(__dirname, '../../analytics-contracts/pilots/bestepClassAnalyticsContract.js'), 'utf8');
    expect(validator).not.toContain('sequelize');
    expect(validator).not.toContain('require(\'../models\')');
    expect(contract).not.toContain('sequelize');
    const service = fs.readFileSync(path.join(__dirname, '../../services/bestepClassService.js'), 'utf8');
    const controller = fs.readFileSync(path.join(__dirname, '../../controllers/bestepClassController.js'), 'utf8');
    expect(service).not.toContain('evaluateBestepClassAnalytics');
    expect(controller).not.toContain('evaluateBestepClassAnalytics');
    const diagnostic = evaluate(response());
    expect(diagnostic.governance).toEqual({
      officialUseAllowed: false,
      causalClaimAllowed: false,
      sourcePriorityApplied: false,
      mergePerformed: false,
    });
    expect(listDomains()).toHaveLength(7);
    expect(listDecisionGates()).toHaveLength(11);
    expect(listDecisionGates().every((gate) => gate.status === 'pending')).toBe(true);
    expect(listMetricDefinitions().filter((row) => row.implementationStatus === 'not_implemented')).toHaveLength(2);
  });

  test('L29 broken nested values stay inside a partial diagnostic', () => {
    const diagnostic = evaluateBestepClassAnalytics({
      response: {
        statistics: { attendanceRate: 'bad' },
        students: [{ attendance: null, score: 'bad' }],
      },
    });
    expect(diagnostic.status).toBe('partial');
    expect(diagnostic.warnings.map((row) => row.code)).toEqual(expect.arrayContaining([
      'MISSING_FIELD',
      'TYPE_MISMATCH',
    ]));
    expect(evaluateBestepClassAnalytics({ response: null }).status).toBe('undetermined');
  });
});
