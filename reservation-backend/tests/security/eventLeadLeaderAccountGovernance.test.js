'use strict';

const express = require('express');
const request = require('supertest');

const mockTeachers = [];
let mockNextId = 200;
let mockActor = { id: 50, role: 'office_staff', staffLevel: 'event_lead', username: 'eventlead' };

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

jest.mock('../../middlewares/auth', () => {
  const { buildAccessProfile } = jest.requireActual('../../auth/accessProfile');
  const P = { CAN_MANAGE_ACCOUNTS: 'can_manage_accounts' };
  return {
    P,
    authMiddleware: (req, _res, next) => {
      req.user = { ...mockActor };
      req.accessProfile = buildAccessProfile(req.user);
      next();
    },
    requirePermission: () => (_req, _res, next) => next(),
    requireSystemPermission: () => (_req, _res, next) => next(),
  };
});

jest.mock('../../services/auditLogService', () => ({
  logAccessGovernanceAudit: jest.fn(),
  logSecurityAuditImmediate: jest.fn(),
  logAuditAsync: jest.fn(),
}));

jest.mock('../../services/accessControl/writeService', () => ({
  syncPermissionOverrides: jest.fn(async () => ({ count: 0 })),
  syncUserScopes: jest.fn(async () => ({ count: 0 })),
  bumpAccessVersion: jest.fn(async () => ({ ok: true })),
}));

jest.mock('../../services/accessControl/readService', () => ({
  getUserOverrides: jest.fn(async () => ({})),
  getUserScopes: jest.fn(async () => ([])),
}));

jest.mock('../../services/accessControl/debugService', () => ({
  buildAccessDebugApiPayload: jest.fn(async () => null),
}));

jest.mock('../../auth/permissionAssignmentPolicy', () => ({
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

jest.mock('../../utils/passwordPolicy', () => ({
  validatePasswordPolicy: jest.fn(() => ({ valid: true })),
  buildPasswordPolicyContext: jest.fn(() => ({})),
  generateCompliantTempPassword: jest.fn(() => 'TempPass#1234'),
  passwordPolicyHttpBody: jest.fn(() => ({ success: false, code: 'WEAK_PASSWORD' })),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(async () => 'hashed-password'),
  compare: jest.fn(async () => true),
}));

jest.mock('../../models', () => {
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
    findAndCountAll: jest.fn(async ({ where }) => {
      let rows = [...mockTeachers];
      if (where?.role === 'leader') {
        rows = rows.filter((t) => t.role === 'leader');
      } else if (where?.role && typeof where.role === 'string') {
        rows = rows.filter((t) => t.role === where.role);
      } else if (where?.role?.[Op.ne] === 'admin') {
        rows = rows.filter((t) => t.role !== 'admin');
      }
      return { count: rows.length, rows };
    }),
    create: jest.fn(async (payload) => {
      const row = mockCreateTeacherRecord(payload);
      mockTeachers.push(row);
      return row;
    }),
    count: jest.fn(async () => 1),
    increment: jest.fn(async () => {}),
  };

  return {
    Teacher,
    Class: {},
    ClassMembership: {},
    ClassTeacher: {},
    sequelize: {
      transaction: jest.fn(async () => mockTx),
    },
  };
});

function createApp() {
  const teacherRoutes = require('../../routes/teacherRoutes');
  const app = express();
  app.use(express.json());
  app.use('/api', teacherRoutes);
  return app;
}

describe('event_lead account governance (leader only)', () => {
  beforeEach(() => {
    mockTeachers.length = 0;
    mockNextId = 200;
    mockActor = { id: 50, role: 'office_staff', staffLevel: 'event_lead', username: 'eventlead' };
    mockTeachers.push(mockCreateTeacherRecord({
      id: 1,
      username: 'leader1',
      email: 'leader1@example.com',
      role: 'leader',
      name: 'Leader One',
    }));
    mockTeachers.push(mockCreateTeacherRecord({
      id: 2,
      username: 'teacher1',
      email: 'teacher1@example.com',
      role: 'teacher',
      name: 'Teacher One',
    }));
    mockTx.commit.mockClear();
    mockTx.rollback.mockClear();
    jest.clearAllMocks();
  });

  it('GET /api/admin/teachers returns leader accounts only', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/teachers');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.every((row) => row.role === 'leader')).toBe(true);
    expect(res.body.data.some((row) => row.username === 'leader1')).toBe(true);
    expect(res.body.data.some((row) => row.username === 'teacher1')).toBe(false);
  });

  it('POST /api/admin/teachers rejects non-leader role', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/teachers').send({
      name: 'New Teacher',
      email: 'new-teacher@example.com',
      username: 'newTeacher',
      role: 'teacher',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('ET Leader');
  });

  it('POST /api/admin/teachers allows leader role', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/teachers').send({
      name: 'New Leader',
      email: 'new-leader@example.com',
      username: 'newLeader',
      role: 'leader',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('leader');
  });

  it('PATCH /api/admin/teachers/:id rejects teacher account', async () => {
    const app = createApp();
    const res = await request(app).patch('/api/admin/teachers/2').send({ name: 'Blocked' });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('ET Leader');
  });

  it('DELETE /api/admin/teachers/:id rejects teacher account', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/admin/teachers/2');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('ET Leader');
  });
});

describe('et_manager account governance (leader only)', () => {
  beforeEach(() => {
    mockTeachers.length = 0;
    mockNextId = 200;
    mockActor = { id: 60, role: 'teacher', teacherLevel: 'et_manager', username: 'etmanager' };
    mockTeachers.push(mockCreateTeacherRecord({
      id: 1,
      username: 'leader1',
      email: 'leader1@example.com',
      role: 'leader',
      name: 'Leader One',
    }));
    mockTeachers.push(mockCreateTeacherRecord({
      id: 2,
      username: 'teacher1',
      email: 'teacher1@example.com',
      role: 'teacher',
      name: 'Teacher One',
    }));
    mockTx.commit.mockClear();
    mockTx.rollback.mockClear();
    jest.clearAllMocks();
  });

  it('GET /api/admin/teachers returns leader accounts only', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/teachers');
    expect(res.status).toBe(200);
    expect(res.body.data.every((row) => row.role === 'leader')).toBe(true);
  });

  it('POST /api/admin/teachers rejects non-leader role', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/teachers').send({
      name: 'New Teacher',
      email: 'new-teacher2@example.com',
      username: 'newTeacher2',
      role: 'teacher',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('ET Leader');
  });
});

describe('jt_manager account governance (leader only)', () => {
  beforeEach(() => {
    mockTeachers.length = 0;
    mockNextId = 300;
    mockActor = { id: 70, role: 'teacher', teacherLevel: 'jt_manager', username: 'jtmanager' };
    mockTeachers.push(mockCreateTeacherRecord({
      id: 1,
      username: 'leader1',
      email: 'leader1@example.com',
      role: 'leader',
      name: 'Leader One',
    }));
    mockTeachers.push(mockCreateTeacherRecord({
      id: 2,
      username: 'teacher1',
      email: 'teacher1@example.com',
      role: 'teacher',
      name: 'Teacher One',
    }));
    mockTx.commit.mockClear();
    mockTx.rollback.mockClear();
    jest.clearAllMocks();
  });

  it('GET /api/admin/teachers returns leader accounts only', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/teachers');
    expect(res.status).toBe(200);
    expect(res.body.data.every((row) => row.role === 'leader')).toBe(true);
  });

  it('POST /api/admin/teachers rejects non-leader role', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/teachers').send({
      name: 'New Teacher',
      email: 'new-teacher-jt@example.com',
      username: 'newTeacherJt',
      role: 'teacher',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('ET Leader');
  });
});
