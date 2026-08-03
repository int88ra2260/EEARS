const { expireLearningPartnerTeams } = require('../scripts/learningPartnerExpireCron');

describe('learningPartnerExpireCron', () => {
  it('exports expireLearningPartnerTeams function', () => {
    expect(typeof expireLearningPartnerTeams).toBe('function');
  });

  it('runs stub without throwing and returns zero counts', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const result = await expireLearningPartnerTeams();
    expect(result).toEqual({ expired: 0, notified: 0 });
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
