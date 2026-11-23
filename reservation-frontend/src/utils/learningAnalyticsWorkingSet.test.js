import { beforeEach, describe, expect, test } from 'vitest';
import {
  clearWorkingSet,
  isWorkingSetSuspended,
  readWorkingSet,
  rebindWorkingSet,
  adoptWorkingSetOnDestination,
  resolveWorkingSetSuspension,
  saveWorkingSet,
  workingSetCoversPath,
} from './learningAnalyticsWorkingSet';

describe('learning analytics working set', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('saves the group and clears it back to everyone', () => {
    saveWorkingSet({
      label: '課Ａ學生',
      studentIds: ['s100', 's100', 's200'],
      total: 2,
      context: { snapshotVersion: 'snap-a', semester: '114-2' },
    });
    const saved = readWorkingSet();
    expect(saved.studentIds).toEqual(['S100', 'S200']);
    expect(saved.label).toBe('課Ａ學生');
    expect(saved.context).toEqual({ snapshotVersion: 'snap-a', semester: '114-2' });

    clearWorkingSet();
    expect(readWorkingSet().studentIds).toEqual([]);
  });

  test('keeps every student id when the group is larger than 2000', () => {
    const ids = Array.from({ length: 2005 }, (_, i) => `s${i}`);
    saveWorkingSet({
      label: '大批學生',
      studentIds: ids,
      total: ids.length,
    });
    const saved = readWorkingSet();
    expect(saved.studentIds).toHaveLength(2005);
    expect(saved.truncated).toBe(false);
    expect(saved.total).toBe(2005);
    expect(saved.studentIds[0]).toBe('S0');
    expect(saved.studentIds[2004]).toBe('S2004');
  });

  test('does not treat a different page dimension as a silent invalidation', () => {
    const set = saveWorkingSet({
      label: '課Ａ學生',
      studentIds: ['S100'],
      context: { snapshotVersion: 'snap-a', semester: '114-2' },
    });
    expect(isWorkingSetSuspended(set, { snapshotVersion: 'snap-a' })).toBe('');
    expect(isWorkingSetSuspended(set, { semester: '114-2' })).toBe('');
  });

  test('pauses when the bound semester or snapshot changes, including a cleared value', () => {
    const set = saveWorkingSet({
      label: '課Ａ學生',
      studentIds: ['S100'],
      context: { snapshotVersion: 'snap-a', semester: '114-2' },
    });
    expect(isWorkingSetSuspended(set, { snapshotVersion: 'snap-a', semester: '115-1' })).toBe('semester');
    expect(isWorkingSetSuspended(set, { snapshotVersion: 'snap-b', semester: '114-2' })).toBe('snapshot');
    expect(isWorkingSetSuspended(set, { semester: '115-1' })).toBe('semester');
    expect(isWorkingSetSuspended(set, { semester: '' })).toBe('semester');
    expect(isWorkingSetSuspended(set, { snapshotVersion: 'snap-b' })).toBe('snapshot');
  });

  test('rebind keeps the same students and updates only the declared scope', () => {
    saveWorkingSet({
      label: '課Ａ學生',
      studentIds: ['S100'],
      context: { snapshotVersion: 'snap-a', semester: '114-2' },
    });
    const next = rebindWorkingSet({ semester: '115-1' });
    expect(next.studentIds).toEqual(['S100']);
    expect(next.context).toEqual({ snapshotVersion: 'snap-a', semester: '115-1' });
    expect(isWorkingSetSuspended(next, { semester: '115-1' })).toBe('');
  });

  test('keeps the group only on the page the click opened', () => {
    saveWorkingSet({
      label: '課Ａ學生',
      studentIds: ['S100'],
      appliedPath: '/admin/learning-analytics/kpi-report',
    });
    const saved = readWorkingSet();
    expect(saved.appliedPath).toBe('/admin/learning-analytics/kpi-report');
    expect(workingSetCoversPath(saved.appliedPath, '/admin/learning-analytics/kpi-report')).toBe(true);
    expect(workingSetCoversPath(saved.appliedPath, '/admin/learning-analytics/students/S100')).toBe(true);
    expect(workingSetCoversPath(saved.appliedPath, '/admin/learning-analytics/overview')).toBe(false);
    expect(workingSetCoversPath('', '/admin/learning-analytics/kpi-report')).toBe(false);
  });

  test('applies the clicked list on arrival even when the destination semester differs', () => {
    const set = saveWorkingSet({
      label: '這份報表的學生',
      studentIds: ['S100'],
      appliedPath: '/admin/learning-analytics/raw-data',
      bindToDestination: true,
      context: { snapshotVersion: '', semester: '114-2' },
    });
    expect(resolveWorkingSetSuspension(
      set,
      { snapshotVersion: '', semester: '' },
      { onDestination: true },
    )).toBe('');

    const adopted = adoptWorkingSetOnDestination({ snapshotVersion: 'snap-a', semester: '' });
    expect(adopted.bindToDestination).toBe(false);
    expect(adopted.context).toEqual({ snapshotVersion: 'snap-a', semester: '' });
    expect(adopted.studentIds).toEqual(['S100']);
    expect(isWorkingSetSuspended(adopted, { snapshotVersion: 'snap-a', semester: '' })).toBe('');
    expect(isWorkingSetSuspended(adopted, { snapshotVersion: 'snap-b', semester: '' })).toBe('snapshot');
  });
});
