/**
 * @jest-environment node
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';

jest.mock('../models', () => {
  const store = { rows: [], seq: 1 };
  return {
    StudentAccountEmailVerification: {
      findOne: jest.fn(async ({ where, order } = {}) => {
        let rows = store.rows.filter((row) => {
          if (where.email && row.email !== where.email) return false;
          if (where.consumedAt && typeof where.consumedAt === 'object' && row.consumedAt != null) return false;
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
        store.rows.forEach((row) => {
          if (where?.email && row.email !== where.email) return;
          if (where?.consumedAt && row.consumedAt != null) return;
          Object.assign(row, patch);
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
} = require('../services/studentAccountEmailVerificationService');

describe('studentAccountEmailVerificationService', () => {
  it('accepts a personal mailbox and returns a token that matches that address', async () => {
    const sent = await createAndSendCode({
      email: 'Ming@gmail.com',
      studentId: 'B123456789',
    });
    const verified = await verifyCode({ email: sent.email, code: sent.code });
    expect(verified.email).toBe('ming@gmail.com');
    expect(assertEmailVerifiedToken({
      token: verified.emailVerificationToken,
      email: 'ming@gmail.com',
    })).toBe(true);
  });

  it('rejects a token that belongs to a different mailbox', async () => {
    const sent = await createAndSendCode({ email: 'other@example.com' });
    const verified = await verifyCode({ email: sent.email, code: sent.code });
    expect(() => assertEmailVerifiedToken({
      token: verified.emailVerificationToken,
      email: 'someone@example.com',
    })).toThrow(expect.objectContaining({ code: 'EMAIL_VERIFICATION_MISMATCH' }));
  });
});
