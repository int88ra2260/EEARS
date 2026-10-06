import { describe, expect, test } from 'vitest';
import { formatTwd, parseTwdToCents } from './tripCountMoney';

describe('trip count money', () => {
  test('接受到分的金額', () => {
    expect(parseTwdToCents('2497')).toBe(249700);
    expect(parseTwdToCents('1,104.5')).toBe(110450);
    expect(parseTwdToCents('0')).toBeNull();
    expect(parseTwdToCents('12.345')).toBeNull();
  });

  test('顯示新台幣到分', () => {
    expect(formatTwd(132550)).toBe('1,325.50');
    expect(formatTwd(-31450)).toBe('-314.50');
  });
});
