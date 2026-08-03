const fs = require('fs');
const path = require('path');

function parseEnvInt(name, defaultValue) {
  const v = process.env[name];
  if (v == null || v === '') return defaultValue;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

function getBackupHealthConfig(env = process.env) {
  return {
    dir: env.BACKUP_HEALTH_DIR || 'D:\\EEARS_backup\\local',
    maxAgeHours: parseEnvInt('BACKUP_HEALTH_MAX_AGE_HOURS', 36),
    pattern: env.BACKUP_HEALTH_PATTERN || '.sql.gz',
  };
}

function patternToRegExp(pattern) {
  const p = String(pattern || '.sql.gz').trim();
  if (!p || p === '*') return /^./;
  if (p.startsWith('.') && !p.includes('*')) {
    const suffix = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`${suffix}$`, 'i');
  }
  const escaped = p
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function listMatchingFiles(dir, pattern) {
  const re = patternToRegExp(pattern);
  const names = fs.readdirSync(dir, { withFileTypes: true });
  return names
    .filter((d) => d.isFile() && re.test(d.name))
    .map((d) => {
      const fullPath = path.join(dir, d.name);
      const stat = fs.statSync(fullPath);
      return {
        name: d.name,
        fullPath,
        mtimeMs: stat.mtimeMs,
        sizeBytes: stat.size,
      };
    });
}

/**
 * @returns {{
 *   ok: boolean,
 *   code: string,
 *   message: string,
 *   dir: string,
 *   pattern: string,
 *   maxAgeHours: number,
 *   latestFile: { name: string, fullPath: string, mtime: Date, ageHours: number, sizeBytes: number } | null,
 * }}
 */
function evaluateBackupHealth(options = {}) {
  const config = { ...getBackupHealthConfig(), ...options };
  const { dir, maxAgeHours, pattern } = config;

  if (!dir || !fs.existsSync(dir)) {
    return {
      ok: false,
      code: 'BACKUP_DIR_MISSING',
      message: `備份資料夾不存在：${dir}`,
      dir,
      pattern,
      maxAgeHours,
      latestFile: null,
    };
  }

  let files;
  try {
    files = listMatchingFiles(dir, pattern);
  } catch (err) {
    return {
      ok: false,
      code: 'BACKUP_DIR_UNREADABLE',
      message: `無法讀取備份資料夾：${err.message}`,
      dir,
      pattern,
      maxAgeHours,
      latestFile: null,
    };
  }

  if (!files.length) {
    return {
      ok: false,
      code: 'BACKUP_FILE_NOT_FOUND',
      message: `資料夾內無符合 pattern「${pattern}」的備份檔`,
      dir,
      pattern,
      maxAgeHours,
      latestFile: null,
    };
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const latest = files[0];
  const mtime = new Date(latest.mtimeMs);
  const ageHours = (Date.now() - latest.mtimeMs) / (1000 * 60 * 60);

  const latestFile = {
    name: latest.name,
    fullPath: latest.fullPath,
    mtime,
    ageHours: Math.round(ageHours * 100) / 100,
    sizeBytes: latest.sizeBytes,
  };

  if (latest.sizeBytes <= 0) {
    return {
      ok: false,
      code: 'BACKUP_FILE_EMPTY',
      message: '最近備份檔大小為 0',
      dir,
      pattern,
      maxAgeHours,
      latestFile,
    };
  }

  if (ageHours > maxAgeHours) {
    return {
      ok: false,
      code: 'BACKUP_FILE_STALE',
      message: `最近備份已超過允許時效（${ageHours.toFixed(2)} 小時 > ${maxAgeHours} 小時）`,
      dir,
      pattern,
      maxAgeHours,
      latestFile,
    };
  }

  return {
    ok: true,
    code: 'OK',
    message: '備份健康檢查通過',
    dir,
    pattern,
    maxAgeHours,
    latestFile,
  };
}

function formatBackupHealthReport(result, { verbose = false } = {}) {
  const lines = [];
  lines.push('[backup-health-check]');
  lines.push(`  資料夾: ${result.dir}`);
  lines.push(`  比對 pattern: ${result.pattern}`);
  lines.push(`  允許最久: ${result.maxAgeHours} 小時`);
  if (result.latestFile) {
    lines.push(`  最近備份: ${result.latestFile.name}`);
    lines.push(`  修改時間: ${result.latestFile.mtime.toISOString()}`);
    lines.push(`  距今: ${result.latestFile.ageHours} 小時`);
    lines.push(`  大小: ${result.latestFile.sizeBytes} bytes`);
  } else {
    lines.push('  最近備份: （無）');
  }
  lines.push(`  結果: ${result.ok ? 'OK' : 'FAIL'} (${result.code})`);
  lines.push(`  說明: ${result.message}`);
  if (verbose && result.latestFile) {
    lines.push(`  完整路徑: ${result.latestFile.fullPath}`);
  }
  return lines.join('\n');
}

module.exports = {
  getBackupHealthConfig,
  evaluateBackupHealth,
  formatBackupHealthReport,
  patternToRegExp,
};
