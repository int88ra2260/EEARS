'use strict';

const {
  buildExportColumns,
  toCsv,
  withUtf8Bom,
  csvEscape,
} = require('../services/learningJourney/analytics/researchExportService');

describe('researchExportService csv helpers', () => {
  it('unions student and exam columns', () => {
    const rows = [
      { record_type: 'student', student_id: 'S001', department: '資訊工程學系' },
      { record_type: 'exam', student_id: 'S001', exam_date: '2025-01-01', instrument: 'BESTEP' },
    ];
    const columns = buildExportColumns(rows);
    expect(columns).toContain('department');
    expect(columns).toContain('exam_date');
    expect(columns).toContain('instrument');
    expect(columns.indexOf('record_type')).toBeLessThan(columns.indexOf('exam_date'));
  });

  it('escapes booleans and Chinese text', () => {
    expect(csvEscape(true)).toBe('TRUE');
    expect(csvEscape(false)).toBe('FALSE');
    expect(csvEscape('資訊工程學系')).toBe('資訊工程學系');
  });

  it('adds utf-8 bom once', () => {
    const csv = withUtf8Bom(toCsv(
      [{ record_type: 'student', student_id: 'S001', department: '外文系' }],
      ['record_type', 'student_id', 'department']
    ));
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('外文系');
    expect(withUtf8Bom(csv).charCodeAt(0)).toBe(0xFEFF);
  });
});
