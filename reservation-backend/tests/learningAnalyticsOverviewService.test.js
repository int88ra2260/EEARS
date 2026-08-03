'use strict';

const {
  CONTRACT_VERSION,
  labelResource,
  RESOURCE_LABELS,
} = require('../services/learningAnalytics/learningAnalyticsOverviewService');

describe('learningAnalyticsOverviewService', () => {
  it('exports contract version and resource labels', () => {
    expect(CONTRACT_VERSION).toBe('learning-analytics.overview.v1');
    expect(labelResource('ENGLISH_TABLE')).toBe(RESOURCE_LABELS.ENGLISH_TABLE);
    expect(labelResource('UNKNOWN')).toBe('UNKNOWN');
  });
});
