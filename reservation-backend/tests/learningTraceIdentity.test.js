'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models', () => ({
  StudentAccount: { findByPk: jest.fn() },
  LearningTraceEvent: { findOne: jest.fn(), create: jest.fn(), findAll: jest.fn() },
  LjStudentEvent: { findOne: jest.fn(), create: jest.fn() },
  Reservation: { findOne: jest.fn(), findAll: jest.fn() },
  Event: {},
  LjAnalyticStudent: { findAll: jest.fn() },
  EnglishLearningPassport: { findOne: jest.fn() },
  Teacher: {},
}));

const { secretKey } = require('../config/jwtSecret');
const { TOKEN_TYP } = require('../services/studentAuthService');
const { StudentAccount, LearningTraceEvent, LjStudentEvent } = require('../models');
const { recordLearningTrace } = require('../services/learningTraceService');
const learningTraceRouter = require('../routes/learningTraceRouter');

const STUDENT_ID = '12345678';
const OTHER_STUDENT_ID = '87654321';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', learningTraceRouter);
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message,
      tracePersisted: err.tracePersisted === true,
    });
  });
  return app;
}

function studentToken(extra = {}, options = {}) {
  return jwt.sign({
    typ: TOKEN_TYP,
    id: 7,
    studentId: STUDENT_ID,
    name: '林同學',
    email: 'student@example.com',
    ...extra,
  }, secretKey, { expiresIn: options.expiresIn || '1h' });
}

function traceBody(overrides = {}) {
  return {
    traceId: 'wb_identity01',
    gameId: 'word_bridge',
    eventType: 'session_complete',
    clientSessionId: 'ls_abc123',
    ...overrides,
  };
}

describe('learning trace trusted student identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StudentAccount.findByPk.mockResolvedValue({
      id: 7,
      status: 'active',
      studentId: STUDENT_ID,
      passwordChangedAt: null,
    });
    LearningTraceEvent.findOne.mockResolvedValue(null);
    LearningTraceEvent.create.mockImplementation(async (data) => ({ id: 11, ...data }));
    LjStudentEvent.findOne.mockResolvedValue(null);
    LjStudentEvent.create.mockResolvedValue({ id: 21 });
  });

  it('T2-P1 projects the student id from the token when the body omits it', async () => {
    const res = await request(createApp())
      .post('/api/learning-traces?studentId=' + OTHER_STUDENT_ID)
      .set('Authorization', `Bearer ${studentToken()}`)
      .send(traceBody());

    expect(res.status).toBe(201);
    expect(res.body.data.projected).toBe(true);
    expect(LearningTraceEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      studentId: STUDENT_ID,
    }));
    expect(LjStudentEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      studentId: STUDENT_ID,
      sourceRecordId: 'trace:wb_identity01',
    }));
  });

  it('T2-P2 does not project a non-complete event', async () => {
    const res = await request(createApp())
      .post('/api/learning-traces')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send(traceBody({ eventType: 'session_start', traceId: 'wb_start0001' }));

    expect(res.status).toBe(201);
    expect(res.body.data.projected).toBe(false);
    expect(LearningTraceEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      studentId: STUDENT_ID,
      eventType: 'session_start',
    }));
    expect(LjStudentEvent.create).not.toHaveBeenCalled();
  });

  it('T2-P3 accepts an anonymous funnel event and stores no student id', async () => {
    const res = await request(createApp())
      .post('/api/learning-traces')
      .send(traceBody({
        traceId: 'af_funnel0001',
        gameId: 'activity_recommendation',
        eventType: 'funnel_impression',
        studentId: OTHER_STUDENT_ID,
        payload: { studentId: OTHER_STUDENT_ID, activityKey: 'english-table' },
      }));

    expect(res.status).toBe(201);
    expect(res.body.data.projected).toBe(false);
    expect(LearningTraceEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      studentId: null,
      payload: { activityKey: 'english-table' },
    }));
    expect(LjStudentEvent.create).not.toHaveBeenCalled();
  });

  it('T2-N1 rejects a body student id that conflicts with the token and writes nothing', async () => {
    const res = await request(createApp())
      .post('/api/learning-traces')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send(traceBody({ studentId: OTHER_STUDENT_ID }));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STUDENT_ID_CONFLICT');
    expect(LearningTraceEvent.create).not.toHaveBeenCalled();
    expect(LjStudentEvent.create).not.toHaveBeenCalled();
  });

  it('T2-N2 ignores a session-storage style student id when no token is present', async () => {
    const res = await request(createApp())
      .post('/api/learning-traces')
      .send(traceBody({ studentId: OTHER_STUDENT_ID, traceId: 'wb_anon00001' }));

    expect(res.status).toBe(201);
    expect(LearningTraceEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      studentId: null,
    }));
    expect(LjStudentEvent.create).not.toHaveBeenCalled();
  });

  it('T2-N3 does not treat a staff token as a student', async () => {
    const staffToken = jwt.sign(
      { id: 1, role: 'admin', teacherLevel: 'executive' },
      secretKey,
      { expiresIn: '1h' }
    );
    const res = await request(createApp())
      .post('/api/learning-traces')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(traceBody({ studentId: OTHER_STUDENT_ID }));

    expect(res.status).toBe(401);
    expect(LearningTraceEvent.create).not.toHaveBeenCalled();
    expect(LjStudentEvent.create).not.toHaveBeenCalled();
  });

  it('T2-N4 does not create a second projection for the same trace', async () => {
    const existingTrace = {
      id: 11,
      traceId: 'wb_identity01',
      eventType: 'session_complete',
      studentId: STUDENT_ID,
      gameId: 'word_bridge',
    };
    LearningTraceEvent.findOne.mockResolvedValue(existingTrace);
    LjStudentEvent.findOne.mockResolvedValue({ id: 21 });

    const res = await request(createApp())
      .post('/api/learning-traces')
      .set('Authorization', `Bearer ${studentToken()}`)
      .send(traceBody());

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(false);
    expect(res.body.data.projected).toBe(false);
    expect(LearningTraceEvent.create).not.toHaveBeenCalled();
    expect(LjStudentEvent.create).not.toHaveBeenCalled();
    expect(LjStudentEvent.destroy).toBeUndefined();
  });

  it('T2-F1 rejects a malformed token without storing the body student id', async () => {
    const res = await request(createApp())
      .post('/api/learning-traces')
      .set('Authorization', 'Bearer not-a-jwt')
      .send(traceBody({ studentId: OTHER_STUDENT_ID }));

    expect(res.status).toBe(401);
    expect(LearningTraceEvent.create).not.toHaveBeenCalled();
  });

  it('T2-F2 rejects an expired student token instead of falling back to anonymous', async () => {
    const res = await request(createApp())
      .post('/api/learning-traces')
      .set('Authorization', `Bearer ${studentToken({}, { expiresIn: '-10s' })}`)
      .send(traceBody());

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
    expect(LearningTraceEvent.create).not.toHaveBeenCalled();
  });

  it('keeps the trace when projection fails and retries projection without a second trace', async () => {
    LjStudentEvent.create.mockRejectedValueOnce(new Error('projection down'));

    await expect(recordLearningTrace(traceBody({ traceId: 'wb_retry0001' }), {
      trustedStudentId: STUDENT_ID,
    })).rejects.toMatchObject({ message: 'projection down', tracePersisted: true });
    expect(LearningTraceEvent.create).toHaveBeenCalledTimes(1);
    const persisted = LearningTraceEvent.create.mock.calls[0][0];
    expect(persisted.studentId).toBe(STUDENT_ID);

    LearningTraceEvent.findOne.mockResolvedValue({ id: 11, ...persisted });
    LjStudentEvent.create.mockResolvedValue({ id: 22 });
    const retried = await recordLearningTrace(traceBody({ traceId: 'wb_retry0001' }), {
      trustedStudentId: STUDENT_ID,
    });

    expect(retried.created).toBe(false);
    expect(retried.projected).toBe(true);
    expect(LearningTraceEvent.create).toHaveBeenCalledTimes(1);
    expect(LjStudentEvent.create).toHaveBeenCalledTimes(2);
  });

  it('does not attach a token to an existing anonymous trace or rewrite another student', async () => {
    LearningTraceEvent.findOne.mockResolvedValue({
      id: 11,
      traceId: 'wb_identity01',
      eventType: 'session_complete',
      studentId: null,
    });
    const anonymousRetry = await recordLearningTrace(traceBody(), {
      trustedStudentId: STUDENT_ID,
    });
    expect(anonymousRetry.projected).toBe(false);
    expect(LjStudentEvent.create).not.toHaveBeenCalled();

    LearningTraceEvent.findOne.mockResolvedValue({
      id: 12,
      traceId: 'wb_identity01',
      eventType: 'session_complete',
      studentId: OTHER_STUDENT_ID,
    });
    await expect(recordLearningTrace(traceBody(), {
      trustedStudentId: STUDENT_ID,
    })).rejects.toMatchObject({ status: 409, code: 'STUDENT_ID_CONFLICT' });
    expect(LearningTraceEvent.create).not.toHaveBeenCalled();
  });
});
