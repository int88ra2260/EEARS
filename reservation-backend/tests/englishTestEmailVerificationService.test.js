/**
 * @jest-environment node
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';

jest.mock('../models', () => {
  const store = { rows: [], seq: 1 };
  return {
    EnglishTestEmailVerification: {
      __store: store,
      findOne: jest.fn(async ({ where, order } = {}) => {
        let rows = store.rows.filter((r) => {
          if (where.email && r.email !== where.email) return false;
          if (where.consumedAt && where.consumedAt[Object.getOwnPropertySymbols(where.consumedAt)[0] ? 'undefined' : 'skip']) {
            // Sequelize Op.is null — mock by checking null
          }
          if (where.consumedAt && typeof where.consumedAt === 'object') {
            // Op.is: null
            if (r.consumedAt != null) return false;
          }
          return true;
        });
        if (order) rows = rows.slice().sort((a, b) => b.id - a.id);
        return rows[0] || null;
      }),
      create: jest.fn(async (data) => {
        const row = {
          ...data,
          id: store.seq++,
          update: jest.fn(async (patch) => {
            Object.assign(row, patch);
            return row;
          }),
        };
        store.rows.push(row);
        return row;
      }),
      update: jest.fn(async (patch, { where } = {}) => {
        store.rows.forEach((r) => {
          if (where?.email && r.email !== where.email) return;
          if (where?.consumedAt && r.consumedAt != null) return;
          Object.assign(r, patch);
        });
        return [store.rows.length];
      }),
    },
  };
});

const {
  createAndSendCode,
  verifyCode,
  assertEmailVerifiedToken,
  requiresEmailVerification,
  normalizeEmail,
} = require('../services/englishTestEmailVerificationService');
const { EnglishTestEmailVerification } = require('../models');

describe('englishTestEmailVerificationService', () => {
  beforeEach(() => {
    EnglishTestEmailVerification.__store.rows = [];
    EnglishTestEmailVerification.__store.seq = 1;
    jest.clearAllMocks();
  });

  it('normalizeEmail lowercases and trims', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('requires verification on create when email present', () => {
    expect(requiresEmailVerification({ submittedEmail: 'a@b.com', isUpdate: false })).toBe(true);
  });

  it('skips verification when email empty (NON path)', () => {
    expect(requiresEmailVerification({ submittedEmail: '', isUpdate: false })).toBe(false);
  });

  it('skips verification on update when email unchanged', () => {
    expect(requiresEmailVerification({
      submittedEmail: 'a@b.com',
      previousEmail: 'A@B.com',
      isUpdate: true,
    })).toBe(false);
  });

  it('requires verification on update when email changed', () => {
    expect(requiresEmailVerification({
      submittedEmail: 'new@b.com',
      previousEmail: 'old@b.com',
      isUpdate: true,
    })).toBe(true);
  });

  it('create + verify issues token bound to email', async () => {
    const { code, email } = await createAndSendCode({ email: 'Student@NSYSU.edu.tw', studentId: 'B123' });
    expect(email).toBe('student@nsysu.edu.tw');
    expect(code).toMatch(/^\d{6}$/);

    const result = await verifyCode({ email: 'student@nsysu.edu.tw', code });
    expect(result.emailVerificationToken).toBeTruthy();

    expect(() => assertEmailVerifiedToken({
      token: result.emailVerificationToken,
      email: 'student@nsysu.edu.tw',
    })).not.toThrow();

    expect(() => assertEmailVerifiedToken({
      token: result.emailVerificationToken,
      email: 'other@nsysu.edu.tw',
    })).toThrow(/不符/);
  });

  it('wrong code increments attempts', async () => {
    const { email } = await createAndSendCode({ email: 'x@y.com' });
    await expect(verifyCode({ email, code: '000000' })).rejects.toMatchObject({ code: 'CODE_MISMATCH' });
  });
});
