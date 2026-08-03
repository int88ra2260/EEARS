'use strict';

jest.mock('../models', () => ({
  LearningAnalyticsLvaConfig: {
    findByPk: jest.fn(),
    findOrCreate: jest.fn(),
    destroy: jest.fn(),
  },
}));

const { LearningAnalyticsLvaConfig } = require('../models');
const {
  upsertLvaConfig,
  resetLvaConfig,
  listLvaConfigForSettings,
  getLvaConfig,
  ensureLvaConfigLoaded,
  invalidateLvaConfigCache,
} = require('../services/learningAnalytics/learningAnalyticsLvaConfigService');

describe('learningAnalyticsLvaConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateLvaConfigCache();
    LearningAnalyticsLvaConfig.findByPk.mockResolvedValue(null);
  });

  it('returns grouped LVA config for settings UI', async () => {
    const data = await listLvaConfigForSettings();
    expect(Array.isArray(data.groups)).toBe(true);
    expect(data.groups.length).toBeGreaterThan(0);
    const matching = data.groups.find((group) => group.id === 'matching');
    expect(matching).toBeTruthy();
    const caliperField = matching.fields.find((field) => field.key === 'matchingCaliper');
    expect(caliperField.value).toBe(0.35);
    expect(caliperField.defaultValue).toBe(0.35);
  });

  it('upserts and resets matching caliper override', async () => {
    const row = { update: jest.fn().mockResolvedValue(undefined) };
    LearningAnalyticsLvaConfig.findOrCreate.mockResolvedValue([row, true]);
    LearningAnalyticsLvaConfig.findByPk
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ configJson: { matchingCaliper: 0.4 } });

    await upsertLvaConfig([{ key: 'matchingCaliper', value: 0.4 }], { user: { id: 1 } });
    await ensureLvaConfigLoaded({ force: true });
    expect(getLvaConfig().matchingCaliper).toBe(0.4);

    const listed = await listLvaConfigForSettings();
    expect(listed.hasCustomOverrides).toBe(true);

    LearningAnalyticsLvaConfig.findByPk.mockResolvedValue(null);
    const reset = await resetLvaConfig({ user: { id: 1 } });
    expect(reset.lvaConfig.matchingCaliperDefault).toBe(0.35);
    await ensureLvaConfigLoaded({ force: true });
    expect(getLvaConfig().matchingCaliper).toBe(0.35);
  });

  it('rejects out-of-range values', async () => {
    await expect(
      upsertLvaConfig([{ key: 'matchingCaliper', value: 99 }], { user: { id: 1 } })
    ).rejects.toThrow(/不可大於/);
  });
});
