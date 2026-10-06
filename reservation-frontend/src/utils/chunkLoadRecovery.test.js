import { beforeEach, describe, expect, test, vi } from 'vitest';
import { isStaleChunkLoadError, reloadOnceForStaleChunk } from './chunkLoadRecovery';

describe('chunkLoadRecovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('recognizes a stale dynamic import', () => {
    expect(isStaleChunkLoadError(new TypeError(
      'Failed to fetch dynamically imported module: https://emieears.siwan.nsysu.edu.tw/assets/StudentProgressPage-11ZwMPDs.js',
    ))).toBe(true);
    expect(isStaleChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isStaleChunkLoadError(new TypeError('Importing a module script failed'))).toBe(true);
    expect(isStaleChunkLoadError(new Error('render failed'))).toBe(false);
  });

  test('reloads once, then waits before reloading again', () => {
    const reload = vi.fn();
    let now = 1_000_000;
    const options = { storage: sessionStorage, reload, now: () => now };
    const error = new TypeError('Failed to fetch dynamically imported module');

    expect(reloadOnceForStaleChunk(error, options)).toBe(true);
    now += 1000;
    expect(reloadOnceForStaleChunk(error, options)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    now += 20_000;
    expect(reloadOnceForStaleChunk(error, options)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  test('does not reload an unrelated error', () => {
    const reload = vi.fn();
    expect(reloadOnceForStaleChunk(new Error('render failed'), { reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
