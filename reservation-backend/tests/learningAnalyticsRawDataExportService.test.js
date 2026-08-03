'use strict';

const {
  buildRawDataExportWorkbook,
  hasStudentScopeFilters,
  MAX_EXPORT_STUDENTS,
  MAX_EXPORT_EXAMS,
} = require('../services/learningAnalytics/learningAnalyticsRawDataExportService');

jest.mock('../models', () => ({
  LjAnalyticStudent: { findAll: jest.fn() },
  LjAnalyticExam: { findAll: jest.fn(), findAndCountAll: jest.fn() },
}));

jest.mock('../services/learningJourney/analytics/timelineReadService', () => ({
  resolveLatestSnapshotVersion: jest.fn().mockResolvedValue('global-test|rules:v1'),
}));

const { LjAnalyticStudent, LjAnalyticExam } = require('../models');

describe('learningAnalyticsRawDataExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    LjAnalyticExam.findAll.mockResolvedValue([]);
  });

  it('detects student-scope filters', () => {
    expect(hasStudentScopeFilters({ cohort: '113' })).toBe(true);
    expect(hasStudentScopeFilters({ instrument: 'TOEIC' })).toBe(false);
  });

  it('builds students workbook with metadata sheet', async () => {
    LjAnalyticStudent.findAll.mockResolvedValue([
      { toJSON: () => ({ studentId: 'A001', cohort: '113', retestFlag: false }) },
    ]);

    const result = await buildRawDataExportWorkbook({
      dataset: 'students',
      snapshot_version: 'global-test|rules:v1',
      cohort: '113',
    });

    expect(result.dataset).toBe('students');
    expect(result.rowCount).toBe(1);
    expect(result.fileName).toMatch(/^EEARS_LA_raw-students_.*_snap-global-test_\d{8}_\d{4}\.xlsx$/);
    expect(result.workbook.worksheets.map((ws) => ws.name)).toEqual([
      '分析學生表',
      '匯出說明',
    ]);

    const buffer = await result.workbook.xlsx.writeBuffer();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('scopes exams export to filtered students', async () => {
    LjAnalyticStudent.findAll.mockResolvedValue([
      { studentId: 'A001', retestFlag: false, hasValidExam: true, baselineEnglishScore: 10, totalResourceHours: 5 },
    ]);
    LjAnalyticExam.findAndCountAll.mockResolvedValue({
      rows: [{ toJSON: () => ({ studentId: 'A001', instrument: 'TOEIC', skill: 'reading', examDate: '2024-01-01', rawScore: 500, excludeFlag: false, registeredNoScoreFlag: false }) }],
      count: 1,
    });
    LjAnalyticExam.findAll.mockResolvedValue([
      { toJSON: () => ({ studentId: 'A001', instrument: 'TOEIC', skill: 'reading', examDate: '2024-01-01', rawScore: 500, excludeFlag: false, registeredNoScoreFlag: false }) },
    ]);

    const result = await buildRawDataExportWorkbook({
      dataset: 'exams',
      snapshot_version: 'global-test|rules:v1',
      cohort: '113',
    });

    expect(LjAnalyticExam.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: MAX_EXPORT_EXAMS })
    );
    expect(result.rowCount).toBe(1);
    expect(result.workbook.worksheets[0].name).toBe('分析考試表');
  });

  it('returns empty exams export when scoped students are empty', async () => {
    LjAnalyticStudent.findAll.mockResolvedValue([]);

    const result = await buildRawDataExportWorkbook({
      dataset: 'exams',
      snapshot_version: 'global-test|rules:v1',
      cohort: '999',
    });

    expect(LjAnalyticExam.findAndCountAll).not.toHaveBeenCalled();
    expect(result.rowCount).toBe(0);
  });

  it('exports more than preview API limit (500) and caps at MAX_EXPORT_STUDENTS', async () => {
    const rows = Array.from({ length: MAX_EXPORT_STUDENTS + 10 }, (_, i) => ({
      toJSON: () => ({ studentId: `S${String(i).padStart(4, '0')}` }),
    }));
    LjAnalyticStudent.findAll.mockResolvedValue(rows);

    const result = await buildRawDataExportWorkbook({ dataset: 'students' });
    expect(LjAnalyticStudent.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ order: [['studentId', 'ASC']] })
    );
    expect(result.rowCount).toBe(MAX_EXPORT_STUDENTS);
    expect(result.truncated).toBe(true);
    expect(result.total).toBe(MAX_EXPORT_STUDENTS + 10);
  });

  it('exports all rows when total is between preview limit and export cap', async () => {
    const rows = Array.from({ length: 600 }, (_, i) => ({
      toJSON: () => ({ studentId: `S${String(i).padStart(4, '0')}` }),
    }));
    LjAnalyticStudent.findAll.mockResolvedValue(rows);

    const result = await buildRawDataExportWorkbook({ dataset: 'students' });
    expect(result.rowCount).toBe(600);
    expect(result.truncated).toBe(false);
    expect(result.total).toBe(600);
  });

  it('builds normalized ASCII filename with semester and snapshot', () => {
    const { buildExportFileName } = require('../services/learningAnalytics/learningAnalyticsRawDataExportService');
    const name = buildExportFileName('students', { semester: '114-2' }, 'global-20260615-v1|rules:x');
    expect(name).toMatch(/^EEARS_LA_raw-students_114-2_snap-global-20260615-v1_\d{8}_\d{4}\.xlsx$/);
  });
});
