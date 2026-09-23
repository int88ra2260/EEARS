const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  recordViewAndGet,
  getOnly,
  _resetForTests,
} = require('../services/siteStatsService');

describe('siteStatsService', () => {
  let tmpDir;
  let statsFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eears-site-stats-'));
    statsFile = path.join(tmpDir, 'siteStats.json');
    _resetForTests({ statsFile });
  });

  afterEach(() => {
    _resetForTests({});
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('creates file and increments total/today', async () => {
    const first = await recordViewAndGet();
    expect(first).toEqual({ total: 1, today: 1 });

    const second = await recordViewAndGet();
    expect(second).toEqual({ total: 2, today: 2 });

    const only = await getOnly();
    expect(only).toEqual({ total: 2, today: 2 });
  });

  it('serializes concurrent increments without losing counts', async () => {
    fs.writeFileSync(
      statsFile,
      JSON.stringify({ totalViews: 0, date: '', dailyViews: 0 }, null, 2),
      'utf8'
    );

    const n = 40;
    const results = await Promise.all(
      Array.from({ length: n }, () => recordViewAndGet())
    );

    const totals = results.map((r) => r.total).sort((a, b) => a - b);
    expect(totals).toEqual(Array.from({ length: n }, (_, i) => i + 1));

    const final = await getOnly();
    expect(final.total).toBe(n);
    expect(final.today).toBe(n);
  });

  it('getOnly does not increment', async () => {
    await recordViewAndGet();
    const a = await getOnly();
    const b = await getOnly();
    expect(a).toEqual(b);
    expect(a.total).toBe(1);
  });
});
