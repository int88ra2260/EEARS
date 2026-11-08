import { beforeEach, describe, expect, test } from 'vitest';
import {
  clearWorkingSet,
  isWorkingSetSuspended,
  readWorkingSet,
  rebindWorkingSet,
  saveWorkingSet,
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
});
