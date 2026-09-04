import {
  getEnglishTestAgreementGateMaxStep,
  getEnglishTestNavigableMaxStep,
  getEnglishTestStepGateBlockMessage,
} from './englishTestRegistrationStepGates';

describe('englishTestRegistrationStepGates', () => {
  it('blocks past step 0 when announcement agreement is required and unchecked', () => {
    expect(getEnglishTestAgreementGateMaxStep({
      agreedToAnnouncement: false,
      agreedToPrivacyPolicy: true,
    })).toBe(0);
  });

  it('blocks past step 1 when privacy agreement is required and unchecked', () => {
    expect(getEnglishTestAgreementGateMaxStep({
      agreedToAnnouncement: true,
      agreedToPrivacyPolicy: false,
    })).toBe(1);
  });

  it('allows later steps when both required agreements are checked', () => {
    expect(getEnglishTestAgreementGateMaxStep({
      agreedToAnnouncement: true,
      agreedToPrivacyPolicy: true,
    })).toBe(4);
  });

  it('respects schema required=false / visible=false', () => {
    expect(getEnglishTestAgreementGateMaxStep({
      schema: {
        questions: [
          { fieldKey: 'agreedToAnnouncement', required: false },
          { fieldKey: 'agreedToPrivacyPolicy', visible: false },
        ],
      },
      agreedToAnnouncement: false,
      agreedToPrivacyPolicy: false,
    })).toBe(4);
  });

  it('computes navigable max from agreements, progress, and registration state', () => {
    expect(getEnglishTestNavigableMaxStep({
      maxReachedStep: 4,
      agreedToAnnouncement: true,
      agreedToPrivacyPolicy: false,
      hasStep3Data: true,
    })).toBe(1);

    expect(getEnglishTestNavigableMaxStep({
      maxReachedStep: 4,
      agreedToAnnouncement: true,
      agreedToPrivacyPolicy: true,
      registrationEnabled: false,
      hasStep3Data: true,
    })).toBe(2);

    expect(getEnglishTestNavigableMaxStep({
      maxReachedStep: 4,
      agreedToAnnouncement: true,
      agreedToPrivacyPolicy: true,
      hasStep3Data: false,
    })).toBe(3);
  });

  it('returns specific block messages for progress jumps', () => {
    expect(getEnglishTestStepGateBlockMessage({
      targetStep: 2,
      agreedToAnnouncement: false,
      agreedToPrivacyPolicy: false,
      maxReachedStep: 4,
    })?.message).toMatch(/報名須知/);

    expect(getEnglishTestStepGateBlockMessage({
      targetStep: 3,
      agreedToAnnouncement: true,
      agreedToPrivacyPolicy: false,
      maxReachedStep: 4,
    })?.message).toMatch(/個資/);

    expect(getEnglishTestStepGateBlockMessage({
      targetStep: 3,
      agreedToAnnouncement: true,
      agreedToPrivacyPolicy: true,
      maxReachedStep: 2,
    })?.message).toMatch(/依序完成/);
  });
});
