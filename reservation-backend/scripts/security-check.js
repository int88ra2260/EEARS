// scripts/security-check.js — 資安配置檢查（不輸出 secret 內容）

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  // eslint-disable-next-line no-console
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkMark(passed) {
  return passed ? '✅' : '❌';
}

function isProduction() {
  return (process.env.NODE_ENV || '').trim() === 'production';
}

function checkJWTSecret() {
  const secret = process.env.JWT_SECRET != null ? String(process.env.JWT_SECRET).trim() : '';
  const prod = isProduction();
  const passed = secret.length >= 32;
  let message;
  if (!secret) {
    message = prod
      ? 'JWT_SECRET 未設定（正式環境必填）'
      : 'JWT_SECRET 未設定（開發可暫用，正式環境必填且 ≥32 字元）';
  } else if (!passed) {
    message = `JWT_SECRET 長度 ${secret.length}，正式環境需至少 32 字元`;
  } else {
    message = `JWT_SECRET 已設定（${secret.length} 字元）`;
  }
  return {
    name: 'JWT_SECRET',
    passed: prod ? passed && !!secret : passed || !prod,
    severity: prod && (!secret || !passed) ? 'fail' : !passed ? 'warn' : 'ok',
    message,
  };
}

function checkCORS() {
  const origins = process.env.CORS_ORIGINS != null ? String(process.env.CORS_ORIGINS).trim() : '';
  const prod = isProduction();
  const passed = !!origins;
  return {
    name: 'CORS_ORIGINS',
    passed: prod ? passed : true,
    severity: prod && !passed ? 'fail' : !passed ? 'warn' : 'ok',
    message: passed
      ? `CORS_ORIGINS 已設定（${origins.split(',').filter(Boolean).length} 個來源）`
      : prod
        ? 'CORS_ORIGINS 未設定（正式環境啟動時會 FATAL）'
        : 'CORS_ORIGINS 未設定（開發預設 localhost 白名單）',
  };
}

function checkEnvFileProtection() {
  const candidates = [
    path.join(__dirname, '../.gitignore'),
    path.join(__dirname, '../../.gitignore'),
  ];
  const gitignorePath = candidates.find((p) => fs.existsSync(p));
  if (!gitignorePath) {
    return { name: '環境變數文件保護', passed: false, severity: 'fail', message: '.gitignore 不存在' };
  }
  const content = fs.readFileSync(gitignorePath, 'utf8');
  if (!content.includes('.env')) {
    return { name: '環境變數文件保護', passed: false, severity: 'fail', message: '.env 未列入 .gitignore' };
  }
  return { name: '環境變數文件保護', passed: true, severity: 'ok', message: '.env 已在 .gitignore 中' };
}

function checkNodeEnv() {
  const nodeEnv = (process.env.NODE_ENV || '').trim();
  const passed = nodeEnv === 'production' || nodeEnv === 'development' || nodeEnv === 'test';
  return {
    name: 'NODE_ENV',
    passed,
    severity: passed ? 'ok' : 'warn',
    message: passed ? `NODE_ENV=${nodeEnv}` : `NODE_ENV 未設定或非常見值：${nodeEnv || '(空)'}`,
  };
}

function checkRequestBodyLimit() {
  const limit = process.env.REQUEST_BODY_LIMIT != null ? String(process.env.REQUEST_BODY_LIMIT).trim() : '';
  const effective = limit || '1mb（程式預設）';
  return {
    name: 'REQUEST_BODY_LIMIT',
    passed: true,
    severity: 'ok',
    message: limit ? `REQUEST_BODY_LIMIT=${limit}` : `未設定，使用預設 ${effective}`,
  };
}

function checkGlobalRateLimit() {
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps['express-rate-limit']) {
    return {
      name: 'GLOBAL_RATE_LIMIT',
      passed: false,
      severity: 'fail',
      message: '缺少 express-rate-limit 依賴',
    };
  }
  const enabled = process.env.GLOBAL_RATE_LIMIT_ENABLED;
  const windowMs = process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || '900000（預設）';
  const max = process.env.GLOBAL_RATE_LIMIT_MAX || '1000（預設）';
  const enabledLabel =
    enabled == null || enabled === ''
      ? process.env.NODE_ENV === 'test'
        ? 'false（test 預設關閉）'
        : 'true（預設啟用）'
      : enabled;
  return {
    name: 'GLOBAL_RATE_LIMIT',
    passed: true,
    severity: 'ok',
    message: `enabled=${enabledLabel}, windowMs=${windowMs}, max=${max}`,
  };
}

function checkHelmetDep() {
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const passed = !!deps.helmet;
  return {
    name: 'helmet 依賴',
    passed,
    severity: passed ? 'ok' : 'fail',
    message: passed ? 'helmet 已安裝' : '缺少 helmet 依賴',
  };
}

function checkLogRetentionEnv() {
  const systemDays = process.env.SYSTEM_LOG_RETENTION_DAYS || '180（預設）';
  const auditMode = process.env.AUDIT_LOG_CLEANUP_MODE || 'keep（預設）';
  return {
    name: 'LOG_RETENTION',
    passed: true,
    severity: 'ok',
    message: `SYSTEM_LOG_RETENTION_DAYS=${systemDays}, AUDIT_LOG_CLEANUP_MODE=${auditMode}`,
  };
}

function checkBackupHealthEnv() {
  const dir = process.env.BACKUP_HEALTH_DIR || 'D:\\EEARS_backup\\local（預設）';
  const hours = process.env.BACKUP_HEALTH_MAX_AGE_HOURS || '36（預設）';
  return {
    name: 'BACKUP_HEALTH',
    passed: true,
    severity: 'ok',
    message: `BACKUP_HEALTH_DIR=${dir}, MAX_AGE_HOURS=${hours}`,
  };
}

function checkTrustProxy() {
  const raw = process.env.TRUST_PROXY;
  if (raw == null || raw === '') {
    return {
      name: 'TRUST_PROXY',
      passed: true,
      severity: 'warn',
      message: '未設定（直連 Node 可接受；IIS 反向代理後建議設 1）',
    };
  }
  return {
    name: 'TRUST_PROXY',
    passed: true,
    severity: 'ok',
    message: `TRUST_PROXY=${raw}`,
  };
}

function collectChecks() {
  return [
    checkJWTSecret(),
    checkCORS(),
    checkEnvFileProtection(),
    checkNodeEnv(),
    checkHelmetDep(),
    checkRequestBodyLimit(),
    checkGlobalRateLimit(),
    checkTrustProxy(),
    checkLogRetentionEnv(),
    checkBackupHealthEnv(),
  ];
}

function runChecks() {
  const checks = collectChecks();
  log('\n🔒 EEARS 資安配置檢查\n', 'cyan');

  let failCount = 0;
  let warnCount = 0;

  checks.forEach((check) => {
    const isFail = check.severity === 'fail' && !check.passed;
    const isWarn = check.severity === 'warn' || (!check.passed && check.severity !== 'fail');
    const icon = isFail ? '❌' : isWarn && !check.passed ? '⚠️' : checkMark(check.passed);
    const color = isFail ? 'red' : isWarn && !check.passed ? 'yellow' : 'green';
    log(`${icon} ${check.name}: ${check.message}`, color);
    if (isFail) failCount += 1;
    else if (isWarn && !check.passed) warnCount += 1;
  });

  log('\n📊 摘要', 'cyan');
  log(`   失敗：${failCount}`, failCount ? 'red' : 'green');
  log(`   警告：${warnCount}`, warnCount ? 'yellow' : 'green');

  if (failCount > 0) {
    log('\n請修復失敗項目後再部署正式環境。', 'yellow');
    process.exit(1);
  }
  log('\n✅ 無阻擋性失敗（請一併處理警告項）。', 'green');
  process.exit(0);
}

if (require.main === module) {
  runChecks();
}

module.exports = {
  collectChecks,
  runChecks,
  checkJWTSecret,
  checkCORS,
  checkGlobalRateLimit,
};
