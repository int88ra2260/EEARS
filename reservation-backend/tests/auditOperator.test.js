process.env.AUDIT_LOGIN_FAILURE_AGGREGATE_MS = '0';

const mockCreate = jest.fn().mockResolvedValue({});

jest.mock('../models', () => ({
  AuditLog: {
    create: (...args) => mockCreate(...args),
    bulkCreate: jest.fn(),
  },
}));

const { queueAuthLoginFailure, operatorFromReq } = require('../services/auditLogService');

function waitForAudit() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('audit operator and login failure buckets', () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  it('uses the student session when no staff user is present', () => {
    const operator = operatorFromReq({
      studentAccount: { id: 9, name: '王小明', studentId: 'B123456789' },
    });
    expect(operator.operatorId).toBe(9);
    expect(operator.operatorRole).toBe('student');
    expect(operator.operatorName).toContain('王小明');
    expect(operator.operatorName).not.toContain('B123456789');
  });

  it('keeps the staff user when both sessions are present', () => {
    expect(operatorFromReq({
      user: { id: 3, role: 'admin', name: '管理者' },
      studentAccount: { id: 9, name: '王小明', studentId: 'B123456789' },
    })).toEqual({
      operatorId: 3,
      operatorRole: 'admin',
      operatorName: '管理者',
    });
  });

  it('keeps staff login failures on the teacher record', async () => {
    queueAuthLoginFailure(
      { requestId: 'req-staff', ip: '127.0.0.1', headers: {} },
      'te***01',
      3,
      'PASSWORD_INVALID',
    );
    await waitForAudit();
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'Teacher',
      entityId: '3',
      action: 'login_failure',
      afterData: expect.objectContaining({ actor: 'staff' }),
    }));
  });

  it('writes student login failures on the student record', async () => {
    queueAuthLoginFailure(
      { requestId: 'req-student', ip: '127.0.0.1', headers: {} },
      'B1***89',
      null,
      'INVALID_CREDENTIALS',
      { namespace: 'student', entityType: 'StudentAccount' },
    );
    await waitForAudit();
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'StudentAccount',
      entityId: 'unresolved',
      action: 'login_failure',
      afterData: expect.objectContaining({ actor: 'student', reason: 'INVALID_CREDENTIALS' }),
    }));
  });
});
