/**
 * 全站 rate limit 可觀測 store：包裝 express-rate-limit MemoryStore，
 * 並記錄 429 次數供管理端檢視。
 */

const { MemoryStore } = require('express-rate-limit');

/** @type {InstanceType<typeof MemoryStore>|null} */
let activeStore = null;
let rejectedTotal = 0;
let lastRejectedAt = null;
let lastRejectedPath = null;

function createObservabilityStore() {
  const inner = new MemoryStore();
  activeStore = inner;

  return {
    localKeys: true,
    init(options) {
      return inner.init(options);
    },
    get(key) {
      return inner.get(key);
    },
    increment(key) {
      return inner.increment(key);
    },
    decrement(key) {
      return inner.decrement(key);
    },
    resetKey(key) {
      return inner.resetKey(key);
    },
    resetAll() {
      return inner.resetAll();
    },
    shutdown() {
      return inner.shutdown();
    },
  };
}

function recordRateLimitRejection(req) {
  rejectedTotal += 1;
  lastRejectedAt = new Date().toISOString();
  lastRejectedPath = req?.originalUrl || req?.path || null;
}

function maskClientKey(key) {
  const s = String(key || '');
  if (s.startsWith('user:')) return s;
  if (s.includes(':') && !s.startsWith('user:')) {
    const parts = s.split(':');
    if (parts.length > 2) {
      return `${parts.slice(0, 3).join(':')}:****`;
    }
  }
  const m = s.match(/^(\d+\.\d+)\.(\d+)\.(\d+)$/);
  if (m) return `${m[1]}.*.*`;
  if (s.length > 12) return `${s.slice(0, 8)}…`;
  return s;
}

function collectClientsFromStore(store) {
  /** @type {Map<string, { totalHits: number, resetTime: Date }>} */
  const merged = new Map();
  if (!store) return merged;
  const now = Date.now();
  for (const map of [store.previous, store.current]) {
    if (!map || typeof map.forEach !== 'function') continue;
    map.forEach((client, key) => {
      if (!client) return;
      const resetMs = client.resetTime instanceof Date
        ? client.resetTime.getTime()
        : Number(client.resetTime) || 0;
      if (resetMs <= now) return;
      const existing = merged.get(key);
      if (!existing || client.totalHits >= existing.totalHits) {
        merged.set(key, {
          totalHits: client.totalHits,
          resetTime: client.resetTime instanceof Date
            ? client.resetTime
            : new Date(resetMs),
        });
      }
    });
  }
  return merged;
}

/**
 * @param {{ max?: number, windowMs?: number, enabled?: boolean }} config
 */
function getRateLimitUsageSnapshot(config = {}) {
  const max = Number(config.max) || 1000;
  const cfgWindow = Number(config.windowMs) || 15 * 60 * 1000;
  const clientsMap = collectClientsFromStore(activeStore);

  /** @type {Array<{ keyMasked: string, hits: number, remaining: number, resetAt: string, utilizationPct: number }>} */
  const clients = [];
  let totalHits = 0;
  let nearLimitCount = 0;

  for (const [key, entry] of clientsMap.entries()) {
    const hits = entry.totalHits;
    totalHits += hits;
    const remaining = Math.max(0, max - hits);
    const utilizationPct = max > 0 ? Math.min(100, Math.round((hits / max) * 1000) / 10) : 0;
    if (hits >= max * 0.8) nearLimitCount += 1;
    clients.push({
      keyMasked: maskClientKey(key),
      hits,
      remaining,
      resetAt: entry.resetTime.toISOString(),
      utilizationPct,
    });
  }

  clients.sort((a, b) => b.hits - a.hits);
  const topClients = clients.slice(0, 15);
  const busiest = clients[0] || null;

  return {
    enabled: config.enabled !== false,
    max,
    windowMs: cfgWindow,
    windowMinutes: Math.round(cfgWindow / 60000),
    trackedClients: clients.length,
    totalHitsInWindow: totalHits,
    nearLimitClients: nearLimitCount,
    busiestUtilizationPct: busiest ? busiest.utilizationPct : 0,
    busiestHits: busiest ? busiest.hits : 0,
    topClients,
    rejectedTotal,
    lastRejectedAt,
    lastRejectedPath,
    generatedAt: new Date().toISOString(),
  };
}

function resetObservabilityForTests() {
  if (activeStore && typeof activeStore.resetAll === 'function') {
    void activeStore.resetAll();
  }
  if (activeStore && typeof activeStore.shutdown === 'function') {
    try {
      activeStore.shutdown();
    } catch (_) {
      /* ignore */
    }
  }
  activeStore = null;
  rejectedTotal = 0;
  lastRejectedAt = null;
  lastRejectedPath = null;
}

module.exports = {
  createObservabilityStore,
  recordRateLimitRejection,
  getRateLimitUsageSnapshot,
  resetObservabilityForTests,
  maskClientKey,
};
