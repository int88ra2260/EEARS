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
    destroy: async function destroy() {
      const idx = mockTeachers.findIndex((t) => Number(t.id) === Number(this.id));
      if (idx >= 0) mockTeachers.splice(idx, 1);
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
  const sequelize = {
    fn: jest.fn((name, col) => ({ name, col })),
    col: jest.fn((name) => name),
    where: jest.fn((left, right) => ({ left, right })),
    transaction: jest.fn(async () => mockTx),
  };

  const Teacher = {
    findOne: jest.fn(async ({ where, transaction }) => {
      void transaction;
      if (where && where.email) {
        return mockTeachers.find((t) => t.email === where.email) || null;
      }
      const conditions = where && where[Op.and];
      if (Array.isArray(conditions)) {
        const usernameCond = conditions.find((c) => c.left && c.left.name === 'LOWER');
        if (usernameCond) {
          const normalized = String(usernameCond.right).toLowerCase();
          const exclude = conditions.find((c) => c.id && c.id[Op.ne]);
          return (
            mockTeachers.find((t) => {
              if (exclude && Number(t.id) === Number(exclude.id[Op.ne])) return false;
              return String(t.username).toLowerCase() === normalized;
            }) || null
          );
        }
      }
      const orConditions = where && where[Op.or];
      if (Array.isArray(orConditions)) {
        return (
          mockTeachers.find((t) =>
            orConditions.some((c) => (c.email && t.email === c.email) || (c.username && t.username === c.username))
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
    count: jest.fn(async ({ where, transaction }) => {
      void transaction;
      if (where && where.role) {
        return mockTeachers.filter((t) => t.role === where.role).length;
      }
      return mockTeachers.length;
    }),
    increment: jest.fn(async () => {}),
  };

  const ClassTeacher = {
    destroy: jest.fn(async () => 0),
  };

  return {
    Teacher,
    Class: {},
    ClassMembership: {},
    ClassTeacher,
    sequelize,
    Op,
  };
});

function createApp() {
  const teacherRoutes = require('../routes/teacherRoutes');
  const app = express();
  app.use(express.json());
  app.use('/api', teacherRoutes);
  return app;
}

describe('teacher account lifecycle api', () => {
  beforeAll(() => {
    createApp();
  });

  beforeEach(() => {
    mockTeachers.length = 0;
    mockNextId = 100;
    mockTx.commit.mockClear();
    mockTx.rollback.mockClear();
    jest.clearAllMocks();
    mockTeachers.push(mockCreateTeacherRecord({
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      name: 'Admin',
    }));
    mockTeachers.push(mockCreateTeacherRecord({
      id: 2,
      username: 'teacherA',
      email: 'teacher-a@example.com',
      role: 'teacher',
      name: 'Teacher A',
    }));
  });

  it('PATCH /api/admin/teachers/:id 可更新 username', async () => {
    const app = createApp();
    const res = await request(app)
      .patch('/api/admin/teachers/2')
      .send({ username: 'teacherRenamed' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('teacherRenamed');
    const row = mockTeachers.find((t) => t.id === 2);
    expect(row.username).toBe('teacherRenamed');
  });

  it('PATCH username 重複 -> 409', async () => {
    const app = createApp();
    const res = await request(app)
      .patch('/api/admin/teachers/2')
      .send({ username: 'admin' });
    expect(res.status).toBe(409);
    expect(res.body.field).toBe('username');
  });

  it('DELETE /api/admin/teachers/:id 可刪除非自己帳號', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/admin/teachers/2');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockTeachers.find((t) => t.id === 2)).toBeUndefined();
  });

  it('DELETE 自己 -> 400 CANNOT_DELETE_SELF', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/admin/teachers/1');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CANNOT_DELETE_SELF');
  });

  it('DELETE 最後一個 admin -> 400 LAST_ADMIN_ACCOUNT', async () => {
    mockTeachers.length = 0;
    mockTeachers.push(mockCreateTeacherRecord({
      id: 5,
      username: 'soleAdmin',
      email: 'sole@example.com',
      role: 'admin',
      name: 'Sole Admin',
    }));
    const app = createApp();
    const res = await request(app).delete('/api/admin/teachers/5');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LAST_ADMIN_ACCOUNT');
  });
});
