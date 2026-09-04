'use strict';

const mockPassportFindOne = jest.fn();
const mockPassportCreate = jest.fn();
const mockPassportFindByPk = jest.fn();
const mockPassportUpdate = jest.fn();
const mockSubmissionCreate = jest.fn();
const mockSubmissionFindOne = jest.fn();
const mockSubmissionFindAll = jest.fn();
const mockSubmissionSum = jest.fn();
const mockSubmissionCount = jest.fn();
const mockRuleFindOne = jest.fn();
const mockRuleFindAll = jest.fn();
const mockAuditCreate = jest.fn();
const mockTx = {
  commit: jest.fn(),
  rollback: jest.fn(),
  LOCK: { UPDATE: 'UPDATE' },
};

jest.mock('../models', () => ({
  Op: {
    in: Symbol('in'),
    ne: Symbol('ne'),
    like: Symbol('like'),
    gte: Symbol('gte'),
    lte: Symbol('lte'),
    or: Symbol('or'),
  },
  sequelize: {
    transaction: jest.fn(async (fn) => fn(mockTx)),
  },
  EnglishLearningPassport: {
    findOne: (...args) => mockPassportFindOne(...args),
    create: (...args) => mockPassportCreate(...args),
    findByPk: (...args) => mockPassportFindByPk(...args),
    update: (...args) => mockPassportUpdate(...args),
    findAll: jest.fn().mockResolvedValue([]),
  },
  EnglishLearningSubmission: {
    create: (...args) => mockSubmissionCreate(...args),
    findOne: (...args) => mockSubmissionFindOne(...args),
    findAll: (...args) => mockSubmissionFindAll(...args),
    sum: (...args) => mockSubmissionSum(...args),
    count: (...args) => mockSubmissionCount(...args),
    findByPk: jest.fn(),
  },
  EnglishLearningPointRule: {
    findOne: (...args) => mockRuleFindOne(...args),
    findAll: (...args) => mockRuleFindAll(...args),
  },
  EnglishLearningAttachment: { create: jest.fn(), findOne: jest.fn() },
  EnglishLearningAuditLog: { create: (...args) => mockAuditCreate(...args), findAll: jest.fn().mockResolvedValue([]) },
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: jest.fn(),
}));

const passportService = require('../services/englishLearningPassport/passportService');
const pointValidation = require('../services/englishLearningPassport/pointValidationService');

process.env.ELP_EMAIL_VERIFICATION_ENABLED = 'false';

const studentCtx = {
  studentId: 'B123456789',
  studentName: '測試學生',
  studentEmail: 'b123456789@student.nsysu.edu.tw',
};

function makePassport(overrides = {}) {
  return {
    id: 1,
    studentId: studentCtx.studentId,
    studentName: studentCtx.studentName,
    studentEmail: studentCtx.studentEmail,
    status: 'active',
    totalApprovedPoints: 0,
    certificationStatus: 'none',
    toJSON() { return { ...this }; },
    update: jest.fn(async (patch) => Object.assign(this, patch)),
    ...overrides,
  };
}

function makeRule(code, overrides = {}) {
  return {
    code,
    basePoints: 2,
    maxPointsPerWeek: code === 'TUTOR_CONSULTATION' ? 20 : null,
    maxPointsTotal: code === 'COLLEGE_ENGLISH_CORNER' ? 30 : null,
    isOnceOnly: code === 'EXTERNAL_EXAM',
    isEnabled: true,
    ...overrides,
  };
}

describe('englishLearningPassport passportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditCreate.mockResolvedValue({});
    mockRuleFindAll.mockResolvedValue([makeRule('TUTOR_CONSULTATION')]);
    mockSubmissionFindAll.mockResolvedValue([]);
    mockSubmissionSum.mockResolvedValue(0);
    mockSubmissionCount.mockResolvedValue(0);
  });

  it('學生可申請護照', async () => {
    mockPassportFindOne.mockResolvedValue(null);
    const created = makePassport({ status: 'pending', id: 10 });
    mockPassportCreate.mockResolvedValue(created);

    const result = await passportService.applyPassport(studentCtx, { applicationReason: 'test' }, {});
    expect(result.status).toBe('pending');
    expect(mockPassportCreate).toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalled();
  });

  it('不可重複申請 pending/active 護照', async () => {
    mockPassportFindOne.mockResolvedValue(makePassport({ status: 'pending' }));
    await expect(passportService.applyPassport(studentCtx, {}, {})).rejects.toMatchObject({
      code: 'PASSPORT_ALREADY_EXISTS',
      status: 409,
    });
  });

  it('未 active 不可提交點數', async () => {
    mockPassportFindOne.mockResolvedValue(makePassport({ status: 'pending' }));
    mockRuleFindOne.mockResolvedValue(makeRule('TUTOR_CONSULTATION'));

    await expect(
      passportService.createSubmission(studentCtx, { ruleCode: 'TUTOR_CONSULTATION' }, {}),
    ).rejects.toMatchObject({ code: 'PASSPORT_NOT_ACTIVE' });
  });

  it('學生身分不符不可查看', async () => {
    mockPassportFindOne.mockResolvedValue(makePassport({ studentEmail: 'other@example.com' }));
    await expect(passportService.getStudentDashboard(studentCtx)).rejects.toMatchObject({
      code: 'STUDENT_MISMATCH',
    });
  });

  it('validateApproval 每週上限 20 點', async () => {
    mockRuleFindOne.mockResolvedValue(makeRule('TUTOR_CONSULTATION'));
    mockSubmissionFindAll.mockResolvedValue([
      { activityDate: '2026-06-10', pointsApproved: 18 },
    ]);

    const result = await pointValidation.validateApproval({
      studentId: studentCtx.studentId,
      ruleCode: 'TUTOR_CONSULTATION',
      activityDate: '2026-06-12',
      metadata: {},
      pointsToApprove: 4,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('WEEKLY_LIMIT_EXCEEDED');
  });

  it('validateApproval COLLEGE_ENGLISH_CORNER 最多 30 點', async () => {
    mockRuleFindOne.mockResolvedValue(makeRule('COLLEGE_ENGLISH_CORNER'));
    mockSubmissionFindAll.mockImplementation(async ({ attributes }) => {
      if (attributes && attributes[0] === 'pointsApproved') {
        return [{ pointsApproved: 28 }];
      }
      return [];
    });

    const result = await pointValidation.validateApproval({
      studentId: studentCtx.studentId,
      ruleCode: 'COLLEGE_ENGLISH_CORNER',
      activityDate: '2026-06-12',
      metadata: {},
      pointsToApprove: 5,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('CATEGORY_LIMIT_EXCEEDED');
  });

  it('validateApproval EXTERNAL_EXAM 只能採計一次', async () => {
    mockRuleFindOne.mockResolvedValue(makeRule('EXTERNAL_EXAM'));
    mockSubmissionCount.mockResolvedValue(1);

    const result = await pointValidation.validateApproval({
      studentId: studentCtx.studentId,
      ruleCode: 'EXTERNAL_EXAM',
      activityDate: '2026-06-12',
      metadata: { examType: 'TOEIC_LR', score: 500 },
      pointsToApprove: 20,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('ONCE_ONLY_EXCEEDED');
  });

  it('未滿 100 點不可申請最終認證', async () => {
    mockPassportFindOne.mockResolvedValue(makePassport({ totalApprovedPoints: 80 }));
    await expect(passportService.requestCertification(studentCtx, {})).rejects.toMatchObject({
      code: 'INSUFFICIENT_POINTS',
    });
  });
});
