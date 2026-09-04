const express = require('express');
const request = require('supertest');

const mockTeachers = [];
let mockNextId = 100;

function mockCreateTeacherRecord(data = {}) {
  const teacher = {
    id: data.id || mockNextId++,
    name: data.name || '測試帳號',
    email: data.email || `user${mockNextId}@example.com`,
    username: data.username || `user${mockNextId}`,
    password: data.password || 'hashed-password',
    role: data.role || 'teacher',
    teacherLevel: Object.prototype.hasOwnProperty.call(data, 'teacherLevel') ? data.teacherLevel : 'regular',
    staffLevel: Object.prototype.hasOwnProperty.call(data, 'staffLevel') ? data.staffLevel : null,
    workerLevel: Object.prototype.hasOwnProperty.call(data, 'workerLevel') ? data.workerLevel : null,
    department: data.department ?? null,
    phone: data.phone ?? null,
    isActive: data.isActive ?? true,
    disabledReason: data.disabledReason ?? null,
    mustResetPassword: data.mustResetPassword ?? true,
    accessVersion: data.accessVersion ?? 1,
    permissions: data.permissions ?? null,
    scopes: data.scopes ?? null,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    lastLoginAt: data.lastLoginAt || null,
    createdBy: data.createdBy || null,
    update: async function update(payload) {
      Object.assign(this, payload, { updatedAt: new Date() });
      return this;
    },
    reload: async function reload() {
      return this;
    },
  };
  return teacher;
}

const mockTx = {
  LOCK: { UPDATE: 'UPDATE' },
  commit: jest.fn(async () => {}),
  rollback: jest.fn(async () => {}),
};

jest.mock('../middlewares/auth', () => {
  const P = { CAN_MANAGE_ACCOUNTS: 'can_manage_accounts' };
  return {
    P,
    authMiddleware: (req, _res, next) => {
      req.user = { id: 1, role: 'admin', username: 'admin', name: 'Admin' };
      next();
    },
    requirePermission: () => (_req, _res, next) => next(),
    requireSystemPermission: () => (_req, _res, next) => next(),
  };
});

jest.mock('../services/auditLogService', () => ({
  logAccessGovernanceAudit: jest.fn(),
  logSecurityAuditImmediate: jest.fn(),
  logAuditAsync: jest.fn(),
}));

jest.mock('../services/accessControl/writeService', () => ({
  syncPermissionOverrides: jest.fn(async () => ({ count: 0 })),
  syncUserScopes: jest.fn(async () => ({ count: 0 })),
  bumpAccessVersion: jest.fn(async () => ({ ok: true })),
}));

jest.mock('../services/accessControl/readService', () => ({
  getUserOverrides: jest.fn(async () => ({})),
  getUserScopes: jest.fn(async () => ([])),
}));

jest.mock('../services/accessControl/debugService', () => ({
  buildAccessDebugApiPayload: jest.fn(async () => null),
}));

jest.mock('../auth/permissionAssignmentPolicy', () => ({
  validateCreatePermissionOverrides: jest.fn(() => null),
  resolveUpdatePermissionOverrides: jest.fn((_req, permissions, before) => ({
    ok: true,
    merged: permissions === null ? null : (permissions || before || {}),
  })),
  assignmentDeniedResponse: jest.fn(() => ({
    status: 403,
    body: { success: false, code: 'PERMISSION_ASSIGNMENT_DENIED' },
  })),
}));

jest.mock('../utils/passwordPolicy', () => ({
  validatePasswordPolicy: jest.fn(() => ({ valid: true })),
  buildPasswordPolicyContext: jest.fn(() => ({})),
  generateCompliantTempPassword: jest.fn(() => 'TempPass#1234'),
  passwordPolicyHttpBody: jest.fn(() => ({ success: false, code: 'WEAK_PASSWORD' })),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(async () => 'hashed-password'),
  compare: jest.fn(async () => true),
}));

jest.mock('../models', () => {
  const { Op } = require('sequelize');
  const Teacher = {
    findOne: jest.fn(async ({ where }) => {
      if (where && where.email) {
        return mockTeachers.find((t) => t.email === where.email) || null;
      }
      const conditions = where && where[Op.or];
      if (Array.isArray(conditions)) {
        return (
          mockTeachers.find((t) =>
            conditions.some((c) => (c.email && t.email === c.email) || (c.username && t.username === c.username))
          ) || null
        );
      }
      return null;
    }),
    findByPk: jest.fn(async (id) => mockTeachers.find((t) => Number(t.id) === Number(id)) || null),
    create: jest.fn(async (payload) => {
      const row = mockCreateTeacherRecord(payload);
      mockTeachers.push(row);
      return row;
    }),
    increment: jest.fn(async () => {}),
  };

  return {
    Teacher,
    Class: {},
    ClassMembership: {},
    sequelize: {
      transaction: jest.fn(async () => mockTx),
    },
  };
});

function createApp() {
  const teacherRoutes = require('../routes/teacherRoutes');
  const app = express();
  app.use(express.json());
  app.use('/api', teacherRoutes);
  return app;
}

describe('teacher account office_staff api', () => {
  beforeEach(() => {
    mockTeachers.length = 0;
    mockNextId = 100;
    mockTx.commit.mockClear();
    mockTx.rollback.mockClear();
    jest.clearAllMocks();
  });

  it('POST /api/admin/teachers role=office_staff 缺 staffLevel -> 400', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/teachers').send({
      name: 'Office A',
      email: 'office-a@example.com',
      username: 'officeA',
      role: 'office_staff',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('行政職員須指定職務');
  });

  it('POST /api/admin/teachers role=office_staff staffLevel 不合法 -> 400', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/teachers').send({
      name: 'Office B',
      email: 'office-b@example.com',
      username: 'officeB',
      role: 'office_staff',
      staffLevel: 'invalid_level',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('行政職員須指定職務');
  });

  it('POST /api/admin/teachers role=office_staff staffLevel 合法 -> 201', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/teachers').send({
      name: 'Office C',
      email: 'office-c@example.com',
      username: 'officeC',
      role: 'office_staff',
      staffLevel: 'event_lead',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('office_staff');
    expect(res.body.data.staffLevel).toBe('event_lead');
    expect(res.body.data.teacherLevel).toBeNull();
  });

  it('PATCH /api/admin/teachers/:id 切到 office_staff 且 staffLevel 合法 -> success', async () => {
    const app = createApp();
    const existing = mockCreateTeacherRecord({
      id: 77,
      role: 'teacher',
      teacherLevel: 'regular',
      staffLevel: null,
      email: 'teacher77@example.com',
      username: 'teacher77',
    });
    mockTeachers.push(existing);

    const res = await request(app).patch('/api/admin/teachers/77').send({
      role: 'office_staff',
      staffLevel: 'curriculum_lead',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('office_staff');
    expect(res.body.data.staffLevel).toBe('curriculum_lead');
    expect(res.body.data.teacherLevel).toBeNull();
  });

  it('PATCH /api/admin/teachers/:id role=office_staff 缺 staffLevel -> 400', async () => {
    const app = createApp();
    const existing = mockCreateTeacherRecord({
      id: 78,
      role: 'teacher',
      teacherLevel: 'regular',
      staffLevel: null,
      email: 'teacher78@example.com',
      username: 'teacher78',
    });
    mockTeachers.push(existing);

    const res = await request(app).patch('/api/admin/teachers/78').send({
      role: 'office_staff',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('行政職員須指定有效職務');
  });

  it('PATCH /api/admin/teachers/:id 從 office_staff 切回 worker/admin 時 staffLevel 清空', async () => {
    const app = createApp();
    const officeStaff = mockCreateTeacherRecord({
      id: 79,
      role: 'office_staff',
      teacherLevel: null,
      staffLevel: 'bestep_lead',
      email: 'office79@example.com',
      username: 'office79',
    });
    mockTeachers.push(officeStaff);

    const workerRes = await request(app).patch('/api/admin/teachers/79').send({
      role: 'worker',
      workerLevel: 'event_ops',
    });
    expect(workerRes.status).toBe(200);
    expect(workerRes.body.data.role).toBe('worker');
    expect(workerRes.body.data.staffLevel).toBeNull();
    expect(workerRes.body.data.workerLevel).toBe('event_ops');

    const adminRes = await request(app).patch('/api/admin/teachers/79').send({
      role: 'admin',
    });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.role).toBe('admin');
    expect(adminRes.body.data.staffLevel).toBeNull();
    expect(adminRes.body.data.workerLevel).toBeNull();
  });

  it('POST /api/admin/teachers role=worker 缺 workerLevel -> 400', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/teachers').send({
      name: 'Worker A',
      email: 'worker-a@example.com',
      username: 'workerA',
      role: 'worker',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('工讀生須指定職務');
  });

  it('POST /api/admin/teachers role=worker workerLevel 合法 -> 201', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/teachers').send({
      name: 'Worker B',
      email: 'worker-b@example.com',
      username: 'workerB',
      role: 'worker',
      workerLevel: 'content_editor',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('worker');
    expect(res.body.data.workerLevel).toBe('content_editor');
    expect(res.body.data.staffLevel).toBeNull();
  });
});
