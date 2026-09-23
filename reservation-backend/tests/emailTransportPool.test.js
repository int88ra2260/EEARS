const { buildGmailTransportOptions, isGmailLoginRateLimited } = require('../config/email');

describe('Gmail SMTP pool options', () => {
  it('keeps a single pooled connection instead of logging in per message', () => {
    const options = buildGmailTransportOptions('emi.t.c@g-mail.nsysu.edu.tw', 'ab cd ef gh');

    expect(options.pool).toBe(true);
    expect(options.maxConnections).toBe(1);
    expect(options.maxMessages).toBeGreaterThan(1);
    expect(options.socketTimeout).toBeGreaterThan(10 * 60 * 1000);
    expect(options.auth.user).toBe('emi.t.c@g-mail.nsysu.edu.tw');
    expect(options.auth.pass).toBe('abcdefgh');
  });

  it('recognizes Gmail 454 login throttling', () => {
    expect(isGmailLoginRateLimited({
      code: 'EAUTH',
      responseCode: 454,
      message: '454-4.7.0 Too many login attempts, please try again later.',
    })).toBe(true);
    expect(isGmailLoginRateLimited({
      code: 'SMTP_LOGIN_COOLDOWN',
      responseCode: 454,
    })).toBe(false);
    expect(isGmailLoginRateLimited({ code: 'ECONNECTION', message: 'timeout' })).toBe(false);
  });
});
