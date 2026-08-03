const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  evaluateBackupHealth,
  patternToRegExp,
} = require('../utils/backupHealthCheck');

describe('backupHealthCheck', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eears-backup-health-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails when backup directory does not exist', () => {
    const result = evaluateBackupHealth({
      dir: path.join(tmpDir, 'missing'),
      maxAgeHours: 36,
      pattern: '.sql.gz',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('BACKUP_DIR_MISSING');
  });

  it('fails when no files match pattern', () => {
    const result = evaluateBackupHealth({
      dir: tmpDir,
      maxAgeHours: 36,
      pattern: '.sql.gz',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('BACKUP_FILE_NOT_FOUND');
  });

  it('succeeds when recent backup exists', () => {
    const file = path.join(tmpDir, 'eears_2026-01-01_03-00.sql.gz');
    fs.writeFileSync(file, 'gzip-placeholder-content');
    const result = evaluateBackupHealth({
      dir: tmpDir,
      maxAgeHours: 36,
      pattern: 'eears_*.sql.gz',
    });
    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(result.latestFile.name).toBe('eears_2026-01-01_03-00.sql.gz');
    expect(result.latestFile.ageHours).toBeLessThan(1);
  });

  it('fails when latest backup exceeds max age', () => {
    const file = path.join(tmpDir, 'eears_old.sql.gz');
    fs.writeFileSync(file, 'old');
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    fs.utimesSync(file, twoDaysAgo / 1000, twoDaysAgo / 1000);

    const result = evaluateBackupHealth({
      dir: tmpDir,
      maxAgeHours: 36,
      pattern: '.sql.gz',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('BACKUP_FILE_STALE');
  });

  it('supports custom pattern from env-style options', () => {
    fs.writeFileSync(path.join(tmpDir, 'other.txt'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'custom.dump.gz'), 'y');
    const result = evaluateBackupHealth({
      dir: tmpDir,
      maxAgeHours: 24,
      pattern: 'custom.dump.gz',
    });
    expect(result.ok).toBe(true);
    expect(result.latestFile.name).toBe('custom.dump.gz');
  });

  it('pattern matcher does not expose secrets', () => {
    const report = evaluateBackupHealth({
      dir: tmpDir,
      pattern: '.sql.gz',
    });
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/DB_PASSWORD/i);
    expect(json).not.toMatch(/JWT_SECRET/i);
  });
});

describe('patternToRegExp', () => {
  it('matches eears_ prefix pattern', () => {
    const re = patternToRegExp('eears_*.sql.gz');
    expect(re.test('eears_2026-03-30_03-00.sql.gz')).toBe(true);
    expect(re.test('other.sql.gz')).toBe(false);
  });
});
