'use strict';

const XLSX = require('xlsx');

jest.mock('../models', () => ({
  sequelize: {
    transaction: jest.fn(async (fn) => fn('tx')),
  },
  Student: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  LjStudentEvent: {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../services/learningJourney/analytics/analyticRebuildService', () => ({
  rebuildAnalytics: jest.fn().mockResolvedValue({ students: 1 }),
}));

const { Student, LjStudentEvent } = require('../models');
const { rebuildAnalytics } = require('../services/learningJourney/analytics/analyticRebuildService');
const { importBaseline } = require('../services/learningJourney/importBaselineService');

function makeBaselineBuffer(dataRows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['學號', '姓名', '入學學年', '學測英文', '測驗年度'],
    ...dataRows,
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'baseline');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('importBaselineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Student.findOne.mockResolvedValue(null);
    Student.create.mockResolvedValue({ studentId: 'B11201001' });
    LjStudentEvent.findOne.mockResolvedValue(null);
    LjStudentEvent.create.mockResolvedValue({});
    LjStudentEvent.update.mockResolvedValue([0]);
  });

  it('imports valid GSAT baseline rows and rebuilds analytics', async () => {
    const buffer = makeBaselineBuffer([
      ['B11201001', '王小明', 2023, 12, 2023],
    ]);

    const result = await importBaseline(buffer, { batchId: 'ljv3:baseline:test' });

    expect(result.ok).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.batchId).toBe('ljv3:baseline:test');
    expect(LjStudentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'B11201001',
        eventType: 'baseline_score',
        sourceSystem: 'baseline_import',
        rawScore: 12,
        instrument: 'GSAT',
        cefrLevel: 'B1',
      }),
      expect.any(Object)
    );
    expect(rebuildAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ studentIds: ['B11201001'] })
    );
  });

  it('quarantines zero score rows', async () => {
    const buffer = makeBaselineBuffer([
      ['B11201002', '陳小華', 2023, 0, 2023],
    ]);

    const result = await importBaseline(buffer, { batchId: 'ljv3:baseline:zero', rebuildAnalytics: false });

    expect(result.imported).toBe(0);
    expect(result.quarantine).toHaveLength(1);
    expect(result.quarantine[0].reason).toBe('zero_score_not_allowed');
    expect(LjStudentEvent.create).not.toHaveBeenCalled();
  });
});
