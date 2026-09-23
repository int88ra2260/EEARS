'use strict';

jest.mock('../services/opsScriptsService', () => ({
  startBackupJob: jest.fn(),
}));

jest.mock('../utils/backupHealthCheck', () => ({
  evaluateBackupHealth: jest.fn(),
}));

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { startBackupJob } = require('../services/opsScriptsService');
const { evaluateBackupHealth } = require('../utils/backupHealthCheck');
const {
  msUntilNextRun,
  isEnabled,
  scheduleClock,
  runScheduledBackup,
  maybeCatchUp,
} = require('../scripts/backupDailyScheduler');

dayjs.extend(utc);
dayjs.extend(timezone);

const logger = {
  info: jest.fn(),
  error: jest.fn(),
};

describe('backupDailyScheduler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.BACKUP_DAILY_ENABLED;
    delete process.env.BACKUP_DAILY_HOUR;
    delete process.env.BACKUP_DAILY_MINUTE;
    startBackupJob.mockReturnValue({ status: 'running', scriptPath: 'D:\\EEARS\\scripts\\backup-db.bat' });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults to 02:00 and can be turned off', () => {
    expect(isEnabled()).toBe(true);
    expect(scheduleClock()).toEqual({ hour: 2, minute: 0 });
    process.env.BACKUP_DAILY_ENABLED = 'false';
    process.env.BACKUP_DAILY_HOUR = '3';
    process.env.BACKUP_DAILY_MINUTE = '15';
    expect(isEnabled()).toBe(false);
    expect(scheduleClock()).toEqual({ hour: 3, minute: 15 });
  });

  it('waits until the next 02:00 Taipei time', () => {
    const before = dayjs.tz('2026-09-23 01:00:00', 'Asia/Taipei');
    const after = dayjs.tz('2026-09-23 02:01:00', 'Asia/Taipei');
    expect(msUntilNextRun(before)).toBe(60 * 60 * 1000);
    expect(msUntilNextRun(after)).toBe((23 * 60 + 59) * 60 * 1000);
  });

  it('starts the official backup script as a scheduler job', () => {
    const outcome = runScheduledBackup(logger);
    expect(startBackupJob).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'scheduler',
    }));
    expect(outcome.skipped).toBe(false);
  });

  it('skips when a backup is already running', () => {
    const err = new Error('備份作業執行中，請稍後再試');
    err.code = 'BACKUP_JOB_RUNNING';
    startBackupJob.mockImplementation(() => { throw err; });
    expect(runScheduledBackup(logger)).toEqual({ skipped: true, reason: 'already_running' });
  });

  it('skips catch-up when the latest backup is still healthy', () => {
    evaluateBackupHealth.mockReturnValue({ ok: true, code: 'OK' });
    expect(maybeCatchUp(logger)).toEqual({ skipped: true, reason: 'fresh' });
    expect(startBackupJob).not.toHaveBeenCalled();
  });

  it('catch-up starts a backup when the latest file is stale', () => {
    evaluateBackupHealth.mockReturnValue({ ok: false, code: 'BACKUP_FILE_STALE' });
    const outcome = maybeCatchUp(logger);
    expect(outcome.skipped).toBe(false);
    expect(startBackupJob).toHaveBeenCalled();
  });
});
