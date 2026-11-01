'use strict';

const fs = require('fs');
const path = require('path');
const {
  adaptBestepScore,
  adaptExamAttempt,
  adaptEtExamAttempt,
  compareAssessmentObservations,
  compareAssessmentObservationsDetailed,
  listMetricDefinitions,
  listTemporalContracts,
  listDomains,
  listDecisionGates,
} = require('../../analytics-contracts');

function bestep(overrides) {
  return adaptBestepScore({
    id: 10,
    studentId: 's001',
    semester: '114-2',
    examDate: '2026-04-02',
    listeningScore: 80,
    listeningLevel: 'B2',
    readingScore: 70,
    readingLevel: 'B1',
    speakingScore: 60,
    speakingLevel: 'B1',
    writingScore: 50,
    writingLevel: 'A2',
    importBatchId: 'batch-a',
    studentName: 'synthetic',
    ...overrides,
  });
}

function listening(overrides) {
  return bestep(overrides).find((row) => row.result.skill === 'listening');
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

describe('assessment contract hardening H01–H20', () => {
  test('H01 same source key and skill with matching content', () => {
    const verdict = compareAssessmentObservations(listening(), listening());
    expect(verdict.identity.relationship).toBe('same_source_record');
    expect(verdict.identity.confidence).toBe('confirmed');
    expect(verdict.consistency.status).toBe('consistent');
    expect(verdict.relationship).toBe('same_source_record');
    expect(verdict.duplicateAssessment.status).toBe('not_applicable');
  });

  test('H02 same source key and skill with different scores keeps the identity', () => {
    const verdict = compareAssessmentObservations(listening(), listening({ listeningScore: 10 }));
    expect(verdict.identity.relationship).toBe('same_source_record');
    expect(verdict.consistency.status).toBe('conflicting');
    expect(verdict.consistency.differences.map((item) => item.field)).toContain('rawScore');
    expect(verdict.relationship).toBe('conflicting');
    expect(verdict.requiresReview).toBe(true);
  });

  test('H03 same source key and skill with different CEFR keeps the identity', () => {
    const verdict = compareAssessmentObservations(listening(), listening({ listeningLevel: 'A2' }));
    expect(verdict.identity.relationship).toBe('same_source_record');
    expect(verdict.consistency.status).toBe('conflicting');
    expect(verdict.consistency.differences.map((item) => item.field)).toContain('cefrLevel');
  });

  test('H04 confirmed projection with matching content', () => {
    const projected = exam({
      id: 30,
      sourceType: 'BESTEP',
      sourceRef: 'bestep_exam_scores:10',
      rawPayload: { bestepExamScoreId: 10, sync: true },
    });
    const verdict = compareAssessmentObservations(listening(), projected);
    expect(verdict.identity.relationship).toBe('confirmed_projection');
    expect(verdict.consistency.status).toBe('consistent');
    expect(verdict.relationship).toBe('confirmed_projection');
    expect(verdict.requiresReview).toBe(false);
  });

  test('H05 confirmed projection with conflicting content keeps the link', () => {
    const projected = exam({
      id: 31,
      sourceType: 'BESTEP',
      sourceRef: 'bestep_exam_scores:10',
      rawPayload: { bestepExamScoreId: 10, sync: true },
    }, { rawScore: 10, rawLevel: 'A2' });
    const verdict = compareAssessmentObservations(listening(), projected);
    expect(verdict.identity.relationship).toBe('confirmed_projection');
    expect(verdict.identity.confidence).toBe('confirmed');
    expect(verdict.consistency.status).toBe('conflicting');
    expect(verdict.relationship).toBe('conflicting');
    expect(verdict.reasons).toEqual(expect.arrayContaining(['projection_link', 'result_mismatch']));
  });

  test('H06 equal content and different source ids stay a possible duplicate', () => {
    const verdict = compareAssessmentObservations(listening(), exam({ id: 41, sourceType: 'EXTERNAL' }));
    expect(verdict.identity.relationship).toBe('possible_same_assessment');
    expect(verdict.identity.confidence).toBe('candidate');
    expect(verdict.consistency.status).toBe('consistent');
    expect(verdict.relationship).toBe('possible_duplicate');
    expect(verdict.duplicateAssessment.status).toBe('possible');
    expect(verdict.identity.relationship).not.toBe('same_source_record');
  });

  test('H07 the same numeric id in different tables is not the same source', () => {
    const other = exam({ id: 10, sourceType: 'EXTERNAL' });
    const verdict = compareAssessmentObservations(listening(), other);
    expect(listening().sourceIdentity.sourceRecordId).toBe('10');
    expect(other.sourceIdentity.sourceRecordId).toBe('10');
    expect(listening().sourceIdentity.recordNamespace).toBe('bestep_exam_scores:10');
    expect(other.sourceIdentity.recordNamespace).toBe('exam_attempts:10');
    expect(verdict.identity.relationship).toBe('possible_same_assessment');
    expect(verdict.identity.evidence).toContain('table_namespace_differs');
    expect(verdict.identity.relationship).not.toBe('same_source_record');
  });

  test('H08 one source row becomes four skill observations', () => {
    const rows = bestep();
    expect(rows).toHaveLength(4);
    const namespaces = new Set(rows.map((row) => row.sourceIdentity.recordNamespace));
    const observationIds = new Set(rows.map((row) => row.observationId));
    expect(namespaces).toEqual(new Set(['bestep_exam_scores:10']));
    expect(observationIds.size).toBe(4);
    const listeningRow = rows.find((row) => row.result.skill === 'listening');
    const readingRow = rows.find((row) => row.result.skill === 'reading');
    const verdict = compareAssessmentObservations(listeningRow, readingRow);
    expect(verdict.identity.relationship).toBe('distinct');
    expect(verdict.consistency.status).toBe('not_comparable');
  });

  test('H09 a confirmed projection with a missing score is not a content conflict', () => {
    const projected = exam({
      id: 32,
      sourceType: 'BESTEP',
      sourceRef: 'bestep_exam_scores:10',
      rawPayload: { bestepExamScoreId: 10, sync: true },
    }, { rawScore: null });
    const verdict = compareAssessmentObservations(listening(), projected);
    expect(verdict.identity.relationship).toBe('confirmed_projection');
    expect(verdict.consistency.status).toBe('insufficient_data');
    expect(verdict.relationship).toBe('confirmed_projection');
    expect(verdict.requiresReview).toBe(true);
  });

  test('H10 a score change keeps the source and observation identity', () => {
    const before = listening();
    const after = listening({ listeningScore: 11, listeningLevel: 'B1' });
    expect(before.observationId).toBe(after.observationId);
    expect(before.sourceIdentity.recordNamespace).toBe(after.sourceIdentity.recordNamespace);
    expect(before.sourceIdentity.sourceRecordVersion).toBe('unknown');
    expect(after.sourceIdentity.sourceRecordVersion).toBe('unknown');
    const verdict = compareAssessmentObservations(before, after);
    expect(verdict.identity.relationship).toBe('same_source_record');
    expect(verdict.consistency.status).toBe('conflicting');
  });

  test('H11 testDate and examDate are both retained when they disagree', () => {
    const [row] = adaptEtExamAttempt({
      id: 8,
      studentId: 's001',
      examType: 'BESTEP',
      testDate: '2026-04-02',
      examDate: '2026-04-03',
      importBatchId: 'batch-et',
    }, {
      skillScores: [{ skill: 'listening', rawScore: 80, cefr: 'B2' }],
    });
    expect(row.assessment.assessmentDate).toBeNull();
    expect(row.provenance.officialAssessmentDate).toBe('unknown');
    expect(row.provenance.testDate).toBe('2026-04-02');
    expect(row.provenance.examDate).toBe('2026-04-03');
    const verdict = compareAssessmentObservations(listening(), row);
    expect(verdict.identity.relationship).toBe('undetermined');
    expect(verdict.consistency.status).toBe('insufficient_data');
  });

  test('H12 a confirmed sync projection treats 1970-01-01 as a sentinel', () => {
    const [row] = adaptExamAttempt({
      id: 9,
      studentId: 's001',
      examDate: '1970-01-01',
      sourceType: 'BESTEP',
      sourceRef: 'bestep_exam_scores:10',
      rawPayload: { bestepExamScoreId: 10, sync: true },
    }, {
      skillScores: [{ skill: 'listening', rawScore: 80, rawLevel: 'B2' }],
    });
    expect(row.assessment.assessmentDate).toBeNull();
    expect(row.assessment.dateProvenance).toBe('sync_fallback_sentinel');
    expect(row.sourceIdentity.upstreamSource.sourceRecordId).toBe('10');
    const verdict = compareAssessmentObservations(listening(), row);
    expect(verdict.identity.relationship).toBe('confirmed_projection');
    expect(verdict.consistency.status).toBe('consistent');
  });

  test('H13 a 1970-01-01 without a confirmed sync link stays a stated date', () => {
    const [manual] = adaptExamAttempt({
      id: 12,
      studentId: 's001',
      examDate: '1970-01-01',
      sourceType: 'MANUAL',
      examVendor: 'BESTEP',
    }, {
      skillScores: [{ skill: 'listening', rawScore: 80, rawLevel: 'B2' }],
    });
    const [unlinked] = adaptExamAttempt({
      id: 13,
      studentId: 's001',
      examDate: '1970-01-01',
      sourceType: 'BESTEP',
      examVendor: 'BESTEP',
    }, {
      skillScores: [{ skill: 'listening', rawScore: 80, rawLevel: 'B2' }],
    });
    expect(manual.assessment.assessmentDate).toBe('1970-01-01');
    expect(manual.assessment.dateProvenance).toBe('exam_attempts.exam_date');
    expect(unlinked.assessment.assessmentDate).toBe('1970-01-01');
    expect(unlinked.assessment.dateProvenance).not.toBe('sync_fallback_sentinel');
  });

  test('H14 a missing source key stays unknown', () => {
    const row = listening({ id: null });
    expect(row.sourceIdentity.sourceRecordId).toBeNull();
    expect(row.sourceIdentity.recordNamespace).toBeNull();
    expect(row.qualityFlags).toContain('UNKNOWN_SOURCE_IDENTITY');
    const verdict = compareAssessmentObservations(row, listening());
    expect(verdict.identity.relationship).toBe('undetermined');
    expect(verdict.relationship).toBe('undetermined');
  });

  test('H15 swapping observations keeps identity and consistency', () => {
    const left = listening({ listeningScore: 10 });
    const right = listening();
    const forward = compareAssessmentObservationsDetailed(left, right);
    const backward = compareAssessmentObservationsDetailed(right, left);
    expect(forward).toEqual(backward);
    expect(forward.identity.relationship).toBe('same_source_record');
    expect(forward.consistency.status).toBe('conflicting');
  });

  test('H16 the legacy comparison still reports a conflict without dropping identity', () => {
    const verdict = compareAssessmentObservations(listening(), listening({ listeningScore: 10 }));
    expect(verdict.relationship).toBe('conflicting');
    expect(verdict.conflicts.map((item) => item.field)).toContain('rawScore');
    expect(verdict.mergePerformed).toBe(false);
    expect(verdict.sourcePriorityApplied).toBe(false);
    expect(verdict.identity.relationship).toBe('same_source_record');
    expect(verdict.consistency.status).toBe('conflicting');
  });

  test('H17 a stored B2 is not restored to B2+', () => {
    const row = listening({ listeningLevel: 'B2' });
    expect(row.result.cefrLevel).toBe('B2');
    expect(row.result.originalCefrLevel).toBeNull();
    expect(row.qualityFlags).not.toContain('NORMALIZED_CEFR_LOSS');
    expect(JSON.stringify(row)).not.toContain('B2+');
  });

  test('H18 registry ids and gates stay unchanged', () => {
    const metrics = listMetricDefinitions();
    expect(metrics).toHaveLength(32);
    expect(listTemporalContracts()).toHaveLength(9);
    expect(listDomains()).toHaveLength(7);
    expect(listDecisionGates().map((gate) => gate.decisionId)).toEqual([
      'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11',
    ]);
    expect(listDecisionGates().every((gate) => gate.status === 'pending')).toBe(true);
    expect(metrics.filter((row) => row.implementationStatus === 'not_implemented').map((row) => row.metricId).sort())
      .toEqual(['ops.participation.streak', 'roster.pair_pass.both_pairs']);
    expect(metrics.every((row) => row.officialUseAllowed === false && row.causalClaimAllowed === false)).toBe(true);
  });

  test('H19 adapters do not mutate their inputs', () => {
    const bestepInput = Object.freeze({
      id: 15,
      studentId: 's001',
      semester: '114-2',
      examDate: '2026-04-02',
      listeningScore: 80,
      listeningLevel: 'B2',
    });
    const examInput = Object.freeze({
      id: 16,
      studentId: 's001',
      examDate: '2026-04-02',
      sourceType: 'MANUAL',
      examVendor: 'BESTEP',
    });
    const etInput = Object.freeze({
      id: 17,
      studentId: 's001',
      testDate: '2026-04-02',
      examType: 'BESTEP',
    });
    const before = [bestepInput, examInput, etInput].map((row) => JSON.stringify(row));
    adaptBestepScore(bestepInput);
    adaptExamAttempt(examInput, { skillScores: [{ skill: 'listening', rawScore: 80, rawLevel: 'B2' }] });
    adaptEtExamAttempt(etInput, { skillScores: [{ skill: 'listening', rawScore: 80, cefr: 'B2' }] });
    expect([bestepInput, examInput, etInput].map((row) => JSON.stringify(row))).toEqual(before);
  });

  test('H20 the contract module loads without the database or scheduler', () => {
    const entry = require.resolve('../../analytics-contracts');
    const seen = new Set();
    const names = [];
    function walk(mod) {
      if (!mod || seen.has(mod)) return;
      seen.add(mod);
      if (mod.filename) names.push(mod.filename);
      (mod.children || []).forEach(walk);
    }
    walk(require.cache[entry]);
    const loaded = names.join('\n');
    expect(loaded).not.toMatch(/[\\/]models[\\/]/);
    expect(loaded).not.toMatch(/[\\/]db\.js$/m);
    expect(loaded).not.toMatch(/node_modules[\\/]sequelize[\\/]/);
    expect(loaded).not.toMatch(/[\\/]server\.js$/m);
    const server = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
    expect(server).not.toContain('analytics-contracts');
  });
});
