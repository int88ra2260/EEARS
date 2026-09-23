const os = require('os');
const { Op } = require('sequelize');
const { sequelize, SystemLog } = require('../models');
const emailQueue = require('../utils/emailQueue');
const { getMailTransporters, isSmtpAuthCoolingDown } = require('../config/email');
const { getSystemLogQueueStats } = require('./systemLogService');
const { getAuditLogQueueStats } = require('./auditLogService');

const HEALTH_TIMEOUT_MS = 3000;
const SMTP_VERIFY_TTL_MS = 15 * 60 * 1000;
const smtpVerifyCache = new Map();

function withTimeout(promiseFactory, timeoutMs = HEALTH_TIMEOUT_MS) {
  return Promise.race([
    promiseFactory(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('health_check_timeout')), timeoutMs);
    }),
  ]);
}

function mapHealthStatus(latencyMs, hasError) {
  if (hasError) return 'error';
  if (latencyMs >= 1200) return 'degraded';
  return 'ok';
}

async function checkDatabaseHealth() {
  const started = Date.now();
  try {
    await withTimeout(() => sequelize.authenticate());
    const latencyMs = Date.now() - started;
    return { status: mapHealthStatus(latencyMs, false), latencyMs };
  } catch (error) {
    return { status: 'error', latencyMs: Date.now() - started, error: error.message };
  }
}

async function verifySmtpAccount(serviceName, transporter, configured) {
  if (!configured || !transporter) {
    return { name: serviceName, status: 'degraded', latencyMs: null, detail: 'missing_credentials' };
  }

  if (isSmtpAuthCoolingDown()) {
    return {
      name: serviceName,
      status: 'error',
      latencyMs: null,
      detail: 'smtp_login_cooldown',
    };
  }

  const cached = smtpVerifyCache.get(serviceName);
  if (cached && Date.now() - cached.checkedAt < SMTP_VERIFY_TTL_MS) {
    return cached.result;
  }

  const started = Date.now();
  try {
    await withTimeout(() => transporter.verify());
    const latencyMs = Date.now() - started;
    const result = { name: serviceName, status: mapHealthStatus(latencyMs, false), latencyMs };
    smtpVerifyCache.set(serviceName, { checkedAt: Date.now(), result });
    return result;
  } catch (error) {
    const result = {
      name: serviceName,
      status: 'error',
      latencyMs: Date.now() - started,
      detail: error.message,
    };
    smtpVerifyCache.set(serviceName, { checkedAt: Date.now(), result });
    return result;
  }
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(idx, 0)];
}

function buildTimeBuckets(items, selector, points = 7) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const bucketMs = Math.floor(windowMs / points);
  const series = Array(points).fill(0);

  for (const item of items) {
    const ts = new Date(item.createdAt).getTime();
    const age = now - ts;
    if (age < 0 || age > windowMs) continue;
    const idx = points - 1 - Math.floor(age / bucketMs);
    if (idx >= 0 && idx < points) {
      series[idx] += selector(item);
    }
  }
  return series;
}

async function getSliMetrics() {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const rows = await SystemLog.findAll({
    where: {
      type: 'http',
      createdAt: { [Op.gte]: since },
    },
    attributes: ['status', 'durationMs', 'createdAt'],
    raw: true,
  });

  const total = rows.length;
  const success = rows.filter((r) => Number(r.status) < 500).length;
  const durations = rows
    .map((r) => Number(r.durationMs))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const fiveXx = rows.filter((r) => Number(r.status) >= 500).length;

  const bucketCounts = Array(7).fill(0);
  const requestSparkline = buildTimeBuckets(rows, () => 1, 7);
  const errorSparkline = buildTimeBuckets(rows, (item) => (Number(item.status) >= 500 ? 1 : 0), 7);
  const latencySparkline = Array(7).fill(0);
  const latencyBuckets = Array(7).fill(0).map(() => []);
  const now = Date.now();
  const bucketMs = Math.floor((60 * 60 * 1000) / 7);

  for (const row of rows) {
    const ts = new Date(row.createdAt).getTime();
    const age = now - ts;
    if (age < 0 || age > 60 * 60 * 1000) continue;
    const idx = 6 - Math.floor(age / bucketMs);
    if (idx < 0 || idx > 6) continue;
    bucketCounts[idx] += 1;
    const durationMs = Number(row.durationMs);
    if (Number.isFinite(durationMs) && durationMs >= 0) {
      latencyBuckets[idx].push(durationMs);
    }
  }

  for (let i = 0; i < latencyBuckets.length; i += 1) {
    latencySparkline[i] = Math.round(percentile(latencyBuckets[i], 95) || 0);
  }

  const peakBucketValue = Math.max(...bucketCounts);
  const peakBucketIndex = bucketCounts.findIndex((v) => v === peakBucketValue);
  const peakMinutesAgoStart = Math.max(0, Math.round((6 - peakBucketIndex + 1) * (60 / 7)));
  const peakMinutesAgoEnd = Math.max(0, Math.round((6 - peakBucketIndex) * (60 / 7)));

  return {
    window: '1h',
    apiSuccessRate: total > 0 ? Number(((success / total) * 100).toFixed(2)) : null,
    p95ResponseTimeMs: percentile(durations, 95),
    fiveXxCount: fiveXx,
    requestCount: total,
    peakWindow: total > 0
      ? `${peakMinutesAgoStart}-${peakMinutesAgoEnd} 分鐘前`
      : null,
    sparklines: {
      successRate: requestSparkline.map((requests, idx) => {
        const errors = errorSparkline[idx] || 0;
        const successes = Math.max(requests - errors, 0);
        return requests > 0 ? Number(((successes / requests) * 100).toFixed(1)) : 0;
      }),
      p95ResponseTimeMs: latencySparkline,
      fiveXxCount: errorSparkline,
      requestCount: requestSparkline,
    },
  };
}

function backlogStatusColor(pending) {
  if (pending > 200) return 'red';
  if (pending >= 50) return 'yellow';
  return 'green';
}

async function getQueueStatus() {
  const email = emailQueue.getQueueStatus();
  const systemQueue = getSystemLogQueueStats();
  const auditQueue = getAuditLogQueueStats();

  return [
    {
      name: 'emailQueue',
      pending: email.queueSize || 0,
      failed: 0,
      maxCapacity: 500,
      backlogPercent: Math.min(100, Math.round(((email.queueSize || 0) / 500) * 100)),
      statusColor: backlogStatusColor(email.queueSize || 0),
      processing: Boolean(email.processing),
    },
    {
      name: 'systemLogBulkFlush',
      pending: systemQueue.pending || 0,
      failed: 0,
      maxCapacity: 300,
      backlogPercent: Math.min(100, Math.round(((systemQueue.pending || 0) / 300) * 100)),
      statusColor: backlogStatusColor(systemQueue.pending || 0),
      processing: Boolean(systemQueue.flushing),
    },
    {
      name: 'auditLogBulkFlush',
      pending: auditQueue.pending || 0,
      failed: 0,
      maxCapacity: 100,
      backlogPercent: Math.min(100, Math.round(((auditQueue.pending || 0) / 100) * 100)),
      statusColor: backlogStatusColor(auditQueue.pending || 0),
      processing: Boolean(auditQueue.flushing),
    },
  ];
}

async function getResourceUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  let poolUsed = null;
  let poolMax = null;
  try {
    const pool = sequelize.connectionManager && sequelize.connectionManager.pool;
    if (pool) {
      poolUsed = typeof pool.borrowed === 'number' ? pool.borrowed : null;
      poolMax = typeof pool.max === 'number' ? pool.max : null;
    }
  } catch (_) {
    poolUsed = null;
    poolMax = null;
  }

  return {
    cpu: {
      loadAverage1m: Number(os.loadavg()[0].toFixed(2)),
      cpuCount: os.cpus().length,
      usagePercentApprox: Number(((os.loadavg()[0] / Math.max(os.cpus().length, 1)) * 100).toFixed(2)),
    },
    memory: {
      totalMb: Math.round(totalMem / 1024 / 1024),
      usedMb: Math.round(usedMem / 1024 / 1024),
      usagePercent: Number(((usedMem / totalMem) * 100).toFixed(2)),
    },
    dbPool: {
      used: poolUsed,
      max: poolMax,
      usagePercent: poolUsed != null && poolMax ? Number(((poolUsed / poolMax) * 100).toFixed(2)) : null,
    },
    diskIo: {
      available: false,
      note: 'not_available_in_current_runtime',
    },
  };
}

async function getRecentErrors() {
  const rows = await SystemLog.findAll({
    where: {
      status: { [Op.gte]: 400 },
    },
    order: [['createdAt', 'DESC']],
    limit: 10,
    attributes: ['createdAt', 'status', 'method', 'path', 'errorMessage'],
    raw: true,
  });

  return rows.map((row) => ({
    timestamp: row.createdAt,
    status: row.status,
    method: row.method,
    path: row.path,
    message: row.errorMessage || '',
  }));
}

async function getExternalServiceDependencies() {
  const { reservation, bestep } = getMailTransporters();
  const reservationConfigured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_PASS);
  const bestepConfigured = Boolean(process.env.BESTEP_GMAIL_USER && process.env.BESTEP_GMAIL_PASS);
  const bestepSharesReservation = Boolean(bestep && reservation && bestep === reservation);

  const [mysql, reservationHealth] = await Promise.all([
    checkDatabaseHealth().then((result) => ({ name: 'mysql', ...result })),
    verifySmtpAccount('smtp_reservation', reservation, reservationConfigured),
  ]);

  const bestepHealth = bestepSharesReservation
    ? {
      ...reservationHealth,
      name: 'smtp_bestep',
      detail: reservationHealth.detail || 'shared_reservation_transport',
    }
    : await verifySmtpAccount('smtp_bestep', bestep, bestepConfigured);

  return [mysql, reservationHealth, bestepHealth];
}

async function getInternalDiagnostics() {
  const [services, sli, queues, resources, recentErrors] = await Promise.all([
    getExternalServiceDependencies(),
    getSliMetrics(),
    getQueueStatus(),
    getResourceUsage(),
    getRecentErrors(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    services,
    sli,
    queues,
    resources,
    recentErrors,
  };
}

module.exports = {
  getInternalDiagnostics,
};
