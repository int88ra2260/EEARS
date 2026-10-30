/**
 * @jest-environment node
 */
const request = require('supertest');
const express = require('express');

const mockPrepareByStudentId = jest.fn();
const mockConfirmReset = jest.fn();
const mockInvalidate = jest.fn();
const mockPrepareByAccountId = jest.fn();
const mockLookup = jest.fn();
const mockList = jest.fn();
const mockSendEmail = jest.fn();
const mockAudit = jest.fn();
const mockSsoEnabled = jest.fn(() => false);

jest.mock('../services/studentPasswordResetService', () => ({
  prepareResetByStudentId: (...args) => mockPrepareByStudentId(...args),
  confirmReset: (...args) => mockConfirmReset(...args),
  invalidateActiveResetCodes: (...args) => mockInvalidate(...args),
  prepareResetByAccountId: (...args) => mockPrepareByAccountId(...args),
  lookupStudentAccount: (...args) => mockLookup(...args),
  listStudentAccounts: (...args) => mockList(...args),
}));

jest.mock('../services/emailLogService', () => ({
  sendEmailWithLog: (...args) => mockSendEmail(...args),
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: (...args) => mockAudit(...args),
}));

jest.mock('../services/nsysuSsoClient', () => ({
  isEnabled: (...args) => mockSsoEnabled(...args),
}));

jest.mock('../middlewares/auth', () => ({
  authMiddleware: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    }
    req.user = {
      id: 3,
      permissions: req.headers['x-test-allow'] === '0' ? [] : ['can_manage_accounts'],
    };
    return next();
  },
  requirePermission: (perm) => (req, res, next) => {
    if (!req.user.permissions.includes(perm)) {
      return res.status(403).json({ success: false, code: 'INSUFFICIENT_PERMISSIONS' });
    }
    return next();
  },
  P: { CAN_MANAGE_ACCOUNTS: 'can_manage_accounts' },
}));

const studentAuthRouter = require('../routes/studentAuthRouter');
const studentAccountAdminRouter = require('../routes/studentAccountAdminRouter');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/student-auth', studentAuthRouter);
  app.use('/api/admin/student-accounts', studentAccountAdminRouter);
  return app;
}

describe('student password reset routes', () => {
  beforeEach(() => {
    mockPrepareByStudentId.mockReset();
    mockConfirmReset.mockReset();
    mockInvalidate.mockReset();
    mockPrepareByAccountId.mockReset();
    mockLookup.mockReset();
    mockList.mockReset();
    mockSendEmail.mockReset();
    mockAudit.mockReset();
    mockSendEmail.mockResolvedValue(undefined);
    mockInvalidate.mockResolvedValue(undefined);
    mockSsoEnabled.mockReset();
    mockSsoEnabled.mockReturnValue(false);
  });

  it('answers the same way when no resettable account exists', async () => {
    mockPrepareByStudentId.mockResolvedValue(null);
    const res = await request(buildApp())
      .post('/api/student-auth/password-reset/send')
      .send({ studentId: 'B123456701' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('若此學號已有可登入的帳號');
    expect(res.body.email).toBeUndefined();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('sends the code by email without putting it in the response', async () => {
    mockPrepareByStudentId.mockResolvedValue({
      studentAccountId: 4,
      studentId: 'B123456702',
      email: 'secret@example.com',
      code: '654321',
      expiresInSec: 600,
    });
    const res = await request(buildApp())
      .post('/api/student-auth/password-reset/send')
      .send({ studentId: 'B123456702' });
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('654321');
    expect(res.text).not.toContain('secret@example.com');
    expect(mockSendEmail).toHaveBeenCalledWith(
      'studentAccountPasswordReset',
      expect.objectContaining({ code: '654321', email: 'secret@example.com' }),
      expect.objectContaining({ relatedEntityId: 4 }),
    );
  });

  it('still gives the generic reply when the mailbox send fails', async () => {
    mockPrepareByStudentId.mockResolvedValue({
      studentAccountId: 5,
      studentId: 'B123456703',
      email: 'secret@example.com',
      code: '654321',
      expiresInSec: 600,
    });
    mockSendEmail.mockRejectedValue(new Error('smtp down'));
    const res = await request(buildApp())
      .post('/api/student-auth/password-reset/send')
      .send({ studentId: 'B123456703' });
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('654321');
    expect(mockInvalidate).toHaveBeenCalledWith(5);
  });

  it('rejects a password confirmation that does not match', async () => {
    const res = await request(buildApp())
      .post('/api/student-auth/password-reset/confirm')
      .send({
        studentId: 'B123456704',
        code: '123456',
        newPassword: 'another-password',
        newPasswordConfirm: 'different-password',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PASSWORD_MISMATCH');
    expect(mockConfirmReset).not.toHaveBeenCalled();
  });

  it('completes a reset without issuing a login token', async () => {
    mockConfirmReset.mockResolvedValue({ id: 8 });
    const res = await request(buildApp())
      .post('/api/student-auth/password-reset/confirm')
      .send({
        studentId: 'B123456705',
        code: '123456',
        newPassword: 'another-password',
        newPasswordConfirm: 'another-password',
      });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.message).toContain('請用新密碼登入');
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'student_password_reset_completed',
      entityId: 8,
    }));
  });

  it('requires account-management permission to list completed accounts', async () => {
    const app = buildApp();
    const missing = await request(app).get('/api/admin/student-accounts');
    expect(missing.status).toBe(401);

    const denied = await request(app)
      .get('/api/admin/student-accounts')
      .set('Authorization', 'Bearer staff')
      .set('x-test-allow', '0');
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('INSUFFICIENT_PERMISSIONS');

    mockList.mockResolvedValue({
      accounts: [{
        id: 7,
        studentId: 'B153025014',
        name: '李宥齊',
        email: 'student@example.com',
        status: 'active',
        hasLocalPassword: true,
        createdAt: '2026-10-23T14:34:35.000Z',
        lastLoginAt: null,
        passwordChangedAt: null,
      }],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const allowed = await request(app)
      .get('/api/admin/student-accounts')
      .set('Authorization', 'Bearer staff')
      .query({ q: 'B153', page: '1' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.total).toBe(1);
    expect(allowed.body.accounts[0].studentId).toBe('B153025014');
    expect(allowed.body.accounts[0].passwordHash).toBeUndefined();
    expect(mockList).toHaveBeenCalledWith({ q: 'B153', page: '1', pageSize: undefined });
  });

  it('requires account-management permission to look up a student', async () => {
    const app = buildApp();
    const missing = await request(app).get('/api/admin/student-accounts/lookup').query({ studentId: 'B123456706' });
    expect(missing.status).toBe(401);

    const denied = await request(app)
      .get('/api/admin/student-accounts/lookup')
      .set('Authorization', 'Bearer staff')
      .set('x-test-allow', '0')
      .query({ studentId: 'B123456706' });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('INSUFFICIENT_PERMISSIONS');

    mockLookup.mockResolvedValue({ kind: 'none', account: null, pending: null });
    const allowed = await request(app)
      .get('/api/admin/student-accounts/lookup')
      .set('Authorization', 'Bearer staff')
      .query({ studentId: 'B123456706' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.kind).toBe('none');
  });

  it('lets staff send the reset email without receiving the code', async () => {
    mockPrepareByAccountId.mockResolvedValue({
      studentAccountId: 9,
      studentId: 'B123456707',
      email: 'secret@example.com',
      code: '654321',
      expiresInSec: 600,
    });
    const res = await request(buildApp())
      .post('/api/admin/student-accounts/9/password-reset')
      .set('Authorization', 'Bearer staff');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('已寄出密碼重設信');
    expect(res.text).not.toContain('654321');
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'student_password_reset_email',
      entityId: 9,
    }));
  });

  it('refuses a local reset while campus sign-in is on', async () => {
    mockSsoEnabled.mockReturnValue(true);
    const student = await request(buildApp())
      .post('/api/student-auth/password-reset/send')
      .send({ studentId: 'B123456702' });
    expect(student.status).toBe(400);
    expect(student.body.code).toBe('CAMPUS_PASSWORD_MANAGED');
    expect(mockPrepareByStudentId).not.toHaveBeenCalled();

    const staff = await request(buildApp())
      .post('/api/admin/student-accounts/9/password-reset')
      .set('Authorization', 'Bearer staff');
    expect(staff.status).toBe(400);
    expect(staff.body.code).toBe('CAMPUS_PASSWORD_MANAGED');
    expect(mockPrepareByAccountId).not.toHaveBeenCalled();
  });
});
