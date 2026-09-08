jest.mock('../services/registrationSettingsService', () => ({
  isGroupRegistrationEnabled: jest.fn(),
}));

const { isGroupRegistrationEnabled } = require('../services/registrationSettingsService');
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
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('runs stub when group registration is enabled', async () => {
    isGroupRegistrationEnabled.mockResolvedValue(true);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await expireLearningPartnerTeams();

    expect(result).toEqual({ expired: 0, notified: 0 });
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
