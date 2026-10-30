const request = require('supertest');
const express = require('express');

const mockLoginAccount = jest.fn();
const mockChangePassword = jest.fn();
const mockChangeEmail = jest.fn();
const mockSsoEnabled = jest.fn(() => false);
const mockLogSecurity = jest.fn();
const mockQueue = jest.fn();

jest.mock('../services/studentAuthService', () => ({
  registerAccount: jest.fn(),
  loginAccount: (...args) => mockLoginAccount(...args),
  loginWithCampusSso: jest.fn(),
  refreshCampusProfile: jest.fn(),
  completeCampusEmailSetup: jest.fn(),
  changeNotificationEmail: (...args) => mockChangeEmail(...args),
  changePassword: (...args) => mockChangePassword(...args),
  toPublicAccount: (account) => ({
    id: account.id,
    studentId: account.studentId,
    name: account.name,
  }),
  signStudentToken: () => 'student-token',
  normalizeStudentId: (value) => String(value || '').trim().toUpperCase(),
}));

jest.mock('../services/nsysuSsoClient', () => ({
  isEnabled: () => mockSsoEnabled(),
}));

jest.mock('../services/studentAccountEmailVerificationService', () => ({
  normalizeEmail: (value) => String(value || '').trim().toLowerCase(),
  createAndSendCode: jest.fn(),
  verifyCode: jest.fn(),
  invalidateActiveCodes: jest.fn(),
}));

jest.mock('../services/studentPasswordResetService', () => ({
  prepareResetByStudentId: jest.fn(),
  confirmReset: jest.fn(),
  invalidateActiveResetCodes: jest.fn(),
}));

jest.mock('../services/emailLogService', () => ({
  sendEmailWithLog: jest.fn(),
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: jest.fn(),
  logSecurityAuditImmediate: (...args) => mockLogSecurity(...args),
  queueAuthLoginFailure: (...args) => mockQueue(...args),
  metaFromReq: () => ({ requestId: 'req-student', ipAddress: '10.0.0.8', userAgent: 'jest' }),
}));

jest.mock('../middlewares/studentAuth', () => ({
  studentAuthMiddleware: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ success: false, code: 'STUDENT_AUTH_REQUIRED' });
    }
    req.studentAccount = {
      id: 4,
      studentId: 'B123456789',
      name: '王小明',
      email: 'old@example.com',
      status: 'active',
    };
    return next();
  },
}));

const studentAuthRouter = require('../routes/studentAuthRouter');

function buildApp() {
  const app = express();
  app.use((req, res, next) => {
    req.requestId = 'req-student';
    next();
  });
  app.use(express.json());
  app.use('/api/student-auth', studentAuthRouter);
  return app;
}

describe('student auth routes write audit events', () => {
  beforeEach(() => {
    mockLoginAccount.mockReset();
    mockChangePassword.mockReset();
    mockChangeEmail.mockReset();
    mockSsoEnabled.mockReset();
    mockLogSecurity.mockReset();
    mockQueue.mockReset();
    mockSsoEnabled.mockReturnValue(false);
  });

  it('keeps the login response and records success without the password', async () => {
    mockLoginAccount.mockResolvedValue({
      id: 4,
      studentId: 'B123456789',
      name: '王小明',
    });
    const res = await request(buildApp())
      .post('/api/student-auth/login')
      .send({ studentId: 'B123456789', password: 'secret-pass' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('student-token');
    expect(res.body.student.studentId).toBe('B123456789');
    const payload = mockLogSecurity.mock.calls[0][1];
    expect(payload.action).toBe('student_login_success');
    expect(payload.operatorRole).toBe('student');
    expect(JSON.stringify(payload)).not.toContain('secret-pass');
  });

  it('records a failed login and still returns the same error', async () => {
    const error = new Error('學號或密碼錯誤');
    error.status = 401;
    error.code = 'INVALID_CREDENTIALS';
    mockLoginAccount.mockRejectedValue(error);

    const res = await request(buildApp())
      .post('/api/student-auth/login')
      .send({ studentId: 'B123456789', password: 'secret-pass' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
    expect(mockQueue).toHaveBeenCalled();
    const payload = mockLogSecurity.mock.calls[0][1];
    expect(payload).toEqual(expect.objectContaining({
      action: 'student_login_failed',
      status: 'failed',
    }));
    expect(JSON.stringify(payload)).not.toContain('secret-pass');
  });

  it('records a password change made by the logged-in student', async () => {
    mockChangePassword.mockResolvedValue({ id: 4 });
    const res = await request(buildApp())
      .post('/api/student-auth/password')
      .set('Authorization', 'Bearer student')
      .send({
        currentPassword: 'old-secret',
        newPassword: 'new-secret',
        newPasswordConfirm: 'new-secret',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('密碼已更新');
    const payload = mockLogSecurity.mock.calls[0][1];
    expect(payload).toEqual(expect.objectContaining({
      action: 'student_password_changed',
      operatorId: 4,
      operatorRole: 'student',
    }));
    expect(JSON.stringify(payload)).not.toContain('old-secret');
    expect(JSON.stringify(payload)).not.toContain('new-secret');
  });

  it('records an email change with the old and new mailbox, not the verification token', async () => {
    mockChangeEmail.mockImplementation(async () => {
      const account = {
        id: 4,
        studentId: 'B123456789',
        name: '王小明',
        email: 'new@example.com',
      };
      return account;
    });
    const res = await request(buildApp())
      .post('/api/student-auth/email')
      .set('Authorization', 'Bearer student')
      .send({ email: 'new@example.com', emailVerificationToken: 'verify-token-secret' });

    expect(res.status).toBe(200);
    const payload = mockLogSecurity.mock.calls[0][1];
    expect(payload.action).toBe('student_email_changed');
    expect(payload.beforeData).toEqual({ email: 'old@example.com' });
    expect(payload.afterData.email).toBe('new@example.com');
    expect(JSON.stringify(payload)).not.toContain('verify-token-secret');
  });
});
