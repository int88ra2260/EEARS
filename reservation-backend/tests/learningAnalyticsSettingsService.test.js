'use strict';

jest.mock('../services/learningJourney/analytics/lvaAnalyticsService', () => ({
  LVA_VERSION: 'test-lva-version',
}));

jest.mock('../services/learningAnalytics/resourceSkillProfileService', () => ({
  listResourceSkillProfilesForSettings: jest.fn().mockResolvedValue([
    {
      resourceKey: 'ENGLISH_TABLE',
      editable: true,
      weights: { speaking: 1, listening: 1 },
    },
  ]),
  upsertResourceSkillProfiles: jest.fn(),
  resetResourceSkillProfile: jest.fn(),
}));

jest.mock('../services/learningAnalytics/learningAnalyticsFilterReferenceService', () => ({
  listFilterReferencesAdmin: jest.fn().mockResolvedValue([
    { refType: 'semester', items: [{ value: '114-1', label: '114-1' }] },
  ]),
  replaceFilterReferences: jest.fn(),
  REF_TYPES: ['semester', 'department'],
}));

jest.mock('../services/learningAnalytics/learningAnalyticsLvaConfigService', () => ({
  listLvaConfigForSettings: jest.fn().mockResolvedValue({
    groups: [{ key: 'baseline', items: [] }],
  }),
  upsertLvaConfig: jest.fn(),
  resetLvaConfig: jest.fn(),
}));

jest.mock('../services/learningAnalytics/gseScoreMappingService', () => ({
  listGseMappingForSettings: jest.fn().mockReturnValue({
    cefrBands: [{ cefr: 'B2', min: 51, max: 66 }],
    cefrSummary: { B2: { min: 51, max: 66 } },
  }),
}));

const { getLearningAnalyticsSettings } = require('../services/learningAnalytics/learningAnalyticsSettingsService');

describe('learningAnalyticsSettingsService', () => {
  it('returns gse mapping and editable resource skill profiles', async () => {
    const data = await getLearningAnalyticsSettings();
    expect(data.modelVersion).toBeTruthy();
    expect(data.gseMapping).toBeTruthy();
    expect(Array.isArray(data.gseMapping.cefrBands)).toBe(true);
    expect(data.gseMapping.cefrSummary?.B2).toBeTruthy();
    expect(Array.isArray(data.resourceSkillProfiles)).toBe(true);
    const et = data.resourceSkillProfiles.find((row) => row.resourceKey === 'ENGLISH_TABLE');
    expect(et).toBeTruthy();
    expect(et.editable).toBe(true);
    expect(data.filterReferenceTypes?.length).toBeGreaterThan(0);
    expect(data.lvaConfig?.groups?.length).toBeGreaterThan(0);
    expect(data.policies.causalClaimAllowed).toBe(false);
    expect(data.maintenance.rebuildCommand).toContain('lj:rebuild-analytics');
    expect(data.maintenance.recomputeGseEpisodesCommand).toContain('lj:recompute-gse-episodes');
  });
});
