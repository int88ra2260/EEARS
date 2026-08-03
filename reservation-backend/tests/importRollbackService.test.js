'use strict';

jest.mock('../models', () => ({
  LjStudentEvent: {
    update: jest.fn(),
    findAll: jest.fn(),
  },
  EtEnrollmentSnapshot: {
    update: jest.fn(),
    findAll: jest.fn(),
  },
  EtExamAttempt: {
    update: jest.fn(),
    findAll: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn((fn) => fn('tx')),
  },
}));

jest.mock('../services/learningJourney/analytics/analyticRebuildService', () => ({
  rebuildAnalytics: jest.fn().mockResolvedValue({ students: 1 }),
}));

const {
  LjStudentEvent,
  EtEnrollmentSnapshot,
  EtExamAttempt,
} = require('../models');
const { rebuildAnalytics } = require('../services/learningJourney/analytics/analyticRebuildService');
const {
  softRollbackImportBatch,
  rollbackImportHistoryRow,
} = require('../services/learningJourney/importRollbackService');

describe('importRollbackService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('soft-excludes baseline_gsat events by batchId', async () => {
    LjStudentEvent.update.mockResolvedValue([3]);
    LjStudentEvent.findAll.mockResolvedValue([
      { studentId: 'S001' },
      { studentId: 'S002' },
    ]);

    const result = await softRollbackImportBatch({
      importType: 'baseline_gsat',
      batchId: 'ljv3:baseline:1',
      transaction: 'tx',
    });

    expect(result.excludedEvents).toBe(3);
    expect(result.studentIds).toEqual(['S001', 'S002']);
    expect(LjStudentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ excludeFlag: true, reasonCode: 'import_rollback' }),
      expect.objectContaining({
        where: expect.objectContaining({
          sourceSystem: 'baseline_import',
        }),
        transaction: 'tx',
      })
    );
  });

  it('deactivates enrollment snapshots instead of deleting', async () => {
    EtEnrollmentSnapshot.update.mockResolvedValue([2]);
    EtEnrollmentSnapshot.findAll.mockResolvedValue([{ studentId: 'S001' }]);

    const result = await softRollbackImportBatch({
      importType: 'enrollment',
      batchId: 'ljv3:enrollment:1',
      transaction: 'tx',
    });

    expect(result.deactivatedSnapshots).toBe(2);
    expect(EtEnrollmentSnapshot.update).toHaveBeenCalledWith(
      { isActive: false },
      expect.objectContaining({ where: { sourceBatchId: 'ljv3:enrollment:1' } })
    );
  });

  it('marks exam attempts excluded and soft-excludes related events', async () => {
    EtExamAttempt.findAll.mockResolvedValue([
      { id: 10, studentId: 'S001' },
      { id: 11, studentId: 'S002' },
    ]);
    EtExamAttempt.update.mockResolvedValue([2]);
    LjStudentEvent.update.mockResolvedValue([4]);

    const result = await softRollbackImportBatch({
      importType: 'external_exam',
      batchId: 'ljv3:exam:1',
      transaction: 'tx',
    });

    expect(result.excludedAttempts).toBe(2);
    expect(result.excludedEvents).toBe(4);
    expect(EtExamAttempt.update).toHaveBeenCalledWith(
      { status: 'excluded' },
      expect.objectContaining({ transaction: 'tx' })
    );
  });

  it('updates import history status to rolled_back without destroy', async () => {
    const row = {
      id: 99,
      importType: 'baseline_gsat',
      semesterId: null,
      status: 'success',
      summaryJson: { batchId: 'ljv3:baseline:99' },
      update: jest.fn().mockResolvedValue(),
    };
    LjStudentEvent.update.mockResolvedValue([1]);
    LjStudentEvent.findAll.mockResolvedValue([{ studentId: 'S001' }]);

    const out = await rollbackImportHistoryRow(row);

    expect(out.rollback.excludedEvents).toBe(1);
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rolled_back' }),
      expect.any(Object)
    );
    expect(rebuildAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ studentIds: ['S001'] })
    );
  });
});
