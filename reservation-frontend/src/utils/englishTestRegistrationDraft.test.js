import {
  getEnglishTestLeaveConfirmDescription,
  hasEnglishTestRegistrationProgress,
  stripStep3DataForDraft,
} from './englishTestRegistrationDraft';

describe('englishTestRegistrationDraft', () => {
  it('detects progress only when meaningful data exists', () => {
    expect(hasEnglishTestRegistrationProgress({
      englishTestStep: 1,
      agreedToPrivacyPolicy: false,
      englishTestForm: { studentId: '', name: '', idNumber: '' },
    })).toBe(false);

    expect(hasEnglishTestRegistrationProgress({
      englishTestStep: 1,
      agreedToPrivacyPolicy: true,
      englishTestForm: { studentId: '', name: '', idNumber: '' },
    })).toBe(true);

    expect(hasEnglishTestRegistrationProgress({
      englishTestStep: 2,
      agreedToPrivacyPolicy: false,
      englishTestForm: { studentId: '', name: '', idNumber: '' },
    })).toBe(true);

    expect(hasEnglishTestRegistrationProgress({
      englishTestStep: 0,
      englishTestForm: { studentId: 'B123456789', name: '', idNumber: '' },
    })).toBe(true);
  });

  it('returns context-specific leave descriptions', () => {
    expect(getEnglishTestLeaveConfirmDescription({
      englishTestForm: { studentId: 'B123456789', name: '', idNumber: '' },
    })).toMatch(/已填寫的資料/);

    expect(getEnglishTestLeaveConfirmDescription({
      agreedToPrivacyPolicy: true,
      englishTestForm: { studentId: '', name: '', idNumber: '' },
    })).toMatch(/個資條款/);
  });

  it('strips non-serializable files from step3 draft', () => {
    const stripped = stripStep3DataForDraft({
      examType: '聽讀',
      b2CertificateFiles: [{ name: 'cert.pdf' }],
    });
    expect(stripped.examType).toBe('聽讀');
    expect(stripped.b2CertificateFiles).toEqual([]);
  });
});
