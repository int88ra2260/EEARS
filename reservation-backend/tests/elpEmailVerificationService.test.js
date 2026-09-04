'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-chars!!';

const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../models', () => ({
  Op: { is: Symbol('is') },
  EnglishLearningPassportEmailVerification: {
    findOne: (...args) => mockFindOne(...args),
    create: (...args) => mockCreate(...args),
    update: (...args) => mockUpdate(...args),
  },
}));

const {
  createAndSendCode,
  verifyCode,
  assertEmailVerifiedToken,
  TOKEN_PURPOSE,
} = require('../services/englishLearningPassport/elpEmailVerificationService');

describe('elpEmailVerificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue([1]);
    process.env.ELP_EMAIL_VERIFICATION_ENABLED = 'true';
  });

  it('createAndSendCode + verifyCode 產出可用 token', async () => {
    mockFindOne.mockResolvedValueOnce(null); // cooldown：無既有碼

    const { code, email } = await createAndSendCode({
      email: 'B123456789@student.nsysu.edu.tw',
      studentId: 'B123456789',
    });
    expect(email).toBe('b123456789@student.nsysu.edu.tw');
    expect(code).toMatch(/^\d{6}$/);
    expect(mockCreate).toHaveBeenCalled();

    const createdHash = mockCreate.mock.calls[0][0].codeHash;
    const record = {
      codeHash: createdHash,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
      update: jest.fn(async function update(patch) {
        Object.assign(this, patch);
      }),
    };
    mockFindOne.mockResolvedValueOnce(record);

    const result = await verifyCode({ email: 'b123456789@student.nsysu.edu.tw', code });
    expect(result.emailVerificationToken).toBeTruthy();

    expect(() => assertEmailVerifiedToken({
      token: result.emailVerificationToken,
      email: 'b123456789@student.nsysu.edu.tw',
    })).not.toThrow();

    expect(() => assertEmailVerifiedToken({
      token: result.emailVerificationToken,
      email: 'other@student.nsysu.edu.tw',
    })).toThrow(/不符/);
  });

  it('關閉驗證時 assertEmailVerifiedToken 直接通過', () => {
    process.env.ELP_EMAIL_VERIFICATION_ENABLED = 'false';
    expect(assertEmailVerifiedToken({ token: null, email: 'a@b.com' })).toBe(true);
  });

  it('非學生信箱網域拒絕寄送', async () => {
    await expect(createAndSendCode({ email: 'user@gmail.com' })).rejects.toMatchObject({
      code: 'INVALID_STUDENT_EMAIL_DOMAIN',
    });
  });

  it('verifyCode 錯誤碼回傳 CODE_MISMATCH', async () => {
    const crypto = require('crypto');
    const jwtSecret = process.env.JWT_SECRET;
    const wrongHash = crypto.createHmac('sha256', jwtSecret).update('999999').digest('hex');
    mockFindOne.mockResolvedValue({
      codeHash: wrongHash,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
      update: jest.fn(async function update(patch) {
        Object.assign(this, patch);
      }),
    });
    await expect(verifyCode({ email: 'x@student.nsysu.edu.tw', code: '000000' })).rejects.toMatchObject({
      code: 'CODE_MISMATCH',
    });
    expect(TOKEN_PURPOSE).toBe('elp_email_verified');
  });
});
