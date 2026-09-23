'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args),
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: jest.fn(),
}));

const {
  getBackupHealthSnapshot,
  startBackupJob,
  getBackupJobStatus,
  _resetBackupJobForTests,
} = require('../services/opsScriptsService');

describe('opsScriptsService', () => {
  let tmpDir;

  beforeEach(() => {
    _resetBackupJobForTests();
    mockSpawn.mockReset();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eears-ops-backup-'));
    process.env.BACKUP_HEALTH_DIR = tmpDir;
    process.env.BACKUP_HEALTH_PATTERN = '.sql.gz';
    process.env.BACKUP_HEALTH_MAX_AGE_HOURS = '36';
  });

  afterEach(() => {
    _resetBackupJobForTests();
    delete process.env.OPS_BACKUP_SCRIPT;
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports missing script when OPS_BACKUP_SCRIPT points nowhere', () => {
    process.env.OPS_BACKUP_SCRIPT = path.join(tmpDir, 'missing-backup.bat');
    const snap = getBackupHealthSnapshot();
    expect(snap.scriptExists).toBe(false);
    expect(snap.scriptPath).toContain('missing-backup.bat');
  });

  it('rejects concurrent backup jobs on win32', () => {
    if (process.platform !== 'win32') {
      expect(() => startBackupJob({ user: { id: 1, role: 'admin' } })).toThrow(
        /僅支援 Windows/
      );
      return;
    }

    const scriptPath = path.join(tmpDir, 'noop.bat');
    fs.writeFileSync(scriptPath, '@echo off\r\nexit /b 0\r\n');
    process.env.OPS_BACKUP_SCRIPT = scriptPath;

    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const first = startBackupJob({ user: { id: 1, role: 'admin', name: 'a' }, requestId: 'r1' });
    expect(first.status).toBe('running');
    expect(mockSpawn).toHaveBeenCalled();
    expect(() => startBackupJob({ user: { id: 2, role: 'admin' }, requestId: 'r2' })).toThrow(
      /執行中/
    );
    expect(getBackupJobStatus().status).toBe('running');

    child.emit('close', 0);
    expect(getBackupJobStatus().status).toBe('success');
  });
});
