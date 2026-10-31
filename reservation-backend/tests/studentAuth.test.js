const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mockFindOne = jest.fn();
const mockFindByPk = jest.fn();
const mockCreate = jest.fn();
const mockTeacherFindByPk = jest.fn();

const mockAssertEmailVerified = jest.fn();
const mockFindOfficialIdentity = jest.fn();
const mockSavePendingReview = jest.fn();
const mockFindPendingByStudentId = jest.fn();
const mockReplacePending = jest.fn();

jest.mock('../services/studentAccountEmailVerificationService', () => ({
  assertEmailVerifiedToken: (...args) => mockAssertEmailVerified(...args),
}));

jest.mock('../services/studentIdentityRosterService', () => ({
  findOfficialIdentity: (...args) => mockFindOfficialIdentity(...args),
  normalizePersonName: (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase(),
}));

jest.mock('../services/studentAccountReviewService', () => ({
  savePendingReview: (...args) => mockSavePendingReview(...args),
  findPendingByStudentId: (...args) => mockFindPendingByStudentId(...args),
  replacePending: (...args) => mockReplacePending(...args),
}));

jest.mock('../models', () => ({
  StudentAccount: {
    findOne: (...args) => mockFindOne(...args),
    findByPk: (...args) => mockFindByPk(...args),
    create: (...args) => mockCreate(...args),
  },
  Teacher: {
    findByPk: (...args) => mockTeacherFindByPk(...args),
  },
}));

const studentAuthService = require('../services/studentAuthService');
const loginAccountCooldown = require('../utils/loginAccountCooldown');
const { studentAuthMiddleware, bindStudentIdentity } = require('../middlewares/studentAuth');
const { authMiddleware } = require('../middlewares/auth');
const { secretKey } = require('../config/jwtSecret');

function accountRow(overrides = {}) {
  return {
    id: 4,
    studentId: 'B123456789',
    name: '王小明',
    email: 'b123456789@student.nsysu.edu.tw',
    status: 'active',
    passwordHash: null,
    ssoProvider: null,
    ssoSubject: null,
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('studentAuthService', () => {
  beforeEach(() => {
    mockFindOne.mockReset();
    mockCreate.mockReset();
    mockAssertEmailVerified.mockReset();
    mockAssertEmailVerified.mockReturnValue(true);
    mockFindOfficialIdentity.mockReset();
    mockFindOfficialIdentity.mockResolvedValue({ covered: true, conflict: false, name: '王小明' });
    mockSavePendingReview.mockReset();
    mockSavePendingReview.mockResolvedValue({ id: 1 });
    mockFindPendingByStudentId.mockReset();
    mockFindPendingByStudentId.mockResolvedValue(null);
    mockReplacePending.mockReset();
    mockReplacePending.mockResolvedValue(undefined);
    loginAccountCooldown.resetLoginCooldownBucketsForTest();
  });

  it('rejects a student id that is not the campus format', async () => {
    await expect(studentAuthService.registerAccount({
      studentId: 'abc',
      name: '王小明',
      email: 'b123456789@student.nsysu.edu.tw',
      password: 'password12',
    })).rejects.toMatchObject({ code: 'INVALID_STUDENT_ID' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('accepts a personal mailbox after it has been verified', async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockImplementation(async (row) => accountRow(row));

    const account = await studentAuthService.registerAccount({
      studentId: 'b123456789',
      name: '王小明',
      email: 'Ming@gmail.com',
      password: 'password12',
      emailVerificationToken: 'verified-token',
    });

    expect(account.email).toBe('ming@gmail.com');
    expect(mockAssertEmailVerified).toHaveBeenCalledWith({
      token: 'verified-token',
      email: 'ming@gmail.com',
    });
  });

  it('rejects registration when the mailbox is not verified', async () => {
    const err = new Error('請先完成信箱驗證後再建立帳號');
    err.status = 400;
    err.code = 'EMAIL_VERIFICATION_REQUIRED';
    mockAssertEmailVerified.mockImplementation(() => { throw err; });

    await expect(studentAuthService.registerAccount({
      studentId: 'B123456789',
      name: '王小明',
      email: 'ming@gmail.com',
      password: 'password12',
    })).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_REQUIRED' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a roster name that does not match the application', async () => {
    mockFindOne.mockResolvedValue(null);
    mockFindOfficialIdentity.mockResolvedValue({ covered: true, conflict: false, name: '李大華' });

    await expect(studentAuthService.registerAccount({
      studentId: 'B123456789',
      name: '王小明',
      email: 'ming@gmail.com',
      password: 'password12',
      emailVerificationToken: 'verified-token',
    })).rejects.toMatchObject({ code: 'STUDENT_IDENTITY_MISMATCH' });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSavePendingReview).not.toHaveBeenCalled();
  });

  it('accepts a roster name that only differs by spaces between Chinese characters', async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockImplementation(async (row) => accountRow(row));
    mockFindOfficialIdentity.mockResolvedValue({ covered: true, conflict: false, name: '杜威' });

    const account = await studentAuthService.registerAccount({
      studentId: 'B123456789',
      name: '杜 威',
      email: 'b123456789@student.nsysu.edu.tw',
      password: 'password12',
      emailVerificationToken: 'verified-token',
    });

    expect(account.name).toBe('杜威');
  });

  it('holds an uncovered student id without creating an account', async () => {
    mockFindOne.mockResolvedValue(null);
    mockFindOfficialIdentity.mockResolvedValue({ covered: false, conflict: false, name: null });

    const result = await studentAuthService.registerAccount({
      studentId: 'B123456789',
      name: '王小明',
      email: 'ming@gmail.com',
      password: 'password12',
      emailVerificationToken: 'verified-token',
    });

    expect(result).toEqual({ pending: true });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSavePendingReview).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 'B123456789',
      email: 'ming@gmail.com',
    }));
  });

  it('stores a password hash and keeps SSO fields empty', async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockImplementation(async (row) => accountRow(row));

    const account = await studentAuthService.registerAccount({
      studentId: 'b123456789',
      name: '王小明',
      email: 'B123456789@student.nsysu.edu.tw',
      password: 'password12',
    });

    expect(account.studentId).toBe('B123456789');
    expect(account.email).toBe('b123456789@student.nsysu.edu.tw');
    expect(account.passwordHash).not.toBe('password12');
    expect(account.passwordHash.startsWith('$2')).toBe(true);
    expect(account.ssoProvider == null).toBe(true);
    expect(account.ssoSubject == null).toBe(true);
  });

  it('logs in with the campus student id', async () => {
    const passwordHash = await bcrypt.hash('password12', 4);
    const row = accountRow({ passwordHash });
    mockFindOne.mockResolvedValue(row);

    const account = await studentAuthService.loginAccount({
      studentId: 'b123456789',
      password: 'password12',
    });

    expect(account.id).toBe(4);
    expect(row.update).toHaveBeenCalled();
    const token = studentAuthService.signStudentToken(account);
    const decoded = jwt.verify(token, secretKey);
    expect(decoded.typ).toBe('student');
    expect(decoded.studentId).toBe('B123456789');
  });

  it('replaces the local password and clears the login cooldown', async () => {
    const passwordHash = await bcrypt.hash('password12', 4);
    const row = accountRow({
      passwordHash,
      update: jest.fn(async function update(patch) {
        Object.assign(this, patch);
      }),
    });
    for (let i = 0; i < 5; i += 1) {
      loginAccountCooldown.recordLoginFailure('student:B123456789');
    }
    expect(loginAccountCooldown.checkLoginCooldown('student:B123456789').blocked).toBe(true);

    await studentAuthService.replaceLocalPassword(row, 'another-password');

    expect(row.passwordHash).not.toBe(passwordHash);
    expect(row.passwordHash.startsWith('$2')).toBe(true);
    expect(loginAccountCooldown.checkLoginCooldown('student:B123456789').blocked).toBe(false);
  });

  it('rejects a new password that matches the student id', async () => {
    const passwordHash = await bcrypt.hash('password12', 4);
    const row = accountRow({ passwordHash });
    await expect(studentAuthService.replaceLocalPassword(row, 'B123456789'))
      .rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    expect(row.update).not.toHaveBeenCalled();
  });
});

describe('student auth middleware', () => {
  function appWithStudentRoute() {
    const app = express();
    app.use(express.json());
    app.post(
      '/reservations',
      studentAuthMiddleware,
      bindStudentIdentity(),
      (req, res) => {
        res.json({ studentId: req.body.studentId, email: req.body.email });
      },
    );
    return app;
  }

  beforeEach(() => {
    mockFindByPk.mockReset();
    mockTeacherFindByPk.mockReset();
  });

  it('rejects a missing token', async () => {
    const res = await request(appWithStudentRoute()).post('/reservations').send({ studentId: 'B123456789' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('STUDENT_AUTH_REQUIRED');
  });

  it('rejects a staff token', async () => {
    const token = jwt.sign({ id: 1, role: 'admin', user: 'admin' }, secretKey, { expiresIn: '1h' });
    const res = await request(appWithStudentRoute())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(401);
  });

  it('overwrites the submitted student id with the logged-in account', async () => {
    const row = accountRow({ emailVerifiedAt: new Date('2026-10-31T00:00:00Z') });
    mockFindByPk.mockResolvedValue(row);
    const token = jwt.sign({
      typ: 'student',
      id: row.id,
      studentId: row.studentId,
      name: row.name,
      email: row.email,
    }, secretKey, { expiresIn: '1h' });

    const res = await request(appWithStudentRoute())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: 'M000000000', email: 'other@example.com', eventId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.studentId).toBe('B123456789');
    expect(res.body.email).toBe(row.email);
  });

  it('rejects a token issued before the password changed', async () => {
    const row = accountRow({ passwordChangedAt: new Date(Date.now() + 60 * 1000) });
    mockFindByPk.mockResolvedValue(row);
    const token = jwt.sign({
      typ: 'student',
      id: row.id,
      studentId: row.studentId,
      name: row.name,
      email: row.email,
    }, secretKey, { expiresIn: '1h' });

    const res = await request(appWithStudentRoute())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
    expect(res.body.message).toBe('密碼已更新，請重新登入');
  });

  it('accepts a token issued after the last password change', async () => {
    const row = accountRow({
      passwordChangedAt: new Date(Date.now() - 60 * 1000),
      emailVerifiedAt: new Date('2026-10-31T00:00:00Z'),
    });
    mockFindByPk.mockResolvedValue(row);
    const token = jwt.sign({
      typ: 'student',
      id: row.id,
      studentId: row.studentId,
      name: row.name,
      email: row.email,
    }, secretKey, { expiresIn: '1h' });

    const res = await request(appWithStudentRoute())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: 'M000000000' });

    expect(res.status).toBe(200);
    expect(res.body.studentId).toBe('B123456789');
  });

  it('blocks a signed-in student until the mailbox is verified', async () => {
    const row = accountRow({ emailVerifiedAt: null });
    mockFindByPk.mockResolvedValue(row);
    const token = jwt.sign({
      typ: 'student',
      id: row.id,
      studentId: row.studentId,
      name: row.name,
      email: row.email,
    }, secretKey, { expiresIn: '1h' });

    const res = await request(appWithStudentRoute())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: 'M000000000' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_ACTIVATION_REQUIRED');
    expect(res.body.redirectUrl).toBe('/student/account');
  });

  it('does not let a student token through staff auth even if the id matches a teacher', async () => {
    mockTeacherFindByPk.mockResolvedValue({ id: 4, isActive: true, accessVersion: 1 });
    const app = express();
    app.get('/admin', authMiddleware, (req, res) => res.json({ ok: true, role: req.user.role }));
    const token = jwt.sign({
      typ: 'student',
      id: 4,
      role: 'admin',
      studentId: 'B123456789',
    }, secretKey, { expiresIn: '1h' });

    const res = await request(app).get('/admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(mockTeacherFindByPk).not.toHaveBeenCalled();
  });
});

describe('loginWithCampusSso', () => {
  const profile = {
    STUID: 'B123456789',
    CNAME: '王小明',
    EMAIL: 'ming@gmail.com',
    STAT_COD: '1',
  };

  function ssoDouble(overrides = {}) {
    return {
      authStu: jest.fn().mockResolvedValue(true),
      verifyPasswordExpired: jest.fn().mockResolvedValue('OK'),
      getStuAttr: jest.fn().mockResolvedValue(profile),
      ...overrides,
    };
  }

  beforeEach(() => {
    mockFindOne.mockReset();
    mockCreate.mockReset();
    mockReplacePending.mockReset();
    mockReplacePending.mockResolvedValue(undefined);
    loginAccountCooldown.resetLoginCooldownBucketsForTest();
  });

  it('creates an account from the campus profile and does not store the password', async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockImplementation(async (row) => accountRow(row));
    const sso = ssoDouble();

    const account = await studentAuthService.loginWithCampusSso({
      studentId: 'b123456789',
      password: 'campus-secret',
    }, sso);

    expect(sso.authStu).toHaveBeenCalledWith({
      stuid: 'B123456789',
      password: 'campus-secret',
      statCod: '1;2',
    });
    expect(account.email).toBe('ming@gmail.com');
    expect(sso.getStuAttr).toHaveBeenCalledWith(expect.objectContaining({
      attrs: ['STUID', 'CNAME', 'EMAIL', 'STAT_COD'],
    }));
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('campusProfile');
    expect(account.passwordHash).toBeNull();
    expect(account.ssoProvider).toBe('nsysu-sso');
    expect(account.ssoSubject).toBe('B123456789');
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('emailVerifiedAt');
    expect(mockReplacePending).toHaveBeenCalled();
  });

  it('keeps the mailbox already saved on the account and drops the local password', async () => {
    const row = accountRow({
      email: 'personal@example.com',
      passwordHash: 'old-hash',
      passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
    });
    mockFindOne.mockResolvedValue(row);
    const sso = ssoDouble();

    const account = await studentAuthService.loginWithCampusSso({
      studentId: 'B123456789',
      password: 'campus-secret',
    }, sso);

    expect(account.email).toBe('personal@example.com');
    expect(account.passwordHash).toBeNull();
    expect(account.passwordChangedAt).toBeNull();
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
      name: '王小明',
      ssoProvider: 'nsysu-sso',
      passwordHash: null,
      passwordChangedAt: null,
    }));
    expect(row.update.mock.calls[0][0]).not.toHaveProperty('campusProfile');
    expect(row.update.mock.calls[0][0]).not.toHaveProperty('emailVerifiedAt');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a wrong campus password', async () => {
    const sso = ssoDouble({ authStu: jest.fn().mockResolvedValue(false) });
    await expect(studentAuthService.loginWithCampusSso({
      studentId: 'B123456789',
      password: 'wrong',
    }, sso)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(sso.verifyPasswordExpired).not.toHaveBeenCalled();
  });

  it('asks the student to update an expired campus password', async () => {
    const sso = ssoDouble({ verifyPasswordExpired: jest.fn().mockResolvedValue('NO_EXPIRE') });
    await expect(studentAuthService.loginWithCampusSso({
      studentId: 'B123456789',
      password: 'campus-secret',
    }, sso)).rejects.toMatchObject({
      code: 'CAMPUS_PASSWORD_UPDATE_REQUIRED',
      redirectUrl: 'https://sso.nsysu.edu.tw',
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('accepts a campus name that includes a middle dot', async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockImplementation(async (row) => accountRow(row));
    const sso = ssoDouble({
      getStuAttr: jest.fn().mockResolvedValue({ ...profile, CNAME: '王·小明' }),
    });

    const account = await studentAuthService.loginWithCampusSso({
      studentId: 'B123456789',
      password: 'campus-secret',
    }, sso);

    expect(account.name).toBe('王·小明');
  });

  it('asks for a mailbox when the campus profile has no email', async () => {
    mockFindOne.mockResolvedValue(null);
    const sso = ssoDouble({
      getStuAttr: jest.fn().mockResolvedValue({ ...profile, EMAIL: '' }),
    });

    await expect(studentAuthService.loginWithCampusSso({
      studentId: 'B123456789',
      password: 'campus-secret',
    }, sso)).rejects.toMatchObject({
      code: 'CAMPUS_EMAIL_REQUIRED',
      studentId: 'B123456789',
      name: '王小明',
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the account after that mailbox is verified', async () => {
    mockAssertEmailVerified.mockReturnValue(true);
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockImplementation(async (row) => accountRow(row));
    const sso = ssoDouble({
      getStuAttr: jest.fn().mockResolvedValue({ ...profile, EMAIL: '' }),
    });
    let setupToken = '';
    try {
      await studentAuthService.loginWithCampusSso({
        studentId: 'B123456789',
        password: 'campus-secret',
      }, sso);
    } catch (error) {
      setupToken = error.setupToken;
    }

    const account = await studentAuthService.completeCampusEmailSetup({
      setupToken,
      email: 'ming@gmail.com',
      emailVerificationToken: 'verified-token',
    });

    expect(mockAssertEmailVerified).toHaveBeenCalled();
    expect(account.email).toBe('ming@gmail.com');
    expect(account.passwordHash).toBeNull();
    expect(account.emailVerifiedAt).toEqual(expect.any(Date));
  });

  it('does not change the local password while campus login is on', async () => {
    process.env.NSYSU_SSO_ENABLED = 'true';
    mockFindByPk.mockClear();
    try {
      await expect(studentAuthService.changePassword({
        accountId: 4,
        currentPassword: 'old-password',
        newPassword: 'new-password',
      })).rejects.toMatchObject({ code: 'CAMPUS_PASSWORD_MANAGED' });
      expect(mockFindByPk).not.toHaveBeenCalled();
    } finally {
      delete process.env.NSYSU_SSO_ENABLED;
    }
  });

  it('stores registration fields only when the student asks for them', async () => {
    const row = accountRow({ campusProfile: null });
    mockFindOne.mockResolvedValue(row);
    const sso = ssoDouble({
      getStuAttr: jest.fn().mockResolvedValue({
        STUID: 'B123456789',
        CNAME: '王小明',
        DPT_DESC: '外文系',
        T_CID: 'A123456789',
        EMAIL: 'ming@gmail.com',
        STAT_COD: '1',
      }),
    });

    const profile = await studentAuthService.refreshCampusProfile({
      studentId: 'B123456789',
      password: 'campus-secret',
    }, sso);

    expect(sso.getStuAttr).toHaveBeenCalledWith(expect.objectContaining({
      attrs: expect.arrayContaining(['DPT_DESC', 'T_CID', 'BIRTH_DD']),
    }));
    expect(profile.departmentName).toBe('外文系');
    expect(profile.nationalId).toBe('A123456789');
    expect(profile.fetchedAt).toEqual(expect.any(String));
    expect(row.update).toHaveBeenCalledWith({ campusProfile: profile });
    expect(JSON.stringify(row.update.mock.calls)).not.toContain('campus-secret');
  });

  it('does not log in when the campus service is unreachable', async () => {
    const sso = ssoDouble({ authStu: jest.fn().mockRejectedValue(new Error('down')) });
    await expect(studentAuthService.loginWithCampusSso({
      studentId: 'B123456789',
      password: 'campus-secret',
    }, sso)).rejects.toMatchObject({ code: 'SSO_UNAVAILABLE' });
  });

  it('marks the mailbox verified even when the address stays the same', async () => {
    const row = accountRow({ email: 'personal@example.com', emailVerifiedAt: null });
    mockFindByPk.mockResolvedValue(row);
    mockFindOne.mockResolvedValue(row);

    const account = await studentAuthService.changeNotificationEmail({
      accountId: 4,
      email: 'personal@example.com',
      emailVerificationToken: 'verified-token',
    });

    expect(account.email).toBe('personal@example.com');
    expect(account.emailVerifiedAt).toEqual(expect.any(Date));
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({
      email: 'personal@example.com',
      emailVerifiedAt: expect.any(Date),
    }));
  });
});

const { requireStudentEmailVerified } = require('../middlewares/studentAuth');

describe('student email activation', () => {
  function mockResponse() {
    const res = {
      statusCode: 0,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    return res;
  }

  it('blocks personal actions until the mailbox is verified', () => {
    const res = mockResponse();
    const next = jest.fn();
    requireStudentEmailVerified({ studentAccount: { emailVerifiedAt: null } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      code: 'EMAIL_ACTIVATION_REQUIRED',
      redirectUrl: '/student/account',
    });
  });

  it('continues when the mailbox is already verified', () => {
    const res = mockResponse();
    const next = jest.fn();
    requireStudentEmailVerified({ studentAccount: { emailVerifiedAt: new Date() } }, res, next);
    expect(next).toHaveBeenCalled();
  });
});
