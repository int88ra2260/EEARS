const request = require('supertest');
const express = require('express');

const mockSettingsFindOne = jest.fn();
const mockTeamCount = jest.fn();
const mockTeamCreate = jest.fn();
const mockTeamFindByPk = jest.fn();
const mockMemberCreate = jest.fn();
const mockMemberFindOne = jest.fn();
const mockMemberFindAll = jest.fn();
const mockMemberFindOneInOtherTeam = jest.fn();
const mockRegistrationFindOne = jest.fn();
const mockTeamTx = { commit: jest.fn(), rollback: jest.fn() };
const mockMemberTx = { commit: jest.fn(), rollback: jest.fn() };

jest.mock('../models', () => {
  const sequelizeLock = { UPDATE: 'UPDATE' };
  return {
    Op: { in: Symbol('in') },
    Sequelize: { Transaction: { LOCK: sequelizeLock } },
    QueryTypes: {},
    Settings: { findOne: (...args) => mockSettingsFindOne(...args) },
    EnglishTestRegistration: { findOne: (...args) => mockRegistrationFindOne(...args) },
    LearningPartnerTeam: {
      sequelize: { transaction: jest.fn(async () => mockTeamTx) },
      count: (...args) => mockTeamCount(...args),
      create: (...args) => mockTeamCreate(...args),
      findByPk: (...args) => mockTeamFindByPk(...args),
    },
    LearningPartnerTeamMember: {
      sequelize: { transaction: jest.fn(async () => mockMemberTx) },
      findOne: (...args) => {
        const query = args[0] || {};
        if (Array.isArray(query.include) && query.include[0] && query.include[0].as === 'team') {
          return mockMemberFindOneInOtherTeam(...args);
        }
        return mockMemberFindOne(...args);
      },
      create: (...args) => mockMemberCreate(...args),
      findAll: (...args) => mockMemberFindAll(...args),
      update: jest.fn(),
    },
    sequelize: { query: jest.fn() },
  };
});

jest.mock('../middlewares/auth', () => ({
  authMiddleware: (_req, _res, next) => next(),
  adminExecutiveOrDeputyMiddleware: (_req, _res, next) => next(),
  requirePermission: () => (_req, _res, next) => next(),
  P: {
    CAN_MANAGE_LEARNING_PARTNER_ADMIN: 'can_manage_learning_partner_admin',
  },
}));

jest.mock('../config/email', () => ({ sendEmail: jest.fn() }));
jest.mock('../utils/emailQueue', () => ({ enqueue: jest.fn(async () => {}) }));

const router = require('../routes/learningPartnerRouter');

function resetDefaults() {
  jest.clearAllMocks();
  mockSettingsFindOne.mockResolvedValue({ value: 'true', valueBool: true });
  mockTeamCount.mockResolvedValue(0);
  mockRegistrationFindOne.mockImplementation(async ({ where }) => ({
    id: where.studentId === 'TEST001' ? 1 : 2,
    email: `${String(where.studentId).toLowerCase()}@example.com`,
  }));
  mockMemberFindOneInOtherTeam.mockResolvedValue(null);
  mockTeamCreate.mockResolvedValue({
    id: 501,
    teamName: '測試團體',
    teamSize: 3,
    status: 'pending_approval',
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
  });
  let memberId = 1;
  mockMemberCreate.mockImplementation(async (attrs) => ({
    id: memberId++,
    ...attrs,
  }));
  mockTeamFindByPk.mockResolvedValue({
    id: 501,
    teamName: '測試團體',
    teamSize: 3,
    status: 'pending_approval',
    representativeStudentId: 'TEST001',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 2 * 3600 * 1000),
    approvedAt: null,
    members: [
      {
        studentId: 'TEST001',
        name: '測試學生一',
        email: 'aaa@example.com',
        isRepresentative: true,
        approvalStatus: 'pending',
        toJSON() { return this; },
      },
    ],
  });
  mockMemberFindOne.mockResolvedValue(null);
  mockMemberFindAll.mockResolvedValue([{ approvalStatus: 'approved', email: 'a@a.com', name: 'A', studentId: 'TEST001' }]);
}

describe('Learning Partner Router unit tests (DB mocked)', () => {
  let app;

  beforeEach(() => {
    resetDefaults();
    app = express();
    app.use(express.json());
    app.use('/api', router);
  });

  it('POST /api/learning-partner/teams 建立成功', async () => {
    const response = await request(app).post('/api/learning-partner/teams').send({
      teamName: '測試團體',
      teamSize: 3,
      members: [
        { studentId: 'TEST001', name: '測試學生一' },
        { studentId: 'TEST002', name: '測試學生二' },
        { studentId: 'TEST003', name: '測試學生三' },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.team.id).toBe(501);
    expect(mockTeamTx.commit).toHaveBeenCalled();
  });

  it('POST /api/learning-partner/teams 團體報名關閉時回 403', async () => {
    mockSettingsFindOne.mockImplementation(async ({ where }) => {
      if (where.key === 'english_test_registration_group_enabled') {
        return { value: 'false', valueBool: false };
      }
      return { value: 'true', valueBool: true };
    });

    const response = await request(app).post('/api/learning-partner/teams').send({
      teamName: '測試團體',
      teamSize: 3,
      members: [
        { studentId: 'TEST001', name: '測試學生一' },
        { studentId: 'TEST002', name: '測試學生二' },
        { studentId: 'TEST003', name: '測試學生三' },
      ],
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('LP_FEATURE_DISABLED');
    expect(mockTeamTx.rollback).toHaveBeenCalled();
  });

  it('POST /api/learning-partner/teams 團隊人數錯誤會 400', async () => {
    const response = await request(app).post('/api/learning-partner/teams').send({
      teamSize: 5,
      members: [],
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('LP_INVALID_TEAM_SIZE');
  });

  it('POST /api/learning-partner/teams 成員不符資格會 400', async () => {
    mockRegistrationFindOne.mockResolvedValueOnce(null);
    const response = await request(app).post('/api/learning-partner/teams').send({
      teamSize: 3,
      members: [
        { studentId: 'INVALID', name: '不存在學生' },
        { studentId: 'TEST002', name: '測試學生二' },
        { studentId: 'TEST003', name: '測試學生三' },
      ],
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('LP_MEMBER_NOT_ELIGIBLE');
  });

  it('GET /api/learning-partner/teams/:id 成功回傳團隊', async () => {
    const response = await request(app).get('/api/learning-partner/teams/501');
    expect(response.status).toBe(200);
    expect(response.body.team.id).toBe(501);
  });

  it('POST /api/learning-partner/approve/confirm 無效 token 回 404', async () => {
    mockMemberFindOne.mockResolvedValueOnce(null);
    const response = await request(app).post('/api/learning-partner/approve/confirm').send({ token: 'bad-token' });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('LP_TOKEN_INVALID');
  });
});
