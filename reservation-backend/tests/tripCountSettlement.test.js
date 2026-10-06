'use strict';

const { allocateEqualShares, settleTrip } = require('../services/tripCountSettlement');

describe('trip count settlement', () => {
  test('均分時餘數分給前面的成員', () => {
    expect(allocateEqualShares(101, [1, 2])).toEqual([
      { memberId: 1, shareCents: 51 },
      { memberId: 2, shareCents: 50 },
    ]);
  });

  test('依成員順序產生建議轉帳，總額和手算結算相同', () => {
    const members = [
      { id: 1, name: '安', sortOrder: 0 },
      { id: 2, name: '芳', sortOrder: 1 },
      { id: 3, name: '仰', sortOrder: 2 },
      { id: 4, name: '安迪', sortOrder: 3 },
    ];
    const result = settleTrip(members, [
      { amountCents: 26500, payerMemberId: 1, shares: [{ memberId: 3, shareCents: 26500 }] },
      { amountCents: 106050, payerMemberId: 1, shares: [{ memberId: 4, shareCents: 106050 }] },
      { amountCents: 31450, payerMemberId: 2, shares: [{ memberId: 4, shareCents: 31450 }] },
    ]);

    expect(result.people.map((person) => [person.name, person.balanceCents])).toEqual([
      ['安', 132550],
      ['芳', 31450],
      ['仰', -26500],
      ['安迪', -137500],
    ]);
    expect(result.transfers).toEqual([
      { fromMemberId: 3, fromName: '仰', toMemberId: 1, toName: '安', amountCents: 26500 },
      { fromMemberId: 4, fromName: '安迪', toMemberId: 1, toName: '安', amountCents: 106050 },
      { fromMemberId: 4, fromName: '安迪', toMemberId: 2, toName: '芳', amountCents: 31450 },
    ]);
  });
});
