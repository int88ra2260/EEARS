import { describe, expect, test } from 'vitest';
import { formatTripSettlementCopy } from './tripCountSettlementText';

describe('trip settlement copy text', () => {
  test('輸出可貼上的建議轉帳文字', () => {
    const text = formatTripSettlementCopy(
      { title: '楊安畢業旅行' },
      {
        transfers: [
          { fromName: '仰', toName: '安', amountCents: 26500 },
        ],
        people: [
          { name: '安', paidCents: 132550, shareCents: 0, balanceCents: 132550 },
          { name: '仰', paidCents: 0, shareCents: 26500, balanceCents: -26500 },
        ],
      },
    );
    expect(text).toContain('【楊安畢業旅行】建議轉帳');
    expect(text).toContain('仰 → 安 265.00');
    expect(text).toContain('安：先付 1,325.50');
    expect(text).toContain('仰：先付 0.00／應分攤 265.00／還要付 265.00');
  });
});
