'use strict';

jest.mock('../models', () => ({
  LearningJourneyOperationRun: {
    create: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn()
  },
  sequelize: {
    transaction: jest.fn(async (fn) => fn('tx'))
  }
}));

const { LearningJourneyOperationRun, sequelize } = require('../models');
const service = require('../services/learningJourney/learningJourneyOperationRunService');

function makeRow(data) {
  return {
    ...data,
    update: jest.fn(async function update(patch) {
      Object.assign(this, patch);
      return this;
    }),
    toJSON() {
      return { ...this, update: undefined, toJSON: undefined };
    }
  };
}

describe('learningJourneyOperationRunService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation(async (fn) => fn('tx'));
  });

  it('creates a running operation run with operator info', async () => {
    const row = makeRow({ id: 1 });
    LearningJourneyOperationRun.create.mockResolvedValue(row);

    const result = await service.createRun({
      operationType: service.OPERATION_TYPES.REBUILD_BEST_SKILL_PROJECTION,
      semesterId: '114-2',
      requestId: 'req-1',
      user: { id: 7, user: 'admin' },
      source: 'dashboard',
      confirm: true
    });

    expect(result).toBe(row);
    expect(LearningJourneyOperationRun.create).toHaveBeenCalledWith(expect.objectContaining({
      operationType: 'REBUILD_BEST_SKILL_PROJECTION',
      semesterId: '114-2',
      status: 'running',
      requestId: 'req-1',
      executedByUserId: '7',
      executedByUsername: 'admin',
      source: 'dashboard',
      confirm: true
    }));
  });

  it('marks success with summaries and warnings', async () => {
    const row = makeRow({ id: 1, startedAt: new Date('2026-05-18T00:00:00Z') });
    await service.markSuccess(row, {
      finishedAt: new Date('2026-05-18T00:00:02Z'),
      beforeSummary: { status: 'warning' },
      afterSummary: { status: 'ok' },
      diffSummary: { statusChanged: true },
      resultSummary: { insertedCount: 10 },
      warnings: [{ code: 'W' }]
    });

    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      durationMs: 2000,
      beforeSummary: { status: 'warning' },
      afterSummary: { status: 'ok' },
      diffSummary: { statusChanged: true },
      resultSummary: { insertedCount: 10 },
      warnings: [{ code: 'W' }]
    }));
  });

  it('lists rows without exposing full detail-only fields', async () => {
    LearningJourneyOperationRun.count.mockResolvedValue(1);
    LearningJourneyOperationRun.findAll.mockResolvedValue([
      makeRow({
        id: 2,
        operationType: 'REBUILD_BEST_SKILL_PROJECTION',
        semesterId: '114-2',
        status: 'success',
        requestId: 'req-2',
        executedByUsername: 'admin',
        durationMs: 15,
        warnings: [{ code: 'W' }]
      })
    ]);

    const result = await service.listRuns({
      semesterId: '114-2',
      operationType: 'IMPORT_ENROLLMENT,IMPORT_EXAM',
      requestId: 'req',
      warningsOnly: 'true',
      limit: 5
    });

    expect(LearningJourneyOperationRun.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        archivedAt: null,
        semesterId: '114-2',
        operationType: expect.any(Object),
        requestId: expect.any(Object)
      })
    }));
    expect(LearningJourneyOperationRun.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        archivedAt: null,
        semesterId: '114-2',
        operationType: expect.any(Object),
        requestId: expect.any(Object)
      }),
      limit: 5,
      offset: 0
    }));
    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual(expect.objectContaining({
      limit: 5,
      offset: 0,
      returned: 1,
      total: 1
    }));
    expect(result.items[0]).toEqual(expect.objectContaining({
      id: 2,
      operationType: 'REBUILD_BEST_SKILL_PROJECTION',
      warningsCount: 1
    }));
    expect(result.items[0].beforeSummary).toBeUndefined();
  });

  it('can include archived rows when explicitly requested by caller', async () => {
    LearningJourneyOperationRun.count.mockResolvedValue(0);
    LearningJourneyOperationRun.findAll.mockResolvedValue([]);

    await service.listRuns({ includeArchived: 'true', limit: 5 });

    const where = LearningJourneyOperationRun.findAll.mock.calls[0][0].where;
    expect(where.archivedAt).toBeUndefined();
  });

  it('exports filtered rows with a 5000 row cap', async () => {
    LearningJourneyOperationRun.count.mockResolvedValue(6001);
    LearningJourneyOperationRun.findAll.mockResolvedValue([
      makeRow({
        id: 3,
        operationType: 'IMPORT_EXAM',
        semesterId: '114-2',
        status: 'failed',
        requestId: 'req-3',
        executedByUsername: 'admin',
        startedAt: new Date('2026-05-18T01:00:00Z'),
        durationMs: 20,
        warnings: [],
        errorCode: 'IMPORT_EXAM_FAILED',
        errorMessage: 'bad file'
      })
    ]);

    const result = await service.exportRuns({
      operationType: 'IMPORT_ENROLLMENT,IMPORT_EXAM',
      status: 'failed',
      startedFrom: '2026-05-01',
      startedTo: '2026-05-18',
      limit: 9000
    });

    expect(LearningJourneyOperationRun.findAll).toHaveBeenCalledWith(expect.objectContaining({
      limit: 5000,
      offset: 0,
      where: expect.objectContaining({
        archivedAt: null,
        operationType: expect.any(Object),
        status: 'failed',
        startedAt: expect.any(Object)
      })
    }));
    expect(result.truncated).toBe(true);
    expect(result.total).toBe(6001);
    expect(result.limit).toBe(5000);
    expect(result.items[0]).toEqual(expect.objectContaining({
      operationType: 'IMPORT_EXAM',
      errorCode: 'IMPORT_EXAM_FAILED',
      errorMessage: 'bad file'
    }));
  });

  it('returns cleanup dry-run summary without deleting rows', async () => {
    LearningJourneyOperationRun.count.mockResolvedValue(2);
    LearningJourneyOperationRun.findAll.mockResolvedValue([
      makeRow({
        id: 10,
        operationType: 'IMPORT_ENROLLMENT',
        semesterId: '113-1',
        status: 'success',
        startedAt: new Date('2024-01-01T00:00:00Z'),
        requestId: 'req-old-1'
      }),
      makeRow({
        id: 11,
        operationType: 'IMPORT_EXAM',
        semesterId: '113-1',
        status: 'success',
        startedAt: new Date('2024-01-02T00:00:00Z'),
        requestId: 'req-old-2'
      })
    ]);

    const result = await service.cleanupDryRun({
      olderThan: '2024-08-01',
      status: 'success',
      includeNonSuccess: false
    });

    expect(LearningJourneyOperationRun.findAll).toHaveBeenCalledWith(expect.objectContaining({
      limit: 5000,
      offset: 0,
      where: expect.objectContaining({
        archivedAt: null,
        status: 'success',
        startedAt: expect.any(Object)
      })
    }));
    expect(result.dryRun).toBe(true);
    expect(result.summary.matchedCount).toBe(2);
    expect(result.summary.byStatus.success).toBe(2);
    expect(result.sampleItems).toHaveLength(2);
  });

  it('requires confirm, backup confirmation, and reason before archive', async () => {
    await expect(service.archiveRuns({ olderThan: '2024-08-01', backupConfirmed: true, reason: 'x' }))
      .rejects.toThrow('confirm=true is required');
    await expect(service.archiveRuns({ olderThan: '2024-08-01', confirm: true, reason: 'x' }))
      .rejects.toThrow('backupConfirmed=true is required');
    await expect(service.archiveRuns({ olderThan: '2024-08-01', confirm: true, backupConfirmed: true }))
      .rejects.toThrow('archive reason is required');
  });

  it('soft archives matching cleanup rows without deleting rows', async () => {
    LearningJourneyOperationRun.count.mockResolvedValue(1);
    LearningJourneyOperationRun.findAll.mockResolvedValue([
      makeRow({
        id: 20,
        operationType: 'IMPORT_ENROLLMENT',
        semesterId: '113-1',
        status: 'success',
        startedAt: new Date('2024-01-01T00:00:00Z'),
        requestId: 'req-old'
      })
    ]);
    LearningJourneyOperationRun.update.mockResolvedValue([1]);

    const result = await service.archiveRuns({
      olderThan: '2024-08-01',
      status: 'success',
      confirm: true,
      backupConfirmed: true,
      reason: '年度維運封存',
      requestId: 'req-cleanup',
      user: { id: 7, username: 'admin' }
    });

    expect(sequelize.transaction).toHaveBeenCalled();
    expect(LearningJourneyOperationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        archivedAt: expect.any(Date),
        archivedByUserId: '7',
        archivedByUsername: 'admin',
        archiveReason: '年度維運封存',
        cleanupRequestId: 'req-cleanup'
      }),
      expect.objectContaining({
        where: expect.objectContaining({
          archivedAt: null,
          status: 'success',
          startedAt: expect.any(Object)
        }),
        transaction: 'tx'
      })
    );
    expect(result.archived).toBe(true);
    expect(result.archivedCount).toBe(1);
    expect(result.cleanupRequestId).toBe('req-cleanup');
  });

  it('does not archive running rows', async () => {
    LearningJourneyOperationRun.count.mockResolvedValue(0);
    LearningJourneyOperationRun.findAll.mockResolvedValue([]);

    const result = await service.archiveRuns({
      olderThan: '2024-08-01',
      status: 'running',
      includeNonSuccess: true,
      confirm: true,
      backupConfirmed: true,
      reason: '年度維運封存'
    });

    expect(LearningJourneyOperationRun.update).not.toHaveBeenCalled();
    expect(LearningJourneyOperationRun.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        archivedAt: null,
        status: '__never_match_running_cleanup__'
      })
    }));
    expect(result.archivedCount).toBe(0);
  });

  it('keeps the recent 90-day protection when archiving', async () => {
    LearningJourneyOperationRun.count.mockResolvedValue(0);
    LearningJourneyOperationRun.findAll.mockResolvedValue([]);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await service.archiveRuns({
      olderThan: tomorrow.toISOString().slice(0, 10),
      status: 'success',
      confirm: true,
      backupConfirmed: true,
      reason: '年度維運封存'
    });

    expect(LearningJourneyOperationRun.update).not.toHaveBeenCalled();
    expect(result.warnings.some((warning) => String(warning).includes('90'))).toBe(true);
  });
});
