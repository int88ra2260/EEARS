const { sanitizeForAudit } = require('../utils/logSanitizer');
const { getLogRetentionConfig } = require('../utils/logRetentionConfig');
const { runLogRetentionCleanup } = require('../utils/logRetentionCleanup');

function mockModel(initialCount = 10) {
  let count = initialCount;
  return {
    count: jest.fn(async () => count),
    destroy: jest.fn(async () => {
      const deleted = count;
      count = 0;
      return deleted;
    }),
    findAll: jest.fn(async () => []),
  };
}

describe('logRetentionConfig', () => {
  it('defaults system log retention to 180 days', () => {
    const cfg = getLogRetentionConfig({});
    expect(cfg.systemDays).toBe(180);
  });

  it('defaults email log retention to 180 days', () => {
    const cfg = getLogRetentionConfig({});
    expect(cfg.emailDays).toBe(180);
  });

  it('defaults audit log retention to 365 days', () => {
    const cfg = getLogRetentionConfig({});
    expect(cfg.auditDays).toBe(365);
  });

  it('defaults audit cleanup mode to keep', () => {
    const cfg = getLogRetentionConfig({});
    expect(cfg.auditCleanupMode).toBe('keep');
  });

  it('falls back to keep for invalid AUDIT_LOG_CLEANUP_MODE', () => {
    const cfg = getLogRetentionConfig({ AUDIT_LOG_CLEANUP_MODE: 'invalid-mode' });
    expect(cfg.auditCleanupMode).toBe('keep');
    expect(cfg.warnings.length).toBeGreaterThan(0);
  });

  it('archive mode warns about missing DB archived column', () => {
    const cfg = getLogRetentionConfig({ AUDIT_LOG_CLEANUP_MODE: 'archive' });
    expect(cfg.auditCleanupMode).toBe('archive');
    expect(cfg.warnings.some((w) => w.includes('archived'))).toBe(true);
  });
});

describe('logRetentionCleanup', () => {
  it('dry-run does not delete system or email logs', async () => {
    const SystemLog = mockModel(5);
    const EmailLog = mockModel(3);
    const AuditLog = mockModel(100);

    const result = await runLogRetentionCleanup({
      models: { SystemLog, EmailLog, AuditLog },
      dryRun: true,
      config: getLogRetentionConfig({ AUDIT_LOG_CLEANUP_MODE: 'keep' }),
    });

    expect(result.system_logs.deleted).toBe(0);
    expect(result.email_logs.deleted).toBe(0);
    expect(SystemLog.destroy).not.toHaveBeenCalled();
    expect(EmailLog.destroy).not.toHaveBeenCalled();
  });

  it('keep mode skips audit log processing', async () => {
    const AuditLog = mockModel(50);
    const result = await runLogRetentionCleanup({
      models: {
        SystemLog: mockModel(0),
        EmailLog: mockModel(0),
        AuditLog,
      },
      dryRun: true,
      config: getLogRetentionConfig({ AUDIT_LOG_CLEANUP_MODE: 'keep' }),
    });
    expect(result.audit_logs.skipped).toBe(true);
    expect(result.audit_logs.mode).toBe('keep');
    expect(AuditLog.destroy).not.toHaveBeenCalled();
  });

  it('apply deletes system logs when dryRun is false', async () => {
    const SystemLog = mockModel(7);
    const result = await runLogRetentionCleanup({
      models: {
        SystemLog,
        EmailLog: mockModel(0),
        AuditLog: mockModel(0),
      },
      dryRun: false,
      config: getLogRetentionConfig({ AUDIT_LOG_CLEANUP_MODE: 'keep' }),
    });
    expect(result.system_logs.deleted).toBe(7);
    expect(SystemLog.destroy).toHaveBeenCalled();
  });
});

describe('sanitizeForAudit P0/P1 actions', () => {
  const sensitivePayload = {
    password: 'SecretPass1!',
    token: 'jwt-token-value',
    authorization: 'Bearer abc',
    idNumber: 'A123456789',
    studentEmail: 'student@nsysu.edu.tw',
    studentId: 'B123456789',
    answersJson: { q1: 'answer', email: 'hidden@x.com' },
    rawPayload: { nested: true },
  };

  const actionSamples = [
    { action: 'english_test_export_excel', afterData: { exportType: 'excel', rowCount: 3, filters: {} } },
    { action: 'english_test_export_photos', afterData: { exportType: 'photos', rowCount: 2 } },
    { action: 'legacy_english_table_survey_export', afterData: { surveyType: 'english_table', rowCount: 10 } },
    { action: 'legacy_english_club_survey_export', afterData: { surveyType: 'english_club', rowCount: 5 } },
    { action: 'login_success', afterData: { reasonCode: 'SUCCESS', role: 'admin', usernameMasked: 'te***01' } },
    { action: 'login_failed', afterData: { reasonCode: 'PASSWORD_INVALID', ...sensitivePayload } },
    { action: 'login_cooldown_triggered', afterData: { reasonCode: 'COOLDOWN', failureCount: 5 } },
    { action: 'login_blocked_by_cooldown', afterData: { reasonCode: 'COOLDOWN', retryAfterSeconds: 1800 } },
  ];

  it('redacts password, token, idNumber, email fields, answersJson, rawPayload', () => {
    const sanitized = sanitizeForAudit(sensitivePayload);
    expect(JSON.stringify(sanitized)).not.toMatch(/SecretPass1/);
    expect(JSON.stringify(sanitized)).not.toMatch(/jwt-token-value/);
    expect(sanitized.password).toBe('[已遮罩]');
    expect(sanitized.token).toBe('[已遮罩]');
    expect(sanitized.answersJson).toBe('[已遮罩]');
    expect(sanitized.rawPayload).toBe('[已遮罩]');
    expect(sanitized.idNumber).not.toBe('A123456789');
    expect(sanitized.studentEmail).not.toBe('student@nsysu.edu.tw');
  });

  it.each(actionSamples)('sanitizes audit sample for $action', ({ afterData }) => {
    const merged = sanitizeForAudit(afterData);
    const json = JSON.stringify(merged);
    expect(json).not.toMatch(/SecretPass1/);
    expect(json).not.toMatch(/jwt-token-value/);
    expect(json).not.toMatch(/A123456789/);
    if (merged.answersJson) {
      expect(merged.answersJson).toBe('[已遮罩]');
    }
  });
});
