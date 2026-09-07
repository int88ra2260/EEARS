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
  const passport = {
    id: 1,
    studentId: studentCtx.studentId,
    studentName: studentCtx.studentName,
    studentEmail: studentCtx.studentEmail,
    status: 'active',
    totalApprovedPoints: 0,
    certificationStatus: 'none',
    ...overrides,
  };
  passport.update = jest.fn(async (patch) => {
    Object.assign(passport, patch);
    return passport;
  });
  passport.toJSON = function toJSON() {
    return { ...this };
  };
  return passport;
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
    const created = makePassport({ status: 'active', id: 10 });
    mockPassportCreate.mockResolvedValue(created);

    const result = await passportService.applyPassport(studentCtx, { applicationReason: 'test' }, {});
    expect(result.status).toBe('active');
    expect(mockPassportCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
      expect.any(Object),
    );
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

    // dashboard 會先把 pending 自動啟用；createSubmission 仍要求 active
    // 此測直接走 createSubmission：pending 護照不可提交
    await expect(
      passportService.createSubmission(studentCtx, { ruleCode: 'TUTOR_CONSULTATION' }, {}),
    ).rejects.toMatchObject({ code: 'PASSPORT_NOT_ACTIVE' });
  });

  it('儀表板會將舊 pending 護照自動啟用', async () => {
    const passport = makePassport({ status: 'pending' });
    mockPassportFindOne
      .mockResolvedValueOnce(passport) // initial getPassportForStudent
      .mockResolvedValueOnce(makePassport({ status: 'active' })); // after heal
    mockPassportFindByPk.mockResolvedValue(passport);
    mockSubmissionFindAll.mockResolvedValue([]);
    mockRuleFindAll.mockResolvedValue([]);

    const dash = await passportService.getStudentDashboard(studentCtx);
    expect(passport.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
      expect.any(Object),
    );
    expect(dash.passport.status).toBe('active');
  });

  it('舊非中山學生信箱可自動遷移至 @student.nsysu.edu.tw', async () => {
    const passport = makePassport({ studentEmail: 'old@gmail.com' });
    mockPassportFindOne.mockResolvedValue(passport);
    mockSubmissionFindAll.mockResolvedValue([]);
    mockRuleFindAll.mockResolvedValue([]);

    const dash = await passportService.getStudentDashboard(studentCtx);
    expect(passport.update).toHaveBeenCalledWith(
      { studentEmail: studentCtx.studentEmail },
      expect.any(Object),
    );
    expect(dash.passport.studentEmail).toBe(studentCtx.studentEmail);
  });

  it('學號相同但姓名不符不可查看', async () => {
    mockPassportFindOne.mockResolvedValue(makePassport({ studentName: '其他人' }));
    await expect(passportService.getStudentDashboard(studentCtx)).rejects.toMatchObject({
      code: 'STUDENT_MISMATCH',
    });
  });

  it('已是中山學生信箱但與輸入不同不可自動改綁', async () => {
    mockPassportFindOne.mockResolvedValue(
      makePassport({ studentEmail: 'b999999999@student.nsysu.edu.tw' }),
    );
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
