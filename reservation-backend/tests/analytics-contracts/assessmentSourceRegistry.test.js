'use strict';

const fs = require('fs');
const path = require('path');
const { listAssessmentSources, QUALITY_FLAGS } = require('../../analytics-contracts');

describe('assessment source registry', () => {
  test('describes three tables and does not approve a source priority', () => {
    const sources = listAssessmentSources();
    expect(sources.map((row) => row.sourceTable)).toEqual([
      'bestep_exam_scores',
      'exam_attempts',
      'et_exam_attempts',
    ]);
    const text = JSON.stringify(sources);
    expect(text).not.toContain('"approved"');
    expect(text).toContain('UNKNOWN');
  });

  test('quality flags stay separate labels', () => {
    expect(QUALITY_FLAGS).toContain('NORMALIZED_CEFR_LOSS');
    expect(QUALITY_FLAGS).toContain('SOURCE_CONFLICT');
    expect(new Set(QUALITY_FLAGS).size).toBe(QUALITY_FLAGS.length);
  });

  test('adapters are not referenced by the server entry', () => {
    const server = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
    const adapter = fs.readFileSync(
      path.join(__dirname, '../../analytics-contracts/assessmentAdapters.js'),
      'utf8',
    );
    expect(server).not.toContain('analytics-contracts');
    expect(adapter).not.toContain('sequelize');
    expect(adapter).not.toContain('temporalContextBuilder');
  });
});
