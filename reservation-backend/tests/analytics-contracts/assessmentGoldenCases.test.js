'use strict';

const {
  adaptBestepScore,
  adaptExamAttempt,
  compareAssessmentObservations,
  listMetricDefinitions,
  listDecisionGates,
  listTemporalContracts,
} = require('../../analytics-contracts');

function bestep(overrides) {
  return adaptBestepScore({
    id: 10,
    studentId: 's001',
    semester: '114-2',
    examDate: '2026-04-02',
    listeningScore: 80,
    listeningLevel: 'B2',
    readingScore: 81,
    readingLevel: 'B2',
    speakingScore: 82,
    speakingLevel: 'B2',
    writingScore: 83,
    writingLevel: 'B2',
    importBatchId: 'batch-a',
    studentName: 'should-not-matter',
    ...overrides,
  }).find((row) => row.result.skill === (overrides && overrides.skill || 'listening'));
}

function exam(overrides, skillOverrides) {
  return adaptExamAttempt({
    id: 20,
    studentId: 's001',
    semesterId: '114-2',
    examDate: '2026-04-02',
    sourceType: 'MANUAL',
    examVendor: 'BESTEP',
    ...overrides,
  }, {
    importBatchId: 'batch-b',
    skillScores: [{
      skill: 'listening',
      rawScore: 80,
      rawLevel: 'B2',
      ...skillOverrides,
    }],
  })[0];
}

describe('assessment golden cases A01–A20', () => {
  test('A01 same source primary key and skill', () => {
    const verdict = compareAssessmentObservations(bestep(), bestep());
    expect(verdict.relationship).toBe('same_source_record');
    expect(verdict.mergePerformed).toBe(false);
  });

  test('A02 same student, day, instrument and skill without a source link', () => {
    const verdict = compareAssessmentObservations(bestep(), exam({ id: 21, sourceType: 'EXTERNAL' }));
    expect(verdict.relationship).toBe('possible_duplicate');
    expect(verdict.qualityFlags).toContain('POSSIBLE_DUPLICATE');
    expect(verdict.sourcePriorityApplied).toBe(false);
  });

  test('A03 same student and different observed dates', () => {
    const verdict = compareAssessmentObservations(bestep(), exam({ examDate: '2026-05-01' }));
    expect(verdict.relationship).toBe('distinct');
    expect(verdict.reasons).toContain('different_assessment_date');
  });

  test('A04 BESTEP row and exam attempt with an explicit source ref', () => {
    const projected = exam({
      id: 30,
      sourceType: 'BESTEP',
      sourceRef: 'bestep_exam_scores:10',
      rawPayload: { bestepExamScoreId: 10, sync: true },
    });
    const verdict = compareAssessmentObservations(bestep(), projected);
    expect(verdict.relationship).toBe('confirmed_projection');
    expect(projected.sourceIdentity.upstreamSource.sourceRecordId).toBe('10');
  });

  test('A05 BESTEP-typed attempt without a source id stays unverified', () => {
    const loose = exam({ id: 31, sourceType: 'BESTEP', sourceRef: null, rawPayload: {} });
    expect(loose.qualityFlags).toContain('UNVERIFIED_PROJECTION');
    const verdict = compareAssessmentObservations(bestep(), loose);
    expect(verdict.relationship).toBe('possible_duplicate');
    expect(verdict.relationship).not.toBe('confirmed_projection');
    expect(verdict.qualityFlags).toContain('UNVERIFIED_PROJECTION');
  });

  test('A06 same source identity with different scores conflicts', () => {
    const other = bestep({ listeningScore: 10 });
    const verdict = compareAssessmentObservations(bestep(), other);
    expect(verdict.relationship).toBe('conflicting');
    expect(verdict.conflicts.map((item) => item.field)).toContain('rawScore');
    expect(verdict.requiresReview).toBe(true);
  });

  test('A07 same CEFR on different instruments is not merged', () => {
    const toeic = exam({ id: 40, examVendor: 'TOEIC', sourceType: 'EXTERNAL' });
    const verdict = compareAssessmentObservations(bestep(), toeic);
    expect(verdict.relationship).toBe('distinct');
    expect(verdict.qualityFlags).toContain('INSTRUMENT_NOT_COMPARABLE');
    expect(verdict.mergePerformed).toBe(false);
  });

  test('A08 different sources with different scores stay in conflict', () => {
    const verdict = compareAssessmentObservations(
      bestep(),
      exam({ id: 41, sourceType: 'EXTERNAL' }, { rawScore: 10 }),
    );
    expect(verdict.relationship).toBe('conflicting');
    expect(verdict.sourcePriorityApplied).toBe(false);
    expect(verdict.conflicts[0].values).toEqual(['10', '80']);
  });

  test('A09 missing exam date stays null', () => {
    const row = adaptBestepScore({
      id: 11,
      studentId: 's001',
      listeningScore: 1,
      listeningLevel: 'B1',
    })[0];
    expect(row.assessment.assessmentDate).toBeNull();
    expect(row.qualityFlags).toContain('MISSING_ASSESSMENT_DATE');
  });

  test('A10 semester label is not expanded into an exam date', () => {
    const row = adaptBestepScore({
      id: 12,
      studentId: 's001',
      semester: '114-2',
      listeningLevel: 'B1',
      listeningScore: 1,
    })[0];
    expect(row.assessment.assessmentDate).toBeNull();
    expect(row.assessment.datePrecision).toBe('semester');
    expect(row.assessment.fileSemester).toBe('114-2');
    expect(row.qualityFlags).toContain('SEMESTER_ONLY_DATE');
  });

  test('A11 a caller-marked inferred date is not an observed date', () => {
    const inferred = adaptBestepScore({
      id: 13,
      studentId: 's001',
      semester: '114-2',
      examDate: '2026-04-02',
      listeningScore: 80,
      listeningLevel: 'B2',
    }, { dateProvenance: 'inferred' })[0];
    expect(inferred.assessment.datePrecision).toBe('inferred');
    expect(inferred.qualityFlags).toContain('INFERRED_ASSESSMENT_DATE');
    const verdict = compareAssessmentObservations(bestep(), inferred);
    expect(verdict.relationship).toBe('undetermined');
    expect(verdict.reasons).toContain('insufficient_date_precision');
  });

  test('A12 B2+ is kept as original and folded only in the normalized field', () => {
    const row = bestep({ listeningLevel: 'B2+' });
    expect(row.result.originalCefrLevel).toBe('B2+');
    expect(row.result.cefrLevel).toBe('B2');
    expect(row.qualityFlags).toContain('NORMALIZED_CEFR_LOSS');
  });

  test('A13 stored B2 is not restored to B2+', () => {
    const row = bestep({ listeningLevel: 'B2' });
    expect(row.result.cefrLevel).toBe('B2');
    expect(row.result.originalCefrLevel).toBeNull();
    expect(row.qualityFlags).not.toContain('NORMALIZED_CEFR_LOSS');
  });

  test('A14 missing raw score is flagged', () => {
    expect(bestep({ listeningScore: null }).qualityFlags).toContain('MISSING_RAW_SCORE');
  });

  test('A15 missing CEFR is flagged', () => {
    expect(bestep({ listeningLevel: null }).qualityFlags).toContain('MISSING_CEFR_LEVEL');
  });

  test('A16 missing source id is unknown and not a duplicate match', () => {
    const row = bestep({ id: null });
    expect(row.qualityFlags).toContain('UNKNOWN_SOURCE_IDENTITY');
    expect(compareAssessmentObservations(row, bestep()).relationship).toBe('undetermined');
  });

  test('A17 different skills are not deduplicated', () => {
    const rows = adaptBestepScore({
      id: 14,
      studentId: 's001',
      semester: '114-2',
      examDate: '2026-04-02',
      listeningScore: 80,
      listeningLevel: 'B2',
      readingScore: 80,
      readingLevel: 'B2',
      importBatchId: 'batch-a',
    });
    const listening = rows.find((item) => item.result.skill === 'listening');
    const reading = rows.find((item) => item.result.skill === 'reading');
    expect(compareAssessmentObservations(listening, reading).relationship).toBe('distinct');
  });

  test('A18 different students on the same day stay distinct', () => {
    const verdict = compareAssessmentObservations(bestep(), exam({ studentId: 's002' }));
    expect(verdict.relationship).toBe('distinct');
    expect(verdict.reasons).toContain('different_student');
  });

  test('A19 adapter does not change the input row', () => {
    const input = Object.freeze({
      id: 15,
      studentId: 's001',
      semester: '114-2',
      examDate: '2026-04-02',
      listeningScore: 80,
      listeningLevel: 'B2',
      readingScore: null,
      readingLevel: null,
      speakingScore: null,
      speakingLevel: null,
      writingScore: null,
      writingLevel: null,
    });
    const before = JSON.stringify(input);
    adaptBestepScore(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(() => {
      input.listeningScore = 0;
    }).toThrow(TypeError);
  });

  test('A20 swapping the two observations keeps the same verdict', () => {
    const left = bestep();
    const right = exam({ id: 42, sourceType: 'EXTERNAL' }, { rawScore: 10, rawLevel: 'B1' });
    expect(compareAssessmentObservations(left, right)).toEqual(compareAssessmentObservations(right, left));
  });

  test('registry counts from phase 4A stay in place', () => {
    expect(listMetricDefinitions()).toHaveLength(32);
    expect(listTemporalContracts()).toHaveLength(9);
    expect(listDecisionGates().every((gate) => gate.status === 'pending')).toBe(true);
    expect(listMetricDefinitions().every((row) => row.officialUseAllowed === false)).toBe(true);
    expect(listMetricDefinitions().every((row) => row.causalClaimAllowed === false)).toBe(true);
  });
});
