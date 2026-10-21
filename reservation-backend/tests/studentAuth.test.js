const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mockFindOne = jest.fn();
const mockFindByPk = jest.fn();
const mockCreate = jest.fn();
const mockTeacherFindByPk = jest.fn();

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
    const row = accountRow();
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
