import { describe, expect, test } from 'vitest';
import { allocateEqualShares, allocateWeightedShares } from './tripCountShares';

describe('trip count share preview', () => {
  test('均分預覽', () => {
    expect(allocateEqualShares(101, [1, 2])).toEqual([
      { memberId: 1, shareCents: 51 },
      { memberId: 2, shareCents: 50 },
    ]);
  });

  test('依份數預覽', () => {
    expect(allocateWeightedShares(30000, [
      { memberId: 1, weight: 1 },
      { memberId: 2, weight: 2 },
      { memberId: 3, weight: 1 },
    ])).toEqual([
      { memberId: 1, shareCents: 7500, weight: 1 },
      { memberId: 2, shareCents: 15000, weight: 2 },
      { memberId: 3, shareCents: 7500, weight: 1 },
    ]);
  });
});
