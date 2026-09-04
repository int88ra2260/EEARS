const { emptyDemoValue, enforceDemoAccount } = require('../middlewares/demoAccountGuard');

describe('demoAccountGuard', () => {
  it('empties arrays and zeros common totals', () => {
    const out = emptyDemoValue({
      success: true,
      data: [{ id: 1, name: 'secret' }],
      total: 9,
      pagination: { total: 9, totalPages: 3, currentPage: 1 },
      meta: { events: [{ id: 2 }] },
    });
    expect(out.data).toEqual([]);
    expect(out.total).toBe(0);
    expect(out.pagination.total).toBe(0);
    expect(out.pagination.totalPages).toBe(0);
    expect(out.meta.events).toEqual([]);
    expect(out.demo).toBe(true);
  });

  it('blocks non-GET mutations for demo users', () => {
    const req = { user: { isDemo: true }, method: 'POST', originalUrl: '/api/admin/events' };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return body; },
    };
    expect(enforceDemoAccount(req, res)).toBe(true);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('DEMO_READ_ONLY');
  });

  it('allows GET for demo users and arms response guard', () => {
    const req = { user: { isDemo: true }, method: 'GET', originalUrl: '/api/admin/events' };
    const captured = {};
    const res = {
      json(body) { captured.body = body; return body; },
    };
    expect(enforceDemoAccount(req, res)).toBe(false);
    res.json({ data: [{ id: 1 }], total: 5 });
    expect(captured.body.data).toEqual([]);
    expect(captured.body.total).toBe(0);
    expect(captured.body.demo).toBe(true);
  });
});
