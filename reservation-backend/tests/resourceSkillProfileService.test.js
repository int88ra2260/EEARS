'use strict';

jest.mock('../models', () => ({
  ResourceSkillProfile: {
    findAll: jest.fn(),
    findOrCreate: jest.fn(),
    destroy: jest.fn(),
  },
}));

const { ResourceSkillProfile } = require('../models');
const {
  ensureResourceSkillProfilesLoaded,
  getResourceSkillProfilesMap,
  upsertResourceSkillProfiles,
  resetResourceSkillProfile,
  invalidateProfileCache,
} = require('../services/learningAnalytics/resourceSkillProfileService');

describe('resourceSkillProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateProfileCache();
    ResourceSkillProfile.findAll.mockResolvedValue([]);
  });

  it('uses built-in defaults when DB is empty', async () => {
    await ensureResourceSkillProfilesLoaded({ force: true });
    const profiles = getResourceSkillProfilesMap();
    expect(profiles.ENGLISH_TABLE.speaking).toBe(0.45);
    expect(profiles.GE.reading).toBe(0.35);
    expect(profiles.WORKSHOP.writing).toBe(0.45);
    expect(profiles.TUTOR_ONLINE.writing).toBe(0.45);
  });

  it('merges DB overrides into active profiles', async () => {
    ResourceSkillProfile.findAll.mockResolvedValue([{
      resourceType: 'ENGLISH_TABLE',
      resourceId: 0,
      weightListening: '0.30',
      weightReading: '0.05',
      weightSpeaking: '0.50',
      weightWriting: '0',
      weightInteraction: '0.45',
      weightMediation: '0.15',
      weightEap: '0.05',
      weightEsp: '0.05',
    }]);
    await ensureResourceSkillProfilesLoaded({ force: true });
    expect(getResourceSkillProfilesMap().ENGLISH_TABLE.speaking).toBe(0.5);
  });

  it('upserts custom weights and invalidates cache', async () => {
    const row = { update: jest.fn().mockResolvedValue(undefined) };
    ResourceSkillProfile.findOrCreate.mockResolvedValue([row, true]);
    ResourceSkillProfile.findAll.mockResolvedValue([]);

    const result = await upsertResourceSkillProfiles([
      {
        resourceKey: 'JOB_TALK',
        weights: {
          listening: 0.3,
          reading: 0.1,
          speaking: 0.35,
          writing: 0.1,
          interaction: 0.3,
          mediation: 0.15,
          eap: 0.05,
          esp: 0.5,
        },
      },
    ], { user: { username: 'admin' } });

    expect(ResourceSkillProfile.findOrCreate).toHaveBeenCalled();
    expect(row.update).toHaveBeenCalled();
    expect(result.saved[0].resourceKey).toBe('JOB_TALK');
  });

  it('reset removes override and falls back to default', async () => {
    ResourceSkillProfile.destroy.mockResolvedValue(1);
    ResourceSkillProfile.findAll.mockResolvedValue([]);
    const result = await resetResourceSkillProfile('ENGLISH_CLUB', { user: { id: 1 } });
    expect(ResourceSkillProfile.destroy).toHaveBeenCalled();
    expect(result.source).toBe('default');
    expect(result.weights.speaking).toBe(0.35);
  });

  it('rejects invalid weight', async () => {
    await expect(upsertResourceSkillProfiles([
      { resourceKey: 'GE', weights: { listening: 1.5 } },
    ])).rejects.toThrow(/0–1/);
  });
});
