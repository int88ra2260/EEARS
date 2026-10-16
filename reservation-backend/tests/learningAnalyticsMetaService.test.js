'use strict';

const {
  pickRecommendedSnapshot,
  summarizeSnapshotLabel,
  describeExamSnapshotGap,
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

  it('warns when exam events are newer than the global snapshot', () => {
    const message = describeExamSnapshotGap({
      snapshotDerivedAt: '2026-09-02T11:25:58.000Z',
      latestExamEventAt: '2026-09-10T08:46:29.000Z',
      rebuildRunning: false,
    });
    expect(message).toContain('分析數字不含這次匯入');
  });

  it('says the rebuild is in progress while a global job is running', () => {
    const message = describeExamSnapshotGap({
      snapshotDerivedAt: '2026-09-02T11:25:58.000Z',
      latestExamEventAt: '2026-09-10T08:46:29.000Z',
      rebuildRunning: true,
    });
    expect(message).toContain('全域重建進行中');
    expect(message).toContain('分析數字不含這次匯入');
  });

  it('stays quiet when the snapshot already includes later exam events', () => {
    expect(describeExamSnapshotGap({
      snapshotDerivedAt: '2026-09-24T00:00:00.000Z',
      latestExamEventAt: '2026-09-10T08:46:29.000Z',
      rebuildRunning: false,
    })).toBeNull();
  });

  it('summarizes snapshot labels for UI', () => {
    expect(summarizeSnapshotLabel('global-20260615-v1|rules:x')).toContain('全域分析');
    expect(summarizeSnapshotLabel('course-import-20260615-v1|rules:x')).toContain('課程匯入');
    expect(summarizeSnapshotLabel('manual-20260910-v1|rules:x', { studentCount: 654 })).toContain('654');
    expect(summarizeSnapshotLabel('manual-20260910-v1|rules:x')).toContain('手動');
  });
});
