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
  listStudentFeedback: jest.fn(async () => ({ items: [], page: 1, pageSize: 20, total: 0 })),
  summarizeStudentFeedback: jest.fn(async () => ({
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
    unresolved: 0,
  })),
  listMyStudentFeedback: jest.fn(async () => ({ items: [], page: 1, pageSize: 20, total: 0 })),
  getMyStudentFeedback: jest.fn(),
  addStudentFollowUp: jest.fn(),
  getStudentFeedback: jest.fn(async () => ({ id: 3, messages: [] })),
  listStudentFeedbackEvents: jest.fn(async () => ({ items: [], page: 1, pageSize: 20, total: 0 })),
  addStaffReply: jest.fn(async () => ({ notice: '已回覆' })),
  addStaffNote: jest.fn(),
  updateStudentFeedbackCase: jest.fn(),
  listFeedbackAssignees: jest.fn(async () => []),
}));

jest.mock('../../middlewares/studentAuth', () => {
  const actual = jest.requireActual('../../middlewares/studentAuth');
  return {
    ...actual,
    studentAuthMiddleware: (req, res, next) => {
      const studentId = req.headers['x-test-student'];
      if (!studentId) {
        return res.status(401).json({ success: false, code: 'STUDENT_AUTH_REQUIRED', message: '請先登入學生帳號' });
      }
      req.studentAccount = {
        studentId,
        name: '測試生',
        email: 'student@example.com',
        emailVerifiedAt: req.headers['x-test-email-verified'] === 'yes' ? new Date('2026-11-01T00:00:00.000Z') : null,
      };
      return next();
    },
  };
});

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
    if (req.headers['x-test-revoke']) {
      req.user.permissions = { [String(req.headers['x-test-revoke'])]: false };
    }
    req.accessProfile = buildAccessProfile(req.user);
    return next();
  };
  return { ...actual, authMiddleware };
});

const studentFeedbackRouter = require('../../routes/studentFeedbackRouter');
const adminStudentFeedbackRouter = require('../../routes/adminStudentFeedbackRouter');
const { errorHandler } = require('../../middlewares/errorHandler');
const { submitStudentFeedback } = require('../../services/studentFeedbackService');

const app = express();
app.use(express.json());
app.use('/api/student/feedback', studentFeedbackRouter);
app.use('/api/admin/student-feedback', adminStudentFeedbackRouter);
app.use(errorHandler);

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

  it('requires a verified mailbox before a student can report', async () => {
    const res = await request(app)
      .post('/api/student/feedback')
      .set('x-test-student', 'B111')
      .send({ kind: 'problem', category: 'account', message: '收不到驗證碼，請幫忙。' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_ACTIVATION_REQUIRED');
    expect(res.body.redirectUrl).toBe('/student/account');
    expect(submitStudentFeedback).not.toHaveBeenCalled();
  });

  it('submits with the session student and ignores a body student id', async () => {
    const res = await request(app)
      .post('/api/student/feedback')
      .set('x-test-student', 'B111')
      .set('x-test-email-verified', 'yes')
      .send({
        studentId: 'B999',
        name: '別人',
        email: 'other@example.com',
        kind: 'wish',
        category: 'other',
      message: '希望可以線上參加。',
      replyRequested: false,
    });
    expect(res.status).toBe(201);
    expect(submitStudentFeedback).toHaveBeenCalledWith({
      account: expect.objectContaining({ studentId: 'B111', name: '測試生' }),
      kind: 'wish',
      category: 'other',
      message: '希望可以線上參加。',
      replyRequested: false,
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

  it('lets only staff who can manage the inbox reply', async () => {
    const { addStaffReply } = require('../../services/studentFeedbackService');
    const teacher = await request(app)
      .post('/api/admin/student-feedback/3/replies')
      .set('x-test-role', 'teacher')
      .set('x-test-teacher-level', 'regular')
      .send({ message: '請再試一次。' });
    expect(teacher.status).toBe(403);

    const staff = await request(app)
      .post('/api/admin/student-feedback/3/replies')
      .set('x-test-role', 'office_staff')
      .set('x-test-staff-level', 'event_lead')
      .send({ message: '請再試一次。' });
    expect(staff.status).toBe(201);
    expect(addStaffReply).toHaveBeenCalledWith(expect.objectContaining({
      id: '3',
      message: '請再試一次。',
    }));
  });

  it('hides the summary from anonymous users and regular teachers', async () => {
    const anonymous = await request(app).get('/api/admin/student-feedback/summary');
    expect(anonymous.status).toBe(401);

    const teacher = await request(app)
      .get('/api/admin/student-feedback/summary')
      .set('x-test-role', 'teacher')
      .set('x-test-teacher-level', 'regular');
    expect(teacher.status).toBe(403);
    expect(teacher.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns the whole-table summary without applying list filters or pagination', async () => {
    const { summarizeStudentFeedback } = require('../../services/studentFeedbackService');
    summarizeStudentFeedback.mockResolvedValueOnce({
      total: 4,
      open: 1,
      inProgress: 1,
      closed: 2,
      unresolved: 2,
    });

    const res = await request(app)
      .get('/api/admin/student-feedback/summary?status=closed&kind=wish&page=3&pageSize=5')
      .set('x-test-role', 'office_staff')
      .set('x-test-staff-level', 'event_lead');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      total: 4,
      open: 1,
      inProgress: 1,
      closed: 2,
      unresolved: 2,
    });
    expect(summarizeStudentFeedback).toHaveBeenCalledWith();
  });

  it('passes only the requested sort into the list service', async () => {
    const { listStudentFeedback } = require('../../services/studentFeedbackService');
    const res = await request(app)
      .get('/api/admin/student-feedback?sortBy=updatedAt&sortOrder=asc&page=2')
      .set('x-test-role', 'office_staff')
      .set('x-test-staff-level', 'event_lead');
    expect(res.status).toBe(200);
    expect(listStudentFeedback).toHaveBeenCalledWith(expect.objectContaining({
      sortBy: 'updatedAt',
      sortOrder: 'asc',
      page: '2',
    }));
  });

  it('returns 400 when the list service rejects an illegal sort', async () => {
    const { listStudentFeedback } = require('../../services/studentFeedbackService');
    const err = new Error('排序欄位不正確');
    err.status = 400;
    err.code = 'STUDENT_FEEDBACK_INVALID';
    listStudentFeedback.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/admin/student-feedback?sortBy=email')
      .set('x-test-role', 'admin');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('STUDENT_FEEDBACK_INVALID');
  });

  it('maps a summary database error to the query-failed response', async () => {
    const { summarizeStudentFeedback } = require('../../services/studentFeedbackService');
    const failure = new Error('SELECT failed');
    failure.name = 'SequelizeDatabaseError';
    summarizeStudentFeedback.mockRejectedValueOnce(failure);

    const res = await request(app)
      .get('/api/admin/student-feedback/summary')
      .set('x-test-role', 'admin');
    expect(res.status).toBe(500);
    expect(res.body.message).toContain('資料庫查詢失敗');
    expect(JSON.stringify(res.body)).not.toMatch(/@|學號|studentId/i);
  });

  function viewOnly(requestBuilder) {
    return requestBuilder
      .set('x-test-role', 'office_staff')
      .set('x-test-staff-level', 'event_lead')
      .set('x-test-revoke', 'can_manage_student_feedback');
  }

  it('hides internal notes from view-only readers and still lets them open the case', async () => {
    const { getStudentFeedback, listStudentFeedbackEvents } = require('../../services/studentFeedbackService');
    const anonymous = await request(app).get('/api/admin/student-feedback/3');
    expect(anonymous.status).toBe(401);

    const denied = await request(app)
      .get('/api/admin/student-feedback/3')
      .set('x-test-role', 'teacher')
      .set('x-test-teacher-level', 'regular');
    expect(denied.status).toBe(403);

    const view = await viewOnly(request(app).get('/api/admin/student-feedback/3'));
    expect(view.status).toBe(200);
    expect(getStudentFeedback).toHaveBeenCalledWith('3', { includeInternal: false });

    const events = await viewOnly(request(app).get('/api/admin/student-feedback/3/events'));
    expect(events.status).toBe(200);
    expect(listStudentFeedbackEvents).toHaveBeenCalledWith('3', expect.objectContaining({
      includeInternal: false,
    }));
  });

  it('includes internal notes for an account that can manage the case', async () => {
    const { getStudentFeedback, listStudentFeedbackEvents } = require('../../services/studentFeedbackService');
    const detail = await request(app)
      .get('/api/admin/student-feedback/3')
      .set('x-test-role', 'office_staff')
      .set('x-test-staff-level', 'event_lead');
    expect(detail.status).toBe(200);
    expect(getStudentFeedback).toHaveBeenCalledWith('3', { includeInternal: true });

    const events = await request(app)
      .get('/api/admin/student-feedback/3/events')
      .set('x-test-role', 'office_staff')
      .set('x-test-staff-level', 'event_lead');
    expect(events.status).toBe(200);
    expect(listStudentFeedbackEvents).toHaveBeenCalledWith('3', expect.objectContaining({
      includeInternal: true,
    }));
  });

  it('does not create a note or an audit event when the caller cannot manage', async () => {
    const { addStaffNote, updateStudentFeedbackCase } = require('../../services/studentFeedbackService');
    const anonymous = await request(app)
      .post('/api/admin/student-feedback/3/notes')
      .send({ message: '內部備註不該寫入' });
    expect(anonymous.status).toBe(401);

    const view = await viewOnly(request(app)
      .post('/api/admin/student-feedback/3/notes')
      .send({ message: '內部備註不該寫入' }));
    expect(view.status).toBe(403);
    expect(addStaffNote).not.toHaveBeenCalled();

    const patch = await viewOnly(request(app)
      .patch('/api/admin/student-feedback/3')
      .send({ status: 'closed' }));
    expect(patch.status).toBe(403);
    expect(updateStudentFeedbackCase).not.toHaveBeenCalled();

    const priority = await viewOnly(request(app)
      .patch('/api/admin/student-feedback/3')
      .send({ priority: 'P0' }));
    expect(priority.status).toBe(403);
    expect(updateStudentFeedbackCase).not.toHaveBeenCalled();
  });
});
