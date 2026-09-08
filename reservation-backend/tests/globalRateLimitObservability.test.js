'use strict';

const {
  createObservabilityStore,
  getRateLimitUsageSnapshot,
  recordRateLimitRejection,
  resetObservabilityForTests,
  maskClientKey,
} = require('../services/globalRateLimitObservability');

describe('globalRateLimitObservability', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  afterEach(() => {
    resetObservabilityForTests();
  });

  it('masks IPv4 client keys', () => {
    expect(maskClientKey('203.69.12.34')).toBe('203.69.*.*');
  });

  it('tracks hits and snapshot via MemoryStore wrapper', async () => {
    const store = createObservabilityStore();
    store.init({ windowMs: 60_000 });
    await store.increment('1.2.3.4');
    await store.increment('1.2.3.4');
    await store.increment('5.6.7.8');
    recordRateLimitRejection({ path: '/echo', originalUrl: '/api/echo' });

    const snap = getRateLimitUsageSnapshot({ max: 10, windowMs: 60_000, enabled: true });
    expect(snap.trackedClients).toBe(2);
    expect(snap.totalHitsInWindow).toBe(3);
    expect(snap.busiestHits).toBe(2);
    expect(snap.rejectedTotal).toBe(1);
    expect(snap.lastRejectedPath).toBe('/api/echo');
    expect(snap.topClients[0].keyMasked).toBe('1.2.*.*');
  });
});
