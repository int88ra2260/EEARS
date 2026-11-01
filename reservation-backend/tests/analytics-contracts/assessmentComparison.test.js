'use strict';

const { adaptBestepScore, adaptExamAttempt, compareAssessmentObservations } = require('../../analytics-contracts');

describe('assessment comparison', () => {
  test('a projection link does not hide a score conflict', () => {
    const [source] = adaptBestepScore({
      id: 4,
      studentId: 's001',
      semester: '114-2',
      examDate: '2026-04-02',
      listeningScore: 90,
      listeningLevel: 'B2',
      importBatchId: 'batch-a',
    }).filter((row) => row.result.skill === 'listening');
    const [projected] = adaptExamAttempt({
      id: 5,
      studentId: 's001',
      examDate: '2026-04-02',
      sourceType: 'BESTEP',
      examVendor: 'BESTEP',
      sourceRef: 'bestep_exam_scores:4',
      rawPayload: { bestepExamScoreId: 4, sync: true },
    }, {
      importBatchId: 'batch-b',
      skillScores: [{ skill: 'listening', rawScore: 10, rawLevel: 'A2' }],
    });
    const verdict = compareAssessmentObservations(source, projected);
    expect(verdict.relationship).toBe('conflicting');
    expect(verdict.reasons).toEqual(expect.arrayContaining(['projection_link', 'result_mismatch']));
    expect(verdict.sourcePriorityApplied).toBe(false);
  });
});
