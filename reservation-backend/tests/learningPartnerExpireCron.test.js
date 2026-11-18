jest.mock('../services/registrationSettingsService', () => ({
  isGroupRegistrationEnabled: jest.fn(),
}));

jest.mock('../services/learningPartnerExpireService', () => ({
  expirePendingLearningPartnerTeams: jest.fn(),
}));

const { isGroupRegistrationEnabled } = require('../services/registrationSettingsService');
const { expirePendingLearningPartnerTeams } = require('../services/learningPartnerExpireService');
const { expireLearningPartnerTeams } = require('../scripts/learningPartnerExpireCron');

describe('learningPartnerExpireCron', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports expireLearningPartnerTeams function', () => {
    expect(typeof expireLearningPartnerTeams).toBe('function');
  });

  it('skips without logging when group registration is disabled', async () => {
    isGroupRegistrationEnabled.mockResolvedValue(false);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await expireLearningPartnerTeams();

    expect(result).toEqual({
      expired: 0,
      notified: 0,
      skipped: true,
      reason: 'group_registration_disabled',
    });
    expect(expirePendingLearningPartnerTeams).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('expires overdue teams when group registration is enabled', async () => {
    isGroupRegistrationEnabled.mockResolvedValue(true);
    expirePendingLearningPartnerTeams.mockResolvedValue({ expired: 2, notified: 4 });

    const result = await expireLearningPartnerTeams();

    expect(expirePendingLearningPartnerTeams).toHaveBeenCalled();
    expect(result).toEqual({ expired: 2, notified: 4 });
  });
});
