process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-chars-long';

const {
  createPreviewToken,
  verifyPreviewToken,
} = require('../services/weeklyPreviewService');

describe('weeklyPreviewService', () => {
  it('creates and verifies preview token', () => {
    const token = createPreviewToken(42, 3600);
    const parsed = verifyPreviewToken(token);
    expect(parsed).toEqual({ id: 42 });
  });

  it('rejects invalid token', () => {
    expect(verifyPreviewToken('not-a-valid-token')).toBeNull();
  });
});
