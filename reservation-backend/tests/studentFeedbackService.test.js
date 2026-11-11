'use strict';

jest.mock('../models', () => ({
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
  Teacher: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
}));

jest.mock('../services/emailLogService', () => ({
  sendEmailWithLog: jest.fn(),
}));

const { StudentFeedback, StudentFeedbackMessage, Teacher } = require('../models');
const { sendEmailWithLog } = require('../services/emailLogService');
const { emailTemplates } = require('../config/email');
const {
  CENTER_EMAIL,
  RECEIPT_SENT,
  RECEIPT_SAVED,
  submitStudentFeedback,
  listStudentFeedback,
  updateStudentFeedbackCase,
  addStaffReply,
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
  beforeEach(() => {
    jest.clearAllMocks();
    StudentFeedback.count.mockResolvedValue(0);
    StudentFeedbackMessage.count.mockResolvedValue(0);
    StudentFeedbackMessage.findAll.mockResolvedValue([]);
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
    expect(sendEmailWithLog).toHaveBeenCalledWith(
      'studentFeedbackNotice',
      expect.objectContaining({
        centerEmail: CENTER_EMAIL,
        studentId: 'B123456789',
        kindLabel: '問題回報',
        categoryLabel: '預約或取消',
      }),
      expect.objectContaining({ relatedEntityType: 'student_feedback', relatedEntityId: 7 }),
    );
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
        }),
      }],
    });

    const result = await listStudentFeedback({ kind: 'wish', page: 2, pageSize: 20 });
    expect(StudentFeedback.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { kind: 'wish' },
      limit: 20,
      offset: 20,
    }));
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      kindLabel: '建議／許願',
      categoryLabel: '問卷',
      statusLabel: '待處理',
    });
    expect(result.items[0].messages).toBeUndefined();
  });

  it('addresses the notice to the center and mentions it is not a check-in mail', () => {
    const mail = emailTemplates.studentFeedbackNotice({
      centerEmail: CENTER_EMAIL,
      studentEmail: 'student@example.com',
      studentId: 'B123456789',
      studentName: '王小明',
      kindLabel: '問題回報',
      categoryLabel: '帳號或信箱',
      message: '收不到驗證碼。',
      emailVerified: false,
      submittedAt: '2026/11/08 14:00',
    });
    expect(mail.to).toBe(CENTER_EMAIL);
    expect(mail.replyTo).toBe('student@example.com');
    expect(mail.text).toContain('學生證');
    expect(mail.text).toContain('不會公開給其他學生');
    expect(mail.text).toContain('學生希望得到回覆');
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
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'closed' }));
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
    }));
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
    const row = storedCase({ status: 'closed', closedAt: new Date('2026-11-09T00:00:00.000Z') });
    StudentFeedback.findByPk.mockResolvedValue(row);
    StudentFeedbackMessage.findAll.mockResolvedValue([
      { id: 1, visibility: 'internal', authorType: 'staff', body: '先內部確認', createdAt: new Date() },
      { id: 2, visibility: 'public', authorType: 'staff', body: '已幫你看過', createdAt: new Date() },
    ]);
    const seen = await getMyStudentFeedback({ account, id: 7 });
    expect(seen.messages.map((entry) => entry.body)).toEqual(['已幫你看過']);
    expect(seen.messages[0].authorLabel).toBe('英語中心');
    expect(seen.email).toBeUndefined();

    StudentFeedbackMessage.findAll.mockResolvedValue([
      { id: 2, visibility: 'public', authorType: 'staff', body: '已幫你看過', createdAt: new Date() },
      { id: 3, visibility: 'public', authorType: 'student', body: '還是一樣', createdAt: new Date() },
    ]);
    await addStudentFollowUp({ account, id: 7, message: '還是一樣' });
    expect(row.update).toHaveBeenCalledWith({ status: 'in_progress', closedAt: null });
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
});
