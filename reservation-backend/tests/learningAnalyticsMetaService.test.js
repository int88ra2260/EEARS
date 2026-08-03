'use strict';

const {
  pickRecommendedSnapshot,
  summarizeSnapshotLabel,
} = require('../services/learningAnalytics/learningAnalyticsMetaService');

describe('learningAnalyticsMetaService', () => {
  it('prefers latest global snapshot for demo default', () => {
    const snapshots = [
      { snapshotVersion: 'course-import-20260615-v1|rules:lj-analytics-2026-v1|build:1.0.0', studentCount: 2013, derivedAt: '2026-06-16T00:00:00.000Z' },
      { snapshotVersion: 'global-20260615-v1|rules:lj-analytics-2026-v1|build:1.0.0', studentCount: 3349, derivedAt: '2026-06-15T00:00:00.000Z' },
      { snapshotVersion: 'global-20260622-v1|rules:lj-analytics-2026-v1|build:1.0.0', studentCount: 4163, derivedAt: '2026-06-22T00:00:00.000Z' },
    ];
    expect(pickRecommendedSnapshot(snapshots)).toBe('global-20260622-v1|rules:lj-analytics-2026-v1|build:1.0.0');
  });

  it('summarizes snapshot labels for UI', () => {
    expect(summarizeSnapshotLabel('global-20260615-v1|rules:x')).toContain('全域分析');
    expect(summarizeSnapshotLabel('course-import-20260615-v1|rules:x')).toContain('課程匯入');
  });
});
