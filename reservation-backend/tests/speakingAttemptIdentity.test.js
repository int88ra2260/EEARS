'use strict';

const { resolveSpeakingStudentId } = require('../services/speakingAttemptIdentity');

describe('resolveSpeakingStudentId', () => {
  const account = { studentId: 'B141030028', emailVerifiedAt: '2026-11-01T00:00:00.000Z' };

  test('English Table practice uses the signed-in student id', () => {
    expect(resolveSpeakingStudentId({
      bodyStudentId: 'B000000000',
      studentAccount: account,
      linkedToEnglishTable: true,
    })).toBe('B141030028');
  });

  test('English Table practice requires a student session', () => {
    expect(() => resolveSpeakingStudentId({
      bodyStudentId: 'B141030028',
      studentAccount: null,
      linkedToEnglishTable: true,
    })).toThrow(expect.objectContaining({ status: 401, code: 'STUDENT_AUTH_REQUIRED' }));
  });

  test('English Table practice requires a verified mailbox', () => {
    expect(() => resolveSpeakingStudentId({
      bodyStudentId: 'B141030028',
      studentAccount: { studentId: 'B141030028', emailVerifiedAt: null },
      linkedToEnglishTable: true,
    })).toThrow(expect.objectContaining({ status: 403, code: 'EMAIL_ACTIVATION_REQUIRED' }));
  });

  test('a signed-in diagnostic attempt ignores a different id in the body', () => {
    expect(resolveSpeakingStudentId({
      bodyStudentId: 'B000000000',
      studentAccount: account,
      linkedToEnglishTable: false,
    })).toBe('B141030028');
  });

  test('an anonymous diagnostic attempt keeps the optional body id', () => {
    expect(resolveSpeakingStudentId({
      bodyStudentId: '412345678',
      studentAccount: null,
      linkedToEnglishTable: false,
    })).toBe('412345678');
  });
});
