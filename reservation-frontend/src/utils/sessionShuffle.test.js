import { getSessionShuffledItems, shuffleWithSeed } from './sessionShuffle';

describe('sessionShuffle', () => {
  it('is deterministic for the same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const first = shuffleWithSeed(items, 'test-seed');
    const second = shuffleWithSeed(items, 'test-seed');
    expect(first).toEqual(second);
    expect(first).not.toEqual(items);
  });

  it('stores shuffle order per session key', () => {
    const items = [1, 2, 3, 4];
    const key = `unit-test-${Date.now()}`;
    const first = getSessionShuffledItems(items, key);
    const second = getSessionShuffledItems(items, key);
    expect(first).toEqual(second);
  });
});
