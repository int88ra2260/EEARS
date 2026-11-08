'use strict';

jest.mock('../models', () => ({
  StudentFeedback: {
    create: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
  },
}));

jest.mock('../services/emailLogService', () => ({
  sendEmailWithLog: jest.fn(),
}));

const { StudentFeedback } = require('../models');
const { sendEmailWithLog } = require('../services/emailLogService');
const { emailTemplates } = require('../config/email');
const {
  CENTER_EMAIL,
  RECEIPT_SENT,
  RECEIPT_SAVED,
  submitStudentFeedback,
  listStudentFeedback,
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
    StudentFeedback.findAll.mockResolvedValue([{
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
        createdAt: new Date('2026-11-08T06:00:00.000Z'),
      }),
    }]);

    const items = await listStudentFeedback({ kind: 'wish' });
    expect(StudentFeedback.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { kind: 'wish' },
      limit: 100,
    }));
    expect(items[0]).toMatchObject({
      kindLabel: '建議／許願',
      categoryLabel: '問卷',
    });
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
  });
});
