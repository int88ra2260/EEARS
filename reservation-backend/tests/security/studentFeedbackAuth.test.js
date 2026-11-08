'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../../services/studentFeedbackService', () => ({
  submitStudentFeedback: jest.fn(async () => ({
    id: 1,
    kind: 'problem',
    category: 'account',
    emailStatus: 'sent',
    message: '已送到中心。',
  })),
  listStudentFeedback: jest.fn(async () => []),
}));

jest.mock('../../middlewares/studentAuth', () => ({
  studentAuthMiddleware: (req, res, next) => {
    const studentId = req.headers['x-test-student'];
    if (!studentId) {
      return res.status(401).json({ success: false, code: 'STUDENT_AUTH_REQUIRED', message: '請先登入學生帳號' });
    }
    req.studentAccount = {
      studentId,
      name: '測試生',
      email: 'student@example.com',
      emailVerifiedAt: null,
    };
    return next();
  },
}));

jest.mock('../../middlewares/auth', () => {
  const actual = jest.requireActual('../../middlewares/auth');
  const { buildAccessProfile } = jest.requireActual('../../auth/accessProfile');
  const authMiddleware = (req, res, next) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });
    req.user = {
      id: 1,
      role,
      staffLevel: req.headers['x-test-staff-level'] || null,
      teacherLevel: req.headers['x-test-teacher-level'] || null,
    };
    req.accessProfile = buildAccessProfile(req.user);
    return next();
  };
  return { ...actual, authMiddleware };
});

const studentFeedbackRouter = require('../../routes/studentFeedbackRouter');
const adminStudentFeedbackRouter = require('../../routes/adminStudentFeedbackRouter');
const { submitStudentFeedback } = require('../../services/studentFeedbackService');

const app = express();
app.use(express.json());
app.use('/api/student/feedback', studentFeedbackRouter);
app.use('/api/admin/student-feedback', adminStudentFeedbackRouter);

describe('student feedback auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires a student login to submit', async () => {
    const res = await request(app)
      .post('/api/student/feedback')
      .send({ kind: 'problem', category: 'account', message: '收不到驗證碼，請幫忙。' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('STUDENT_AUTH_REQUIRED');
    expect(submitStudentFeedback).not.toHaveBeenCalled();
  });

  it('submits with the session student and ignores a body student id', async () => {
    const res = await request(app)
      .post('/api/student/feedback')
      .set('x-test-student', 'B111')
      .send({
        studentId: 'B999',
        name: '別人',
        email: 'other@example.com',
        kind: 'wish',
        category: 'other',
        message: '希望可以線上參加。',
      });
    expect(res.status).toBe(201);
    expect(submitStudentFeedback).toHaveBeenCalledWith({
      account: expect.objectContaining({ studentId: 'B111', name: '測試生' }),
      kind: 'wish',
      category: 'other',
      message: '希望可以線上參加。',
    });
  });

  it('hides the staff list from anonymous users and regular teachers', async () => {
    const anonymous = await request(app).get('/api/admin/student-feedback');
    expect(anonymous.status).toBe(401);

    const teacher = await request(app)
      .get('/api/admin/student-feedback')
      .set('x-test-role', 'teacher')
      .set('x-test-teacher-level', 'regular');
    expect(teacher.status).toBe(403);
    expect(teacher.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('lets center staff read the list', async () => {
    const res = await request(app)
      .get('/api/admin/student-feedback?kind=wish')
      .set('x-test-role', 'office_staff')
      .set('x-test-staff-level', 'event_lead');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.items).toEqual([]);
  });
});
