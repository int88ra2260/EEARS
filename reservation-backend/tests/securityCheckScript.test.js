const {
  checkCORS,
  checkJWTSecret,
  checkGlobalRateLimit,
  collectChecks,
} = require('../scripts/security-check');

describe('security-check.js env alignment', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('checks CORS_ORIGINS not legacy CORS_ALLOWED_ORIGINS', () => {
    delete process.env.CORS_ORIGINS;
    delete process.env.CORS_ALLOWED_ORIGINS;
    const r = checkCORS();
    expect(r.name).toBe('CORS_ORIGINS');
    expect(r.message).not.toContain('CORS_ALLOWED_ORIGINS');
  });

  it('reports GLOBAL_RATE_LIMIT_* from package and env', () => {
    process.env.GLOBAL_RATE_LIMIT_MAX = '500';
    const r = checkGlobalRateLimit();
    expect(r.name).toBe('GLOBAL_RATE_LIMIT');
    expect(r.passed).toBe(true);
    expect(r.message).toContain('max=500');
  });

  it('collectChecks includes JWT and does not print secrets', () => {
    process.env.JWT_SECRET = 'abcdefghijklmnopqrstuvwxyz012345';
    process.env.CORS_ORIGINS = 'https://example.com';
    const checks = collectChecks();
    const jwt = checks.find((c) => c.name === 'JWT_SECRET');
    expect(jwt.passed).toBe(true);
    expect(jwt.message).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(jwt.message).toContain('字元');
  });

  it('fails JWT in production when too short', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short';
    const r = checkJWTSecret();
    expect(r.passed).toBe(false);
    expect(r.severity).toBe('fail');
  });
});
