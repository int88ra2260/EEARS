'use strict';

const {
  pickSnapshotsToKeep,
  isGlobalSnapshot,
} = require('../services/learningAnalytics/learningAnalyticsSnapshotGovernanceService');
const { pickRecommendedSnapshot } = require('../services/learningAnalytics/learningAnalyticsMetaService');

describe('learningAnalyticsSnapshotGovernanceService', () => {
  const inventory = [
    {
      snapshotVersion: 'global-20260620-v1|rules:x|build:1',
      studentCount: 4000,
      derivedAt: '2026-06-20T10:00:00.000Z',
    },
    {
      snapshotVersion: 'global-20260622-v1|rules:x|build:1',
      studentCount: 4163,
      derivedAt: '2026-06-22T10:00:00.000Z',
    },
    {
      snapshotVersion: 'course-import-20260621-v1|rules:x|build:1',
      studentCount: 200,
      derivedAt: '2026-06-21T10:00:00.000Z',
    },
    {
      snapshotVersion: '114-2-20260621-v1|rules:x|build:1',
      studentCount: 4514,
      derivedAt: '2026-06-21T12:00:00.000Z',
    },
  ];

  it('identifies global snapshots', () => {
    expect(isGlobalSnapshot('global-20260622-v1|rules:x')).toBe(true);
    expect(isGlobalSnapshot('course-import-20260621-v1')).toBe(false);
  });

  it('keeps only latest global snapshot by default', () => {
    const keep = pickSnapshotsToKeep(inventory, { keepGlobalCount: 1 });
    expect([...keep]).toEqual(['global-20260622-v1|rules:x|build:1']);
  });

  it('can keep multiple global snapshots when configured', () => {
    const keep = pickSnapshotsToKeep(inventory, { keepGlobalCount: 2 });
    expect([...keep]).toEqual([
      'global-20260622-v1|rules:x|build:1',
      'global-20260620-v1|rules:x|build:1',
    ]);
  });
});

describe('pickRecommendedSnapshot', () => {
  it('prefers latest global snapshot by derivedAt', () => {
    const snapshots = [
      { snapshotVersion: 'global-20260615-v1|rules:x', studentCount: 5000, derivedAt: '2026-06-15T00:00:00.000Z' },
      { snapshotVersion: 'global-20260622-v1|rules:x', studentCount: 4163, derivedAt: '2026-06-22T00:00:00.000Z' },
      { snapshotVersion: 'course-import-20260615-v1|rules:x', studentCount: 2013, derivedAt: '2026-06-16T00:00:00.000Z' },
    ];
    expect(pickRecommendedSnapshot(snapshots)).toBe('global-20260622-v1|rules:x');
  });
});
