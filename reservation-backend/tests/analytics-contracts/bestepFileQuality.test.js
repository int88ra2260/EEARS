'use strict';

const fs = require('fs');
const path = require('path');
const {
  evaluateBestepFileQuality,
  ContractRegistryError,
  listMetricDefinitions,
  listTemporalContracts,
  listDomains,
  listDecisionGates,
  BESTEP_FILE_QUALITY_FINDINGS,
} = require('../../analytics-contracts');

const STUDENT = 'SYNTH-STUDENT-9';
const NAME = '合成甲';
const EMAIL = 'person@example.com';
const SKILLS = ['listening', 'reading', 'speaking', 'writing'];

function score(overrides = {}) {
  return {
    id: '1',
    studentId: STUDENT,
    studentName: NAME,
    email: EMAIL,
    semester: '114-2',
    examDate: '2026-04-15',
    importBatchId: 'batch-synth',
    listeningScore: 80,
    listeningLevel: 'B1',
    readingScore: 81,
    readingLevel: 'B1',
    speakingScore: 82,
    speakingLevel: 'B1',
    writingScore: 83,
    writingLevel: 'B1',
    ...overrides,
  };
}

function skillScores(row) {
  return SKILLS.map((skill) => ({
    skill,
    rawScore: row[`${skill}Score`],
    rawLevel: row[`${skill}Level`],
  }));
}

function projectionFor(row, overrides = {}) {
  return {
    targetTable: 'exam_attempts',
    dateProvenance: 'stated',
    row: {
      id: 'p1',
      studentId: row.studentId,
      studentName: row.studentName,
      email: row.email,
      examDate: row.examDate,
      semesterId: row.semester,
      sourceType: 'BESTEP',
      sourceRef: `bestep_exam_scores:${row.id}`,
      examVendor: 'BESTEP',
      rawPayload: { bestepExamScoreId: String(row.id), sync: true },
    },
    skillScores: skillScores(row),
    ...overrides,
  };
}

function complete(overrides = {}) {
  const row = score();
  return {
    pilotId: 'bestep-file-quality',
    fileSemester: '114-2',
    source: {
      importType: 'bestep_score_import',
      sourceFileId: 'file-synth-1',
      importRunId: 'run-synth-1',
    },
    rawFileRows: [score()],
    acceptedScoreRows: [row],
    skippedImportRows: [],
    attendanceRows: [{
      sourceRecordId: row.id,
      examType: 'LR',
      attended: true,
      examDate: row.examDate,
      studentId: STUDENT,
      studentName: NAME,
    }],
    registrationPopulation: { availability: 'provided', successRegistrationCount: 1 },
    projectionRecords: [projectionFor(row)],
    importHistory: { availability: 'provided', priorVersions: [] },
    ...overrides,
  };
}

function withScore(overrides, extra = {}) {
  const row = score(overrides);
  return complete({
    rawFileRows: [score(overrides)],
    acceptedScoreRows: [row],
    projectionRecords: [projectionFor(row)],
    ...extra,
  });
}

function finding(report, code) {
  return report.findings.find((row) => row.code === code);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach((item) => freeze(item));
  return Object.freeze(value);
}

function walkModules(mod, seen, hits) {
  if (!mod || seen.has(mod.id)) return;
  seen.add(mod.id);
  const name = mod.filename || '';
  if (/sequelize|[\\/]models[\\/]|[\\/]db\.js|mysql/i.test(name)) hits.push(name);
  (mod.children || []).forEach((child) => walkModules(child, seen, hits));
}

describe('BESTEP file quality shadow', () => {
  test('J01 complete four-skill accepted row', () => {
    const report = evaluateBestepFileQuality(complete());
    expect(report.pilotId).toBe('bestep-file-quality');
    expect(report.status).toBe('complete');
    expect(report.findings).toEqual([]);
    expect(report.dimensions.skillCompleteness.skillRows[0].skills).toEqual({
      listening: 'skill_present',
      reading: 'skill_present',
      speaking: 'skill_present',
      writing: 'skill_present',
    });
    expect(report.governance).toEqual({
      officialUseAllowed: false,
      causalClaimAllowed: false,
      sourcePriorityApplied: false,
      mergePerformed: false,
    });
  });

  test('J02 missing listening', () => {
    const report = evaluateBestepFileQuality(withScore({ listeningScore: null, listeningLevel: null }));
    expect(report.dimensions.skillCompleteness.skillRows[0].skills.listening).toBe('skill_missing');
    expect(finding(report, 'SKILL_SCORE_MISSING')).toBeTruthy();
    expect(finding(report, 'SKILL_CEFR_MISSING')).toBeTruthy();
    expect(report.counts.validSkillResults.value).toBe(3);
  });

  test('J03 missing reading', () => {
    const report = evaluateBestepFileQuality(withScore({ readingScore: null, readingLevel: null }));
    expect(report.dimensions.skillCompleteness.skillRows[0].skills.reading).toBe('skill_missing');
  });

  test('J04 missing speaking', () => {
    const report = evaluateBestepFileQuality(withScore({ speakingScore: null, speakingLevel: null }));
    expect(report.dimensions.skillCompleteness.skillRows[0].skills.speaking).toBe('skill_missing');
  });

  test('J05 missing writing', () => {
    const report = evaluateBestepFileQuality(withScore({ writingScore: null, writingLevel: null }));
    expect(report.dimensions.skillCompleteness.skillRows[0].skills.writing).toBe('skill_missing');
  });

  test('J06 score without CEFR', () => {
    const report = evaluateBestepFileQuality(withScore({ listeningLevel: null }));
    expect(report.dimensions.skillCompleteness.skillRows[0].skills.listening).toBe('cefr_missing');
    expect(finding(report, 'SKILL_CEFR_MISSING')).toBeTruthy();
    expect(finding(report, 'SKILL_SCORE_MISSING')).toBeUndefined();
  });

  test('J07 CEFR without score', () => {
    const report = evaluateBestepFileQuality(withScore({ listeningScore: null }));
    expect(report.dimensions.skillCompleteness.skillRows[0].skills.listening).toBe('score_missing');
    expect(finding(report, 'SKILL_SCORE_MISSING')).toBeTruthy();
    expect(finding(report, 'SKILL_CEFR_MISSING')).toBeUndefined();
  });

  test('J08 invalid CEFR', () => {
    const report = evaluateBestepFileQuality(withScore({ listeningLevel: 'HIGH' }));
    expect(report.dimensions.skillCompleteness.skillRows[0].skills.listening).toBe('invalid_value');
    expect(finding(report, 'SKILL_VALUE_INVALID').severity).toBe('warning');
  });

  test('J09 null source exam date stays null', () => {
    const report = evaluateBestepFileQuality(withScore({ examDate: null }));
    expect(report.dimensions.dateProvenance.rows[0].sourceAssessmentDate).toBeNull();
    expect(finding(report, 'SOURCE_EXAM_DATE_MISSING').severity).toBe('warning');
  });

  test('J10 projected date does not complete the source date', () => {
    const row = score({ examDate: null });
    const projection = projectionFor(row);
    projection.row.examDate = '2026-04-15';
    projection.dateProvenance = 'stated';
    const report = evaluateBestepFileQuality(complete({
      rawFileRows: [score({ examDate: null })],
      acceptedScoreRows: [row],
      projectionRecords: [projection],
    }));
    expect(report.dimensions.dateProvenance.rows[0].sourceAssessmentDate).toBeNull();
    expect(report.dimensions.dateProvenance.projections[0].kind).toBe('projection_date_present');
    expect(report.dimensions.dateProvenance.projections[0].projectedExamDate).toBe('2026-04-15');
  });

  test('J11 inferred projection date and sync sentinel', () => {
    const row = score({ examDate: null });
    const inferred = projectionFor(row);
    inferred.dateProvenance = 'inferred';
    inferred.row.examDate = '2026-05-01';
    const inferredReport = evaluateBestepFileQuality(complete({
      acceptedScoreRows: [row],
      rawFileRows: [score({ examDate: null })],
      projectionRecords: [inferred],
    }));
    expect(finding(inferredReport, 'PROJECTED_DATE_INFERRED').severity).toBe('warning');
    expect(inferredReport.dimensions.dateProvenance.rows[0].sourceAssessmentDate).toBeNull();

    const sentinel = projectionFor(score());
    sentinel.dateProvenance = 'stated';
    sentinel.row.examDate = '1970-01-01';
    const sentinelReport = evaluateBestepFileQuality(complete({ projectionRecords: [sentinel] }));
    expect(finding(sentinelReport, 'PROJECTED_DATE_INFERRED')).toBeTruthy();
    expect(sentinelReport.dimensions.dateProvenance.rows[0].sourceAssessmentDate).toBe('2026-04-15');
    expect(sentinelReport.dimensions.dateProvenance.projections[0].kind).toBe('projection_date_inferred');
  });

  test('J12 unknown date provenance is not treated as inferred', () => {
    const projection = projectionFor(score());
    delete projection.dateProvenance;
    const report = evaluateBestepFileQuality(complete({ projectionRecords: [projection] }));
    expect(finding(report, 'DATE_PROVENANCE_UNKNOWN').severity).toBe('unknown');
    expect(finding(report, 'PROJECTED_DATE_INFERRED')).toBeUndefined();
  });

  test('J13 attendance present is evidence', () => {
    const report = evaluateBestepFileQuality(complete());
    expect(report.dimensions.registrationAttendance.confirmedPresent).toBe(1);
    expect(finding(report, 'ATTENDANCE_CONFIRMED_ABSENT')).toBeUndefined();
    expect(finding(report, 'ATTENDANCE_UNKNOWN')).toBeUndefined();
  });

  test('J14 confirmed absence stays informational', () => {
    const report = evaluateBestepFileQuality(complete({
      attendanceRows: [{
        sourceRecordId: '1',
        examType: 'L',
        attended: false,
        examDate: '2026-04-15',
      }],
    }));
    expect(finding(report, 'ATTENDANCE_CONFIRMED_ABSENT').severity).toBe('informational');
    expect(report.dimensions.registrationAttendance.confirmedAbsent).toBe(1);
    expect(report.status).toBe('complete');
  });

  test('J15 omitted attendance stays unknown', () => {
    const input = complete();
    delete input.attendanceRows;
    const report = evaluateBestepFileQuality(input);
    expect(report.counts.attendanceItems.value).toBeNull();
    expect(report.counts.attendanceItems.availability).toBe('not_observed');
    expect(report.dimensions.registrationAttendance.confirmedAbsent).toBeNull();
    expect(finding(report, 'ATTENDANCE_UNKNOWN').severity).toBe('unknown');
    expect(finding(report, 'ATTENDANCE_CONFIRMED_ABSENT')).toBeUndefined();
  });

  test('J16 unmatched skip is not an accepted score', () => {
    const report = evaluateBestepFileQuality(complete({
      skippedImportRows: [{ code: 'STUDENT_NOT_FOUND', studentId: 'SYNTH-SKIP-7' }],
    }));
    expect(finding(report, 'IMPORT_ROW_SKIPPED_UNMATCHED').severity).toBe('warning');
    expect(report.counts.skippedScoreRows.value).toBe(1);
    expect(report.counts.acceptedScoreRows.value).toBe(1);
    expect(JSON.stringify(report)).not.toContain('SYNTH-SKIP-7');
  });

  test('J17 missing registration population does not create coverage', () => {
    const input = complete();
    delete input.registrationPopulation;
    const report = evaluateBestepFileQuality(input);
    expect(report.dimensions.registrationAttendance.coverage.calculated).toBe(false);
    expect(report.dimensions.registrationAttendance.coverage.rate).toBeNull();
    expect(finding(report, 'REGISTRATION_POPULATION_NOT_OBSERVED').severity).toBe('unknown');
  });

  test('J18 confirmed projection can still be content-consistent', () => {
    const report = evaluateBestepFileQuality(complete());
    expect(report.dimensions.projectionConsistency.checks[0]).toMatchObject({
      relationship: 'confirmed_projection',
      consistency: 'consistent',
      mergePerformed: false,
      sourcePriorityApplied: false,
    });
    expect(finding(report, 'PROJECTION_CONTENT_CONFLICT')).toBeUndefined();
  });

  test('J19 confirmed projection keeps the link when content conflicts', () => {
    const row = score();
    const projection = projectionFor(row);
    projection.skillScores[0].rawScore = 1;
    const report = evaluateBestepFileQuality(complete({ projectionRecords: [projection] }));
    expect(report.status).toBe('conflicting');
    expect(report.dimensions.projectionConsistency.checks[0].relationship).toBe('confirmed_projection');
    expect(report.dimensions.projectionConsistency.checks[0].consistency).toBe('conflicting');
    expect(finding(report, 'PROJECTION_CONTENT_CONFLICT').severity).toBe('warning');
    expect(report.governance.mergePerformed).toBe(false);
  });

  test('J20 possible duplicate is not merged or promoted to a confirmed link', () => {
    const row = score();
    const projection = projectionFor(row);
    delete projection.row.sourceRef;
    delete projection.row.rawPayload;
    const report = evaluateBestepFileQuality(complete({ projectionRecords: [projection] }));
    expect(report.dimensions.projectionConsistency.checks[0].relationship).toBe('possible_same_assessment');
    expect(report.governance.mergePerformed).toBe(false);
    expect(report.governance.sourcePriorityApplied).toBe(false);
    expect(report.counts.acceptedScoreRows.value).toBe(1);
    expect(report.counts.rawFileRows.value).toBe(1);
    expect(finding(report, 'POSSIBLE_DUPLICATE_UNMERGED').severity).toBe('informational');
    expect(finding(report, 'PROJECTION_CONTENT_CONFLICT')).toBeUndefined();
  });

  test('J21 collapsed B2+ is not restored', () => {
    const accepted = score({ listeningLevel: 'B2' });
    const raw = score({ listeningLevel: 'B2+' });
    const report = evaluateBestepFileQuality(complete({
      rawFileRows: [raw],
      acceptedScoreRows: [accepted],
      projectionRecords: [projectionFor(accepted)],
    }));
    expect(finding(report, 'SOURCE_INFORMATION_LOSS').severity).toBe('warning');
    expect(report.dimensions.informationLoss.restoredCefrPlus).toBe(false);
    expect(JSON.stringify(report)).not.toContain('B2+');
    expect(raw.listeningLevel).toBe('B2+');
  });

  test('J22 current rows are not an import history', () => {
    const input = {
      pilotId: 'bestep-file-quality',
      fileSemester: '114-2',
      source: {
        importType: 'bestep_score_import',
        sourceFileId: 'file-synth-1',
        importRunId: 'run-synth-1',
      },
      currentScoreRecords: [score({ id: '9' })],
    };
    const report = evaluateBestepFileQuality(input);
    expect(report.historicalImportQuality).toBe('not_observed');
    expect(report.counts.currentScoreRecords.value).toBe(1);
    expect(report.counts.acceptedScoreRows.value).toBeNull();
    expect(finding(report, 'REIMPORT_HISTORY_UNKNOWN').severity).toBe('unknown');
    expect(report.currentState.skillRows).toHaveLength(1);
  });

  test('J23 batch and current-state counts stay separate', () => {
    const report = evaluateBestepFileQuality(complete({
      currentScoreRecords: [score({ id: '2' }), score({ id: '3' })],
    }));
    expect(report.counts.acceptedScoreRows.value).toBe(1);
    expect(report.counts.currentScoreRecords.value).toBe(2);
    expect(report.counts.combined).toBeUndefined();
  });

  test('J24 missing import run is a traceability warning', () => {
    const input = complete();
    input.source.importRunId = null;
    const report = evaluateBestepFileQuality(input);
    expect(finding(report, 'IMPORT_RUN_UNKNOWN').severity).toBe('warning');
    expect(report.status).toBe('partial');
    expect(report.dimensions.skillCompleteness.skillRows[0].skills.listening).toBe('skill_present');
  });

  test('J25 missing source file is a traceability warning', () => {
    const input = complete();
    input.source.sourceFileId = null;
    const report = evaluateBestepFileQuality(input);
    expect(finding(report, 'SOURCE_FILE_UNKNOWN').severity).toBe('warning');
    expect(finding(report, 'FILE_SEMESTER_MISSING')).toBeUndefined();
    expect(report.status).toBe('partial');
  });

  test('J26 empty input is insufficient evidence and does not imply zero rows', () => {
    const report = evaluateBestepFileQuality({});
    expect(report.status).toBe('insufficient_evidence');
    expect(report.counts.acceptedScoreRows.value).toBeNull();
    expect(report.counts.attendanceItems.value).toBeNull();
    expect(report.counts.skippedScoreRows.value).toBeNull();
    expect(finding(report, 'FILE_SEMESTER_MISSING').severity).toBe('error');
    expect(report.dimensions.skillCompleteness.status).toBe('unknown');
  });

  test('J27 four skill observations are not four sittings', () => {
    const report = evaluateBestepFileQuality(complete());
    expect(report.counts.acceptedScoreRows.value).toBe(1);
    expect(report.counts.skillObservations.value).toBe(4);
    expect(report.counts.examSittings.value).toBeNull();
    expect(report.counts.uniqueStudentsInAcceptedRows.value).toBe(1);
    expect(report.limitations.map((row) => row.code)).toContain('SKILL_OBSERVATIONS_ARE_NOT_SITTINGS');
  });

  test('J28 evaluation does not modify the input', () => {
    const input = freeze(complete());
    const before = JSON.stringify(input);
    evaluateBestepFileQuality(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  test('J29 validator stays offline', () => {
    const file = fs.readFileSync(
      path.join(__dirname, '../../analytics-contracts/pilots/bestepFileQualityValidator.js'),
      'utf8',
    );
    expect(file).not.toMatch(/sequelize|models|mysql|bestepImportService|syncService/);
    const resolved = require.resolve('../../analytics-contracts/pilots/bestepFileQualityValidator');
    const hits = [];
    walkModules(require.cache[resolved], new Set(), hits);
    expect(hits).toEqual([]);
  });

  test('J30 no source priority is applied', () => {
    const row = score();
    const et = {
      targetTable: 'et_exam_attempts',
      dateProvenance: 'stated',
      row: {
        id: 'e1',
        studentId: row.studentId,
        testDate: row.examDate,
        examDate: row.examDate,
        examType: 'BESTEP',
        importBatchId: 'batch-synth',
        rawPayload: { bestepExamScoreId: String(row.id) },
      },
      skillScores: skillScores(row),
    };
    const report = evaluateBestepFileQuality(complete({
      projectionRecords: [projectionFor(row), et],
    }));
    expect(report.governance.sourcePriorityApplied).toBe(false);
    expect(report.dimensions.projectionConsistency.checks).toHaveLength(2);
    expect(report.authoritativeSource).toBeUndefined();
    expect(listDecisionGates().find((gate) => gate.decisionId === 'D11').status).toBe('pending');
  });

  test('J31 deduplication is not performed', () => {
    const row = score();
    const projection = projectionFor(row);
    delete projection.row.sourceRef;
    delete projection.row.rawPayload;
    const report = evaluateBestepFileQuality(complete({ projectionRecords: [projection] }));
    expect(report.governance.mergePerformed).toBe(false);
    expect(report.dimensions.projectionConsistency.checks).toHaveLength(1);
    expect(report.counts.acceptedScoreRows.value).toBe(1);
  });

  test('J32 report omits synthetic personal identifiers', () => {
    const report = evaluateBestepFileQuality(complete());
    const text = JSON.stringify(report);
    expect(text).not.toContain(STUDENT);
    expect(text).not.toContain(NAME);
    expect(text).not.toContain(EMAIL);
  });

  test('J33 contradictory input is rejected', () => {
    expect(() => evaluateBestepFileQuality({ pilotId: 'other-pilot' })).toThrow(ContractRegistryError);
    expect(() => evaluateBestepFileQuality({ attendanceRows: [{ attended: 'yes' }] })).toThrow(ContractRegistryError);
    expect(() => evaluateBestepFileQuality({ acceptedScoreRows: null })).toThrow(ContractRegistryError);
    expect(() => evaluateBestepFileQuality({
      projectionRecords: [{ targetTable: 'students', row: { id: '1' } }],
    })).toThrow(ContractRegistryError);
  });

  test('J34 missing collections are not zero values', () => {
    const zeroScore = evaluateBestepFileQuality(withScore({ listeningScore: 0 }));
    expect(zeroScore.dimensions.skillCompleteness.skillRows[0].skills.listening).toBe('skill_present');
    const omitted = complete();
    delete omitted.attendanceRows;
    const empty = complete({ attendanceRows: [] });
    expect(evaluateBestepFileQuality(omitted).counts.attendanceItems.value).toBeNull();
    expect(evaluateBestepFileQuality(empty).counts.attendanceItems.value).toBe(0);
    expect(evaluateBestepFileQuality(empty).counts.attendanceItems.availability).toBe('provided');
  });

  test('J35 batch quality does not claim historical import quality', () => {
    const ready = evaluateBestepFileQuality(complete());
    expect(ready.status).toBe('complete');
    expect(ready.historicalImportQuality).toBe('not_claimed');
    expect(ready.historicalImportQuality).not.toBe('complete');
    const empty = evaluateBestepFileQuality({});
    expect(empty.historicalImportQuality).toBe('not_observed');
    expect(empty.limitations.map((row) => row.code)).toContain('HISTORICAL_IMPORT_NOT_RECONSTRUCTED');
  });

  test('contract regression keeps registries and pending gates', () => {
    expect(listMetricDefinitions()).toHaveLength(32);
    expect(listTemporalContracts()).toHaveLength(9);
    expect(listDomains()).toHaveLength(7);
    expect(listDecisionGates()).toHaveLength(11);
    expect(listDecisionGates().every((gate) => gate.status === 'pending')).toBe(true);
    expect(BESTEP_FILE_QUALITY_FINDINGS.map((row) => row.code)).toEqual(expect.arrayContaining([
      'SOURCE_FILE_UNKNOWN',
      'IMPORT_RUN_UNKNOWN',
      'FILE_SEMESTER_MISSING',
      'SKILL_SCORE_MISSING',
      'SKILL_CEFR_MISSING',
      'SKILL_VALUE_INVALID',
      'SOURCE_EXAM_DATE_MISSING',
      'PROJECTED_DATE_INFERRED',
      'ATTENDANCE_UNKNOWN',
      'ATTENDANCE_CONFIRMED_ABSENT',
      'IMPORT_ROW_SKIPPED_UNMATCHED',
      'PROJECTION_UNVERIFIED',
      'PROJECTION_CONTENT_CONFLICT',
      'SOURCE_INFORMATION_LOSS',
      'REIMPORT_HISTORY_UNKNOWN',
    ]));
  });
});
