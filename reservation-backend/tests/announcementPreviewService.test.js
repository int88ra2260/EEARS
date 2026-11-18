const {
  createAnnouncementPreviewToken,
  verifyAnnouncementPreviewToken,
} = require('../services/announcementPreviewService');

describe('announcement preview token', () => {
  const previous = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-at-least-16';
  });

  afterAll(() => {
    process.env.JWT_SECRET = previous;
  });

  test('creates and verifies a preview token', () => {
    const token = createAnnouncementPreviewToken(42, 3600);
    expect(verifyAnnouncementPreviewToken(token)).toMatchObject({ id: 42 });
  });

  test('rejects a tampered token', () => {
    const token = createAnnouncementPreviewToken(7, 3600);
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    parts[3] = parts[3].startsWith('a') ? `b${parts[3].slice(1)}` : `a${parts[3].slice(1)}`;
    const tampered = Buffer.from(parts.join(':')).toString('base64url');
    expect(verifyAnnouncementPreviewToken(tampered)).toBeNull();
  });

  test('rejects an expired token', () => {
    const token = createAnnouncementPreviewToken(7, 60);
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [prefix, id, , sig] = decoded.split(':');
    const expired = Buffer.from(`${prefix}:${id}:1:${sig}`).toString('base64url');
    expect(verifyAnnouncementPreviewToken(expired)).toBeNull();
  });
});
