/**
 * @jest-environment node
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';

var mockResetStore;

const mockReplaceLocalPassword = jest.fn(async (account) => account);
const mockFindPendingByStudentId = jest.fn();

jest.mock('../services/studentAuthService', () => ({
  normalizeStudentId: (value) => String(value || '').trim().toUpperCase(),
  replaceLocalPassword: (...args) => mockReplaceLocalPassword(...args),
}));

jest.mock('../services/studentAccountReviewService', () => ({
  findPendingByStudentId: (...args) => mockFindPendingByStudentId(...args),
}));

jest.mock('../models', () => {
  mockResetStore = { rows: [], accounts: [], seq: 1 };

  function matches(row, where = {}) {
    if (where.studentId && row.studentId !== where.studentId) return false;
    if (where.studentAccountId != null && row.studentAccountId !== where.studentAccountId) return false;
    if (where.consumedAt && typeof where.consumedAt === 'object' && row.consumedAt != null) return false;
    return true;
  }

  return {
    StudentAccount: {
      findOne: jest.fn(async ({ where } = {}) => (
        mockResetStore.accounts.find((row) => row.studentId === where.studentId) || null
      )),
      findByPk: jest.fn(async (id) => (
        mockResetStore.accounts.find((row) => row.id === Number(id)) || null
      )),
    },
    StudentAccountPasswordReset: {
      findOne: jest.fn(async ({ where, order } = {}) => {
        let rows = mockResetStore.rows.filter((row) => matches(row, where));
        if (order) rows = rows.slice().sort((a, b) => b.id - a.id);
        return rows[0] || null;
      }),
      create: jest.fn(async (data) => {
        const row = {
          ...data,
          id: mockResetStore.seq++,
          update: jest.fn(async (patch) => {
            Object.assign(row, patch);
            return row;
          }),
        };
        mockResetStore.rows.push(row);
        return row;
      }),
      update: jest.fn(async (patch, { where } = {}) => {
        mockResetStore.rows.forEach((row) => {
          if (!matches(row, where)) return;
          Object.assign(row, patch);
        });
      }),
    },
  };
});

const {
  prepareResetByStudentId,
  prepareResetByAccountId,
  confirmReset,
  lookupStudentAccount,
} = require('../services/studentPasswordResetService');

function addAccount(overrides = {}) {
  const account = {
    id: overrides.id || mockResetStore.accounts.length + 1,
    studentId: 'B123456789',
    name: '王小明',
    email: 'ming@example.com',
    status: 'active',
    passwordHash: 'hash',
    lastLoginAt: null,
    passwordChangedAt: null,
    ...overrides,
  };
  mockResetStore.accounts.push(account);
  return account;
}

describe('studentPasswordResetService', () => {
  beforeEach(() => {
    mockResetStore.rows = [];
    mockResetStore.accounts = [];
    mockResetStore.seq = 1;
    mockReplaceLocalPassword.mockReset();
    mockReplaceLocalPassword.mockImplementation(async (account) => account);
    mockFindPendingByStudentId.mockReset();
    mockFindPendingByStudentId.mockResolvedValue(null);
  });

  it('does not create a code when the student has no resettable account', async () => {
    expect(await prepareResetByStudentId('B123456789')).toBeNull();
    addAccount({ status: 'disabled' });
    expect(await prepareResetByStudentId('B123456789')).toBeNull();
    mockResetStore.accounts = [];
    addAccount({ passwordHash: null });
    expect(await prepareResetByStudentId('B123456789')).toBeNull();
    expect(mockResetStore.rows).toHaveLength(0);
  });

  it('issues one code and stays quiet during the resend cooldown', async () => {
    addAccount();
    const first = await prepareResetByStudentId('b123456789');
    const second = await prepareResetByStudentId('B123456789');
    expect(first.code).toMatch(/^\d{6}$/);
    expect(first.email).toBe('ming@example.com');
    expect(second).toBeNull();
    expect(mockResetStore.rows.filter((row) => row.consumedAt == null)).toHaveLength(1);
  });

  it('uses the same failure for a wrong code and a missing account', async () => {
    addAccount();
    const issued = await prepareResetByStudentId('B123456789');
    const wrong = confirmReset({
      studentId: 'B123456789',
      code: issued.code === '000000' ? '000001' : '000000',
      newPassword: 'another-password',
    });
    const missing = confirmReset({
      studentId: 'B000000001',
      code: '000000',
      newPassword: 'another-password',
    });
    await expect(wrong).rejects.toMatchObject({ code: 'RESET_CODE_INVALID' });
    await expect(missing).rejects.toMatchObject({
      code: 'RESET_CODE_INVALID',
      message: '驗證碼錯誤或已失效，請重新寄送',
    });
    expect(mockReplaceLocalPassword).not.toHaveBeenCalled();
  });

  it('does not let one student code reset another account', async () => {
    addAccount({ id: 1, studentId: 'B123456789' });
    addAccount({ id: 2, studentId: 'B000000002', email: 'other@example.com' });
    const issued = await prepareResetByStudentId('B123456789');
    await expect(confirmReset({
      studentId: 'B000000002',
      code: issued.code,
      newPassword: 'another-password',
    })).rejects.toMatchObject({ code: 'RESET_CODE_INVALID' });
    expect(mockReplaceLocalPassword).not.toHaveBeenCalled();
  });

  it('keeps the code when the new password is rejected', async () => {
    addAccount();
    const issued = await prepareResetByStudentId('B123456789');
    const policyError = new Error('密碼需為 8 到 72 個字元');
    policyError.status = 400;
    policyError.code = 'INVALID_PASSWORD';
    mockReplaceLocalPassword.mockRejectedValueOnce(policyError);

    await expect(confirmReset({
      studentId: 'B123456789',
      code: issued.code,
      newPassword: 'short',
    })).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });

    await expect(confirmReset({
      studentId: 'B123456789',
      code: issued.code,
      newPassword: 'another-password',
    })).resolves.toMatchObject({ studentId: 'B123456789' });
    expect(mockReplaceLocalPassword).toHaveBeenCalledTimes(2);
  });

  it('consumes the code after five wrong attempts', async () => {
    addAccount();
    const issued = await prepareResetByStudentId('B123456789');
    const wrongCode = issued.code === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i += 1) {
      await expect(confirmReset({
        studentId: 'B123456789',
        code: wrongCode,
        newPassword: 'another-password',
      })).rejects.toMatchObject({ code: 'RESET_CODE_INVALID' });
    }
    await expect(confirmReset({
      studentId: 'B123456789',
      code: issued.code,
      newPassword: 'another-password',
    })).rejects.toMatchObject({ code: 'RESET_CODE_INVALID' });
    expect(mockReplaceLocalPassword).not.toHaveBeenCalled();
  });

  it('rejects an expired code', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T06:00:00Z'));
    try {
      addAccount();
      const issued = await prepareResetByStudentId('B123456789');
      jest.setSystemTime(new Date('2026-10-23T06:11:00Z'));
      await expect(confirmReset({
        studentId: 'B123456789',
        code: issued.code,
        newPassword: 'another-password',
      })).rejects.toMatchObject({ code: 'RESET_CODE_INVALID' });
      expect(mockReplaceLocalPassword).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('looks up an account without returning the password hash', async () => {
    addAccount({ passwordHash: 'secret-hash', lastLoginAt: new Date('2026-10-01T00:00:00Z') });
    const found = await lookupStudentAccount('b123456789');
    expect(found.kind).toBe('account');
    expect(found.account.hasLocalPassword).toBe(true);
    expect(found.account.passwordHash).toBeUndefined();
    expect(found.pending).toBeNull();
  });

  it('reports a pending application when no account exists', async () => {
    mockFindPendingByStudentId.mockResolvedValue({
      id: 9,
      studentId: 'B123456789',
      name: '王小明',
      email: 'ming@example.com',
      createdAt: new Date('2026-10-02T00:00:00Z'),
    });
    const found = await lookupStudentAccount('B123456789');
    expect(found.kind).toBe('pending');
    expect(found.account).toBeNull();
    expect(found.pending.email).toBe('ming@example.com');
  });

  it('tells staff when the account cannot be reset and when a resend is too soon', async () => {
    await expect(prepareResetByAccountId(4)).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    addAccount({ id: 4, passwordHash: null });
    await expect(prepareResetByAccountId(4)).rejects.toMatchObject({ code: 'PASSWORD_LOGIN_UNAVAILABLE' });
    mockResetStore.accounts = [];
    addAccount({ id: 4 });
    await prepareResetByAccountId(4);
    await expect(prepareResetByAccountId(4)).rejects.toMatchObject({ code: 'RESEND_COOLDOWN' });
  });
});
