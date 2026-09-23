'use strict';

jest.mock('../models', () => ({
  sequelize: {
    query: jest.fn(),
    QueryTypes: { SELECT: 'SELECT' },
  },
  LearningJourneyOperationRun: {
    findOne: jest.fn(),
  },
}));

jest.mock('../services/learningJourney/ewlSyncService', () => ({
  syncEwlReservations: jest.fn(),
}));

jest.mock('../services/learningJourney/learningJourneyOperationRunService', () => ({
  OPERATION_TYPES: {
    SYNC_EWL: 'SYNC_EWL',
    REBUILD_ANALYTICS: 'REBUILD_ANALYTICS',
  },
  STATUSES: {
    SUCCESS: 'success',
    PARTIAL: 'partial',
    FAILED: 'failed',
    RUNNING: 'running',
  },
  findRunningByType: jest.fn(),
  createRun: jest.fn(),
  markSuccess: jest.fn(),
  markFailed: jest.fn(),
}));

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { sequelize, LearningJourneyOperationRun } = require('../models');
const { syncEwlReservations } = require('../services/learningJourney/ewlSyncService');
const operationRuns = require('../services/learningJourney/learningJourneyOperationRunService');
const {
  msUntilNextRun,
  isEnabled,
  scheduleClock,
  runScheduledEwlSync,
  maybeCatchUp,
} = require('../scripts/ewlDailySyncScheduler');

dayjs.extend(utc);
dayjs.extend(timezone);

const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('ewlDailySyncScheduler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.EWL_DAILY_SYNC_ENABLED;
    delete process.env.EWL_DAILY_SYNC_HOUR;
    delete process.env.EWL_DAILY_SYNC_MINUTE;
    sequelize.query.mockResolvedValue([{ acquired: 1 }]);
    operationRuns.findRunningByType.mockResolvedValue(null);
    operationRuns.createRun.mockResolvedValue({ id: 9 });
    operationRuns.markSuccess.mockResolvedValue({});
    operationRuns.markFailed.mockResolvedValue({});
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults to 06:00 and can be turned off', () => {
    expect(isEnabled()).toBe(true);
    expect(scheduleClock()).toEqual({ hour: 6, minute: 0 });
    process.env.EWL_DAILY_SYNC_ENABLED = 'false';
    process.env.EWL_DAILY_SYNC_HOUR = '7';
    process.env.EWL_DAILY_SYNC_MINUTE = '30';
    expect(isEnabled()).toBe(false);
    expect(scheduleClock()).toEqual({ hour: 7, minute: 30 });
  });

  it('waits until the next 06:00 Taipei time', () => {
    const before = dayjs.tz('2026-09-23 05:00:00', 'Asia/Taipei');
    const after = dayjs.tz('2026-09-23 06:01:00', 'Asia/Taipei');
    expect(msUntilNextRun(before)).toBe(60 * 60 * 1000);
    expect(msUntilNextRun(after)).toBe((23 * 60 + 59) * 60 * 1000);
  });

  it('skips when a sync is already running', async () => {
    operationRuns.findRunningByType.mockResolvedValueOnce({ id: 1 });
    const outcome = await runScheduledEwlSync(logger);
    expect(outcome).toEqual({ skipped: true, reason: 'already_running' });
    expect(syncEwlReservations).not.toHaveBeenCalled();
    expect(operationRuns.createRun).not.toHaveBeenCalled();
  });

  it('writes the default window and records a scheduler run', async () => {
    syncEwlReservations.mockResolvedValue({
      startDate: '2026-09-09',
      endDate: '2026-11-22',
      fetched: 4,
      inserted: 1,
      updated: 2,
      skipped: 1,
      errorCount: 0,
      affectedStudentCount: 2,
    });

    const outcome = await runScheduledEwlSync(logger);

    expect(syncEwlReservations).toHaveBeenCalledWith({
      dryRun: false,
      rebuildAnalytics: true,
    });
    expect(operationRuns.createRun).toHaveBeenCalledWith(expect.objectContaining({
      operationType: 'SYNC_EWL',
      executedByUsername: 'system:scheduler',
      source: 'scheduler',
      dryRun: false,
      confirm: true,
    }));
    expect(operationRuns.markSuccess).toHaveBeenCalledWith(
      { id: 9 },
      expect.objectContaining({ status: 'success' })
    );
    expect(outcome.skipped).toBe(false);
    expect(sequelize.query).toHaveBeenCalledTimes(2);
  });

  it('marks the run failed and releases the lock when sync throws', async () => {
    syncEwlReservations.mockRejectedValue(new Error('api down'));
    await expect(runScheduledEwlSync(logger)).rejects.toThrow('api down');
    expect(operationRuns.markFailed).toHaveBeenCalledWith(
      { id: 9 },
      expect.objectContaining({ errorCode: 'EWL_SYNC_FAILED', errorMessage: 'api down' })
    );
    expect(sequelize.query.mock.calls[1][0]).toContain('RELEASE_LOCK');
  });

  it('skips catch-up when a scheduler success is still fresh', async () => {
    LearningJourneyOperationRun.findOne.mockResolvedValue({ id: 3 });
    const outcome = await maybeCatchUp(logger);
    expect(outcome).toEqual({ skipped: true, reason: 'fresh' });
    expect(syncEwlReservations).not.toHaveBeenCalled();
  });
});
