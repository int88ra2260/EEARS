'use strict';

jest.mock('../models', () => ({
  sequelize: {
    transaction: jest.fn(),
  },
  StudentFeedback: {
    create: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  StudentFeedbackMessage: {
    create: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
  },
  StudentFeedbackEvent: {
    bulkCreate: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  Teacher: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
}));

jest.mock('../services/emailLogService', () => ({
  sendEmailWithLog: jest.fn(),
}));

const {
  sequelize,
  StudentFeedback,
  StudentFeedbackMessage,
  StudentFeedbackEvent,
  Teacher,
} = require('../models');
const { sendEmailWithLog } = require('../services/emailLogService');
const { emailTemplates } = require('../config/email');
const {
  CENTER_EMAIL,
  RECEIPT_SENT,
  RECEIPT_SAVED,
  submitStudentFeedback,
  summarizeStudentFeedback,
  listStudentFeedback,
  getStudentFeedback,
  listStudentFeedbackEvents,
  updateStudentFeedbackCase,
  addStaffReply,
  addStaffNote,
  getMyStudentFeedback,
  addStudentFollowUp,
} = require('../services/studentFeedbackService');

const account = {
  studentId: 'B123456789',
  name: '王小明',
  email: 'student@example.com',
  emailVerifiedAt: '2026-11-01T00:00:00.000Z',
};

function mockRow(id = 7) {
  const row = {
    id,
    createdAt: new Date('2026-11-08T06:00:00.000Z'),
    update: jest.fn(async (patch) => Object.assign(row, patch)),
  };
  return row;
}

describe('studentFeedbackService', () => {
  let transaction;

  beforeEach(() => {
    jest.clearAllMocks();
    transaction = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    sequelize.transaction.mockImplementation(async () => transaction);
    StudentFeedback.count.mockResolvedValue(0);
    StudentFeedbackMessage.count.mockResolvedValue(0);
    StudentFeedbackMessage.findAll.mockResolvedValue([]);
    StudentFeedbackEvent.bulkCreate.mockResolvedValue([]);
    StudentFeedbackEvent.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
  });

  it('stores the logged-in student and emails the center', async () => {
    const row = mockRow();
    StudentFeedback.create.mockResolvedValue(row);
    sendEmailWithLog.mockResolvedValue({});

    const result = await submitStudentFeedback({
      account,
      kind: 'problem',
      category: 'reservation',
      message: '  預約按鈕按下去沒有反應。  ',
      priority: 'P0',
    });

    expect(StudentFeedback.create).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 'B123456789',
      studentName: '王小明',
      email: 'student@example.com',
      emailVerified: true,
      kind: 'problem',
      category: 'reservation',
      message: '預約按鈕按下去沒有反應。',
      status: 'open',
      replyRequested: true,
    }));
    expect(StudentFeedback.create.mock.calls[0][0]).not.toHaveProperty('priority');
    expect(sendEmailWithLog).toHaveBeenCalledWith(
      'studentFeedbackNotice',
      {
        centerEmail: CENTER_EMAIL,
        caseId: 7,
        adminUrl: expect.stringMatching(/^https?:\/\/[^/?#]+\/admin\/student-feedback$/),
      },
      expect.objectContaining({ relatedEntityType: 'student_feedback', relatedEntityId: 7 }),
    );
    expect(JSON.stringify(sendEmailWithLog.mock.calls[0][1])).not.toMatch(/B123456789|王小明|student@example\.com|預約按鈕/);
    expect(row.update).toHaveBeenCalledWith({ emailStatus: 'sent' });
    expect(result.message).toBe(RECEIPT_SENT);
    expect(result.message).toContain('07-5252000');
    expect(result.message).toContain('09:00');
  });

  it('keeps the report when the center email fails', async () => {
    const row = mockRow(8);
    StudentFeedback.create.mockResolvedValue(row);
    sendEmailWithLog.mockRejectedValue(new Error('smtp down'));

    const result = await submitStudentFeedback({
      account,
      kind: 'wish',
      category: 'other',
      message: '希望活動可以選擇線上參加。',
    });

    expect(row.update).toHaveBeenCalledWith({ emailStatus: 'failed' });
    expect(result.message).toBe(RECEIPT_SAVED);
    expect(result.kind).toBe('wish');
  });

  it('rejects a short message and a bad category', async () => {
    await expect(submitStudentFeedback({
      account,
      kind: 'problem',
      category: 'reservation',
      message: '太短',
    })).rejects.toMatchObject({ status: 400, code: 'STUDENT_FEEDBACK_INVALID' });

    await expect(submitStudentFeedback({
      account,
      kind: 'problem',
      category: 'secret',
      message: '這是一段夠長的說明。',
    })).rejects.toMatchObject({ status: 400 });
    expect(StudentFeedback.create).not.toHaveBeenCalled();
  });

  it('limits repeated submissions from the same student', async () => {
    StudentFeedback.count.mockResolvedValue(5);
    await expect(submitStudentFeedback({
      account,
      kind: 'problem',
      category: 'account',
      message: '收不到驗證碼，請幫忙看一下。',
    })).rejects.toMatchObject({ status: 429, code: 'STUDENT_FEEDBACK_RATE_LIMITED' });
    expect(StudentFeedback.create).not.toHaveBeenCalled();
  });

  it('lists only the requested kind for staff', async () => {
    StudentFeedback.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{
        get: () => ({
          id: 3,
          studentId: 'B123456789',
          studentName: '王小明',
          email: 'student@example.com',
          emailVerified: false,
          kind: 'wish',
          category: 'survey',
          message: '問卷題目希望再短一點。',
          emailStatus: 'sent',
          status: 'open',
          replyRequested: true,
          createdAt: new Date('2026-11-08T06:00:00.000Z'),
          updatedAt: new Date('2026-11-09T01:00:00.000Z'),
        }),
      }],
    });

    const result = await listStudentFeedback({ kind: 'wish', page: 2, pageSize: 20 });
    expect(StudentFeedback.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { kind: 'wish' },
      limit: 20,
      offset: 20,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    }));
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      kindLabel: '建議／許願',
      categoryLabel: '問卷',
      statusLabel: '待處理',
    });
    expect(result.items[0].messages).toBeUndefined();
    expect(result.items[0].updatedAt).toEqual(new Date('2026-11-09T01:00:00.000Z'));
  });

  it('sends the center a case number and admin link without student details', () => {
    const mail = emailTemplates.studentFeedbackNotice({
      centerEmail: CENTER_EMAIL,
      caseId: 7,
      adminUrl: 'http://emieears-siwan.nsysu.edu.tw/admin/student-feedback',
      studentEmail: 'student@example.com',
      studentId: 'B123456789',
      studentName: '王小明',
      message: '收不到驗證碼。',
      replyTo: 'student@example.com',
    });
    expect(mail.to).toBe(CENTER_EMAIL);
    expect(mail.replyTo).toBeUndefined();
    expect(mail.subject).toBe('[EEARS] 新的學生回報 #7');
    expect(mail.text).toContain('案件編號：#7');
    expect(mail.text).toContain('http://emieears-siwan.nsysu.edu.tw/admin/student-feedback');
    const leaked = ['B123456789', '王小明', 'student@example.com', '收不到驗證碼', 'token=', 'jwt'];
    leaked.forEach((secret) => {
      expect(mail.subject).not.toContain(secret);
      expect(mail.text).not.toContain(secret);
    });
  });

  it('refuses a report before the mailbox is verified', async () => {
    await expect(submitStudentFeedback({
      account: { ...account, emailVerifiedAt: null },
      kind: 'problem',
      category: 'account',
      message: '收不到驗證碼，請幫忙看一下。',
    })).rejects.toMatchObject({
      status: 403,
      code: 'EMAIL_ACTIVATION_REQUIRED',
      redirectUrl: '/student/account',
    });
    expect(StudentFeedback.create).not.toHaveBeenCalled();
  });

  it('stores that the student does not require a reply', async () => {
    const row = mockRow(9);
    StudentFeedback.create.mockResolvedValue(row);
    sendEmailWithLog.mockResolvedValue({});
    await submitStudentFeedback({
      account,
      kind: 'wish',
      category: 'other',
      message: '希望活動可以選擇線上參加。',
      replyRequested: false,
    });
    expect(StudentFeedback.create).toHaveBeenCalledWith(expect.objectContaining({
      replyRequested: false,
    }));
  });

  function storedCase(overrides = {}) {
    const row = {
      id: 7,
      studentId: 'B123456789',
      studentName: '王小明',
      email: 'student@example.com',
      emailVerified: true,
      kind: 'problem',
      category: 'reservation',
      message: '預約按鈕按下去沒有反應。',
      emailStatus: 'sent',
      status: 'in_progress',
      replyRequested: true,
      assignedTeacherId: null,
      assignee: null,
      closedAt: null,
      createdAt: new Date('2026-11-08T06:00:00.000Z'),
      update: jest.fn(async (patch) => Object.assign(row, patch)),
      ...overrides,
    };
    return row;
  }

  it('refuses to close a reply request before a public reply exists', async () => {
    const row = storedCase();
    StudentFeedback.findByPk.mockResolvedValue(row);
    StudentFeedbackMessage.count.mockResolvedValue(0);
    await expect(updateStudentFeedbackCase({
      id: 7,
      patch: { status: 'closed' },
    })).rejects.toMatchObject({ status: 409, code: 'STUDENT_FEEDBACK_REPLY_REQUIRED' });
    expect(row.update).not.toHaveBeenCalled();
  });

  it('closes a case that did not ask for a reply', async () => {
    const row = storedCase({ replyRequested: false });
    StudentFeedback.findByPk.mockResolvedValue(row);
    const item = await updateStudentFeedbackCase({ id: 7, patch: { status: 'closed' } });
    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'closed' }),
      expect.objectContaining({ transaction }),
    );
    expect(item.status).toBe('closed');
    expect(item.email).toBe('student@example.com');
  });

  it('emails the student when staff write a public reply, without the reply text', async () => {
    const row = storedCase({ status: 'open' });
    StudentFeedback.findByPk.mockResolvedValue(row);
    const created = { id: 4, update: jest.fn(async (patch) => Object.assign(created, patch)) };
    StudentFeedbackMessage.create.mockResolvedValue(created);
    sendEmailWithLog.mockResolvedValue({});

    const result = await addStaffReply({
      id: 7,
      teacher: { id: 2 },
      message: '請改用另一個瀏覽器再試一次。',
    });

    expect(StudentFeedbackMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      visibility: 'public',
      authorType: 'staff',
      body: '請改用另一個瀏覽器再試一次。',
    }), expect.objectContaining({ transaction }));
    expect(sendEmailWithLog).toHaveBeenCalledWith(
      'studentFeedbackReply',
      expect.objectContaining({ studentEmail: 'student@example.com' }),
      expect.any(Object),
    );
    const mail = emailTemplates.studentFeedbackReply(sendEmailWithLog.mock.calls[0][1]);
    expect(mail.text).not.toContain('請改用另一個瀏覽器');
    expect(mail.text).toContain('/student/account');
    expect(row.status).toBe('in_progress');
    expect(result.notice).toContain('已回覆');
  });

  it('hides internal notes from the student view and reopens a closed case', async () => {
    const row = storedCase({
      status: 'closed',
      closedAt: new Date('2026-11-09T00:00:00.000Z'),
      priority: 'P1',
    });
    StudentFeedback.findByPk.mockResolvedValue(row);
    StudentFeedbackMessage.findAll.mockResolvedValue([
      { id: 1, visibility: 'internal', authorType: 'staff', body: '先內部確認', createdAt: new Date() },
      { id: 2, visibility: 'public', authorType: 'staff', body: '已幫你看過', createdAt: new Date() },
    ]);
    const seen = await getMyStudentFeedback({ account, id: 7 });
    expect(seen.messages.map((entry) => entry.body)).toEqual(['已幫你看過']);
    expect(seen.messages[0].authorLabel).toBe('英語中心');
    expect(seen.email).toBeUndefined();
    expect(seen.priority).toBeUndefined();

    StudentFeedbackMessage.findAll.mockResolvedValue([
      { id: 2, visibility: 'public', authorType: 'staff', body: '已幫你看過', createdAt: new Date() },
      { id: 3, visibility: 'public', authorType: 'student', body: '還是一樣', createdAt: new Date() },
    ]);
    await addStudentFollowUp({ account, id: 7, message: '還是一樣' });
    expect(row.update).toHaveBeenCalledWith(
      { status: 'in_progress', closedAt: null },
      expect.objectContaining({ transaction }),
    );
    expect(StudentFeedbackEvent.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        eventType: 'STATUS_CHANGED',
        actorType: 'student',
        actorStudentId: 'B123456789',
        beforeValue: { status: 'closed' },
        afterValue: { status: 'in_progress' },
      }),
    ], expect.objectContaining({ transaction }));
  });

  it('rejects an assignee outside the center staff', async () => {
    const row = storedCase();
    StudentFeedback.findByPk.mockResolvedValue(row);
    Teacher.findByPk.mockResolvedValue({
      id: 8,
      role: 'teacher',
      teacherLevel: 'regular',
      isActive: true,
      isDemo: false,
    });
    await expect(updateStudentFeedbackCase({
      id: 7,
      patch: { assignedTeacherId: 8 },
    })).rejects.toMatchObject({ status: 400 });
  });

  it('counts every status from one grouped query and ignores list filters', async () => {
    StudentFeedback.findAll.mockResolvedValue([
      { status: 'open', n: '24' },
      { status: 'in_progress', n: 13 },
      { status: 'closed', n: '91' },
      { status: 'archived', n: '2' },
    ]);

    const summary = await summarizeStudentFeedback();

    expect(summary).toEqual({
      total: 130,
      open: 24,
      inProgress: 13,
      closed: 91,
      unresolved: 37,
    });
    const query = StudentFeedback.findAll.mock.calls[0][0];
    expect(query.group).toEqual(['status']);
    expect(query.raw).toBe(true);
    expect(query.limit).toBeUndefined();
    expect(query.where).toBeUndefined();
  });

  it('returns zeros when the table is empty', async () => {
    StudentFeedback.findAll.mockResolvedValue([]);
    await expect(summarizeStudentFeedback()).resolves.toEqual({
      total: 0,
      open: 0,
      inProgress: 0,
      closed: 0,
      unresolved: 0,
    });
  });

  it('lets a database failure surface without inventing counts', async () => {
    const failure = new Error('db down');
    failure.name = 'SequelizeDatabaseError';
    StudentFeedback.findAll.mockRejectedValue(failure);
    await expect(summarizeStudentFeedback()).rejects.toBe(failure);
  });

  it('sorts createdAt, updatedAt, and id in the database with a stable id tie-break', async () => {
    StudentFeedback.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await listStudentFeedback({ sortBy: 'createdAt', sortOrder: 'asc', page: 1 });
    await listStudentFeedback({ sortBy: 'updatedAt', sortOrder: 'desc', page: 3, pageSize: 20 });
    await listStudentFeedback({ sortBy: 'id', sortOrder: 'asc' });

    const orders = StudentFeedback.findAndCountAll.mock.calls.map((call) => call[0].order);
    expect(orders[0]).toEqual([['createdAt', 'ASC'], ['id', 'DESC']]);
    expect(orders[1]).toEqual([['updatedAt', 'DESC'], ['id', 'DESC']]);
    expect(orders[2]).toEqual([['id', 'ASC']]);
    expect(StudentFeedback.findAndCountAll.mock.calls[1][0]).toEqual(expect.objectContaining({
      limit: 20,
      offset: 40,
    }));
  });

  it('rejects a sort field or direction outside the whitelist', async () => {
    await expect(listStudentFeedback({ sortBy: 'email' })).rejects.toMatchObject({
      status: 400,
      code: 'STUDENT_FEEDBACK_INVALID',
    });
    await expect(listStudentFeedback({ sortBy: 'createdAt', sortOrder: 'DROP TABLE' })).rejects.toMatchObject({
      status: 400,
      code: 'STUDENT_FEEDBACK_INVALID',
    });
    expect(StudentFeedback.findAndCountAll).not.toHaveBeenCalled();
  });

  it('hides internal notes from a view-only detail and from message search', async () => {
    const row = storedCase();
    StudentFeedback.findByPk.mockResolvedValue(row);
    StudentFeedbackMessage.findAll.mockResolvedValue([
      { id: 1, visibility: 'internal', authorType: 'staff', body: '內部判斷', createdAt: new Date() },
      { id: 2, visibility: 'public', authorType: 'staff', body: '公開回覆', createdAt: new Date() },
    ]);

    const hidden = await getStudentFeedback(7, { includeInternal: false });
    expect(hidden.messages.map((entry) => entry.body)).toEqual(['公開回覆']);
    expect(StudentFeedbackMessage.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { feedbackId: 7, visibility: 'public' },
    }));

    StudentFeedbackMessage.findAll.mockResolvedValue([
      { id: 1, visibility: 'internal', body: '內部判斷' },
      { id: 2, visibility: 'public', body: '公開回覆' },
    ]);
    const shown = await getStudentFeedback(7, { includeInternal: true });
    expect(shown.messages.map((entry) => entry.body)).toEqual(['內部判斷', '公開回覆']);

    StudentFeedbackMessage.findAll.mockResolvedValue([]);
    StudentFeedback.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await listStudentFeedback({ q: '內部判斷', includeInternal: false });
    expect(StudentFeedbackMessage.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { body: { [require('sequelize').Op.like]: '%內部判斷%' }, visibility: 'public' },
    }));
  });

  it('records status and assignee changes with the actor and skips an unchanged value', async () => {
    const row = storedCase({ status: 'open', replyRequested: false, assignedTeacherId: null });
    StudentFeedback.findByPk.mockResolvedValue(row);
    Teacher.findByPk.mockResolvedValue({
      id: 4,
      role: 'office_staff',
      staffLevel: 'event_lead',
      isActive: true,
      isDemo: false,
    });

    await updateStudentFeedbackCase({
      id: 7,
      patch: { status: 'closed', assignedTeacherId: 4 },
      actor: { id: 9 },
      requestId: 'req-1',
    });

    const events = StudentFeedbackEvent.bulkCreate.mock.calls[0][0];
    expect(events).toEqual([
      expect.objectContaining({
        eventType: 'STATUS_CHANGED',
        actorTeacherId: 9,
        beforeValue: { status: 'open' },
        afterValue: { status: 'closed' },
        requestId: 'req-1',
      }),
      expect.objectContaining({
        eventType: 'ASSIGNEE_CHANGED',
        actorType: 'staff',
        actorTeacherId: 9,
        beforeValue: { assignedTeacherId: null },
        afterValue: { assignedTeacherId: 4 },
        requestId: 'req-1',
      }),
    ]);
    expect(events[0].createdAt).toBeInstanceOf(Date);
    expect(StudentFeedback.findByPk).toHaveBeenCalledWith(7, expect.objectContaining({
      transaction,
      lock: 'UPDATE',
    }));
    expect(transaction.commit).toHaveBeenCalled();

    StudentFeedbackEvent.bulkCreate.mockClear();
    row.update.mockClear();
    await updateStudentFeedbackCase({
      id: 7,
      patch: { status: 'closed', assignedTeacherId: 4 },
      actor: { id: 9 },
    });
    expect(row.update).not.toHaveBeenCalled();
    expect(StudentFeedbackEvent.bulkCreate).not.toHaveBeenCalled();
  });

  it('rolls back when saving the case or the event fails', async () => {
    const row = storedCase({ replyRequested: false, status: 'open' });
    StudentFeedback.findByPk.mockResolvedValue(row);
    row.update.mockRejectedValueOnce(new Error('update failed'));
    await expect(updateStudentFeedbackCase({
      id: 7,
      patch: { status: 'closed' },
      actor: { id: 9 },
    })).rejects.toThrow('update failed');
    expect(StudentFeedbackEvent.bulkCreate).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();

    transaction.rollback.mockClear();
    row.update.mockResolvedValue(undefined);
    StudentFeedbackEvent.bulkCreate.mockRejectedValueOnce(new Error('event failed'));
    await expect(updateStudentFeedbackCase({
      id: 7,
      patch: { status: 'closed' },
      actor: { id: 9 },
    })).rejects.toThrow('event failed');
    expect(transaction.rollback).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  it('writes an internal note without putting the note text on the status event', async () => {
    const row = storedCase({ status: 'open' });
    StudentFeedback.findByPk.mockResolvedValue(row);
    await addStaffNote({ id: 7, teacher: { id: 3 }, message: '先內部確認原因' });
    expect(StudentFeedbackMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      visibility: 'internal',
      body: '先內部確認原因',
    }), expect.objectContaining({ transaction }));
    const event = StudentFeedbackEvent.bulkCreate.mock.calls[0][0][0];
    expect(event).toEqual(expect.objectContaining({
      eventType: 'STATUS_CHANGED',
      beforeValue: { status: 'open' },
      afterValue: { status: 'in_progress' },
    }));
    expect(JSON.stringify(event)).not.toContain('先內部確認原因');
  });

  it('lists staff events in a stable order and omits internal event rows for view-only', async () => {
    StudentFeedback.findByPk.mockResolvedValue(storedCase());
    StudentFeedbackEvent.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{
        id: 5,
        feedbackId: 7,
        eventType: 'STATUS_CHANGED',
        visibility: 'staff',
        actorType: 'staff',
        actorTeacherId: 9,
        beforeValue: { status: 'open', body: '不該出現' },
        afterValue: { status: 'in_progress' },
        createdAt: new Date('2026-11-09T01:00:00.000Z'),
      }],
    });

    const result = await listStudentFeedbackEvents(7, { includeInternal: false, page: 1 });
    expect(StudentFeedbackEvent.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { feedbackId: 7, visibility: 'staff' },
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
    }));
    expect(result.items[0].beforeValue).toEqual({ status: 'open' });
    expect(JSON.stringify(result.items[0])).not.toContain('不該出現');

    StudentFeedback.findByPk.mockResolvedValueOnce(null);
    await expect(listStudentFeedbackEvents(99)).rejects.toMatchObject({ status: 404 });
  });

  it('sets a priority, keeps an unchanged value quiet, and rejects an unknown priority', async () => {
    const row = storedCase({ priority: null });
    StudentFeedback.findByPk.mockResolvedValue(row);

    const updated = await updateStudentFeedbackCase({
      id: 7,
      patch: { priority: 'P1' },
      actor: { id: 9 },
    });
    expect(StudentFeedbackEvent.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        eventType: 'PRIORITY_CHANGED',
        actorTeacherId: 9,
        beforeValue: { priority: null },
        afterValue: { priority: 'P1' },
      }),
    ], expect.objectContaining({ transaction }));
    expect(updated.priority).toBe('P1');
    expect(updated.priorityLabel).toBe('P1（高）');
    expect(transaction.commit).toHaveBeenCalled();

    StudentFeedbackEvent.bulkCreate.mockClear();
    await updateStudentFeedbackCase({ id: 7, patch: { priority: 'P1' }, actor: { id: 9 } });
    expect(StudentFeedbackEvent.bulkCreate).not.toHaveBeenCalled();

    await expect(updateStudentFeedbackCase({
      id: 7,
      patch: { priority: 'urgent' },
    })).rejects.toMatchObject({ status: 400 });
  });

  it('rolls back when the priority event insert fails', async () => {
    const row = storedCase({ priority: null, status: 'open' });
    StudentFeedback.findByPk.mockResolvedValue(row);
    row.update.mockResolvedValue(undefined);
    StudentFeedbackEvent.bulkCreate.mockRejectedValueOnce(new Error('priority event failed'));
    await expect(updateStudentFeedbackCase({
      id: 7,
      patch: { priority: 'P0' },
      actor: { id: 9 },
    })).rejects.toThrow('priority event failed');
    expect(transaction.rollback).toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  it('filters category and priority in the query and can list rows without a priority', async () => {
    StudentFeedback.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [storedCase({ priority: null, category: 'learning_journey' })],
    });
    const listed = await listStudentFeedback({
      category: 'learning_journey',
      priority: 'unset',
      sortBy: 'priority',
      sortOrder: 'asc',
    });
    expect(StudentFeedback.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ category: 'learning_journey', priority: null }),
      order: expect.arrayContaining([['priority', 'ASC']]),
    }));
    expect(listed.items[0].priority).toBeNull();
    expect(listed.items[0].priorityLabel).toBe('未設定');
    expect(listed.items[0].categoryLabel).toBe('學習歷程');

    await expect(listStudentFeedback({ priority: 'P9' })).rejects.toMatchObject({ status: 400 });
    await expect(listStudentFeedback({ category: 'secret' })).rejects.toMatchObject({ status: 400 });
    await expect(listStudentFeedback({ sortBy: 'message' })).rejects.toMatchObject({ status: 400 });
  });
});
