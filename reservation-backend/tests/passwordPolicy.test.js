const {
  validatePasswordPolicy,
  buildPasswordPolicyContext,
  generateCompliantTempPassword,
  PASSWORD_POLICY_USER_MESSAGE,
} = require('../utils/passwordPolicy');

const baseContext = buildPasswordPolicyContext({
  username: 'teacher01',
  email: 'teacher01@nsysu.edu.tw',
  name: '王小明',
  displayName: '王小明',
  role: 'teacher',
});

describe('passwordPolicy', () => {
  it('exports user-facing policy hint', () => {
    expect(PASSWORD_POLICY_USER_MESSAGE).toMatch(/12 碼/);
    expect(PASSWORD_POLICY_USER_MESSAGE).toMatch(/三種字元類型/);
  });

  describe('rejects weak or invalid passwords', () => {
    it.each([
      ['12345678'],
      ['password123'],
      ['admin123456'],
      ['Nsysu123456!'],
      ['Eears123456!'],
      ['Abcdefghijkl!'],
      ['Zyxwvutsrqpo!'],
      ['Aa1111111111!'],
      ['teacher01Xy9!@#Ab'],
      ['MyPwd_teacher01!@'],
      ['Short1!A'],
      ['onlylowerletters!!'],
      ['ONLYUPPERLETTERS!!'],
      ['abcdefghijklmnop'],
    ])('rejects %s', (pwd) => {
      const result = validatePasswordPolicy(pwd, baseContext);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects email local-part in password', () => {
      const result = validatePasswordPolicy('teacher01Pwd12!@#', baseContext);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'PASSWORD_CONTAINS_EMAIL' || e.code === 'PASSWORD_CONTAINS_USERNAME')).toBe(true);
    });

    it('rejects Chinese name in password', () => {
      const result = validatePasswordPolicy('我的王小明密碼12!@', baseContext);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'PASSWORD_CONTAINS_NAME')).toBe(true);
    });

    it('returns WEAK_PASSWORD code for common weak passwords', () => {
      const result = validatePasswordPolicy('password123', baseContext);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('WEAK_PASSWORD');
    });

    it('returns PASSWORD_POLICY_VIOLATION for complexity failures', () => {
      const result = validatePasswordPolicy('short1!A', baseContext);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('PASSWORD_POLICY_VIOLATION');
    });
  });

  describe('accepts strong passwords', () => {
    it('accepts password with 3+ classes and no personal data', () => {
      const result = validatePasswordPolicy('Kp9#mN2vQx7!R', baseContext);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts generated compliant temp password', () => {
      const pwd = generateCompliantTempPassword(14, baseContext);
      const result = validatePasswordPolicy(pwd, baseContext);
      expect(result.valid).toBe(true);
      expect(pwd.length).toBeGreaterThanOrEqual(12);
    });
  });
});
