const { maskStudentId } = require('../utils/piiMask');

const mockLogSecurity = jest.fn();
const mockQueue = jest.fn();

jest.mock('../services/auditLogService', () => ({
  logSecurityAuditImmediate: (...args) => mockLogSecurity(...args),
  queueAuthLoginFailure: (...args) => mockQueue(...args),
  metaFromReq: () => ({ requestId: 'req-student', ipAddress: '10.0.0.8', userAgent: 'jest' }),
}));

const {
  logStudentLoginSuccess,
  logStudentLoginFailure,
  recordStudentLoginError,
  studentOperator,
} = require('../services/studentAuthAudit');

describe('studentAuthAudit', () => {
  beforeEach(() => {
    mockLogSecurity.mockClear();
    mockQueue.mockClear();
  });

  it('records a successful student login without the password', () => {
    const req = { body: { studentId: 'B123456789', password: 'campus-secret' } };
    logStudentLoginSuccess(req, {
      id: 4,
      studentId: 'B123456789',
      name: '王小明',
    }, 'campus_sso');

    expect(mockLogSecurity).toHaveBeenCalledTimes(1);
    const payload = mockLogSecurity.mock.calls[0][1];
    expect(payload).toEqual(expect.objectContaining({
      module: 'accounts',
      action: 'student_login_success',
      entityType: 'StudentAccount',
      entityId: 4,
      operatorId: 4,
      operatorRole: 'student',
      status: 'success',
    }));
    expect(payload.operatorName).toBe(`王小明（${maskStudentId('B123456789')}）`);
    expect(payload.afterData.studentIdMasked).toBe(maskStudentId('B123456789'));
    expect(JSON.stringify(payload)).not.toContain('campus-secret');
    expect(JSON.stringify(payload)).not.toContain('B123456789');
  });

  it('aggregates a bad password separately from staff logins and still hides the student id', () => {
    recordStudentLoginError({
      body: { studentId: 'B123456789', password: 'wrong-secret' },
    }, { code: 'INVALID_CREDENTIALS', status: 401 });

    expect(mockQueue).toHaveBeenCalledWith(
      expect.any(Object),
      maskStudentId('B123456789'),
      null,
      'INVALID_CREDENTIALS',
      { namespace: 'student', entityType: 'StudentAccount' },
    );
    expect(mockLogSecurity).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      action: 'student_login_failed',
      status: 'failed',
      errorMessage: 'INVALID_CREDENTIALS',
    }));
    const payload = mockLogSecurity.mock.calls[0][1];
    expect(JSON.stringify(payload)).not.toContain('wrong-secret');
    expect(JSON.stringify(payload)).not.toContain('B123456789');
    expect(mockQueue.mock.calls[0][1]).toBe(maskStudentId('B123456789'));
  });

  it('does not write a login record for an empty form', () => {
    logStudentLoginFailure({ body: {} }, '', 'MISSING_CREDENTIALS');
    expect(mockLogSecurity).not.toHaveBeenCalled();
    expect(mockQueue).not.toHaveBeenCalled();
  });

  it('names the student operator without exposing the full student id', () => {
    expect(studentOperator({
      id: 9,
      name: '王小明',
      studentId: 'B123456789',
    }).operatorName).toBe(`王小明（${maskStudentId('B123456789')}）`);
  });
});
