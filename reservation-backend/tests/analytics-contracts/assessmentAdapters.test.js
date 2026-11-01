'use strict';

const { adaptExamAttempt, adaptEtExamAttempt } = require('../../analytics-contracts');

describe('assessment adapters', () => {
  test('disagreement between sourceRef and payload id is a conflict, not a link', () => {
    const [row] = adaptExamAttempt({
      id: 7,
      studentId: 's001',
      examDate: '2026-04-02',
      sourceType: 'BESTEP',
      examVendor: 'BESTEP',
      sourceRef: 'bestep_exam_scores:1',
      rawPayload: { bestepExamScoreId: 2, sync: true },
    }, {
      skillScores: [{ skill: 'listening', rawScore: 1, rawLevel: 'B1' }],
    });
    expect(row.sourceIdentity.upstreamSource).toBeNull();
    expect(row.qualityFlags).toContain('SOURCE_CONFLICT');
    expect(row.result.normalizedScore).toBeNull();
  });

  test('disagreeing et date columns are kept and not promoted to one official date', () => {
    const [row] = adaptEtExamAttempt({
      id: 8,
      studentId: 's001',
      examType: 'BESTEP',
      testDate: '2026-04-02',
      examDate: '2026-04-03',
      importBatchId: 'batch-et',
    }, {
      skillScores: [{ skill: 'speaking', rawScore: 70, cefr: 'B1' }],
    });
    expect(row.assessment.assessmentDate).toBeNull();
    expect(row.assessment.dateProvenance).toBe('columns_disagree');
    expect(row.provenance.officialAssessmentDate).toBe('unknown');
    expect(row.provenance.testDate).toBe('2026-04-02');
    expect(row.provenance.examDate).toBe('2026-04-03');
    expect(row.provenance.intraRecordDateConflict).toBe(true);
    expect(row.sourceIdentity.upstreamSource).toBeNull();
  });

  test('sync sentinel 1970-01-01 is not treated as an observed exam date', () => {
    const [row] = adaptExamAttempt({
      id: 9,
      studentId: 's001',
      semesterId: '114-2',
      examDate: '1970-01-01',
      sourceType: 'BESTEP',
      sourceRef: 'bestep_exam_scores:3',
      rawPayload: { bestepExamScoreId: 3, sync: true },
    }, {
      skillScores: [{ skill: 'listening', rawScore: null, rawLevel: null }],
    });
    expect(row.assessment.assessmentDate).toBeNull();
    expect(row.assessment.dateProvenance).toBe('sync_fallback_sentinel');
    expect(row.qualityFlags).toContain('INFERRED_ASSESSMENT_DATE');
  });
});
