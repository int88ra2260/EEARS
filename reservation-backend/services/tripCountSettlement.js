'use strict';

/**
 * 把一筆金額均分到成員。餘數 1 分錢依成員順序往前補，加總一定等於原金額。
 * @param {number} amountCents
 * @param {number[]} memberIds
 * @returns {{ memberId: number, shareCents: number }[]}
 */
function allocateEqualShares(amountCents, memberIds) {
  const ids = memberIds.map((id) => Number(id));
  const count = ids.length;
  if (!count || !Number.isInteger(amountCents) || amountCents <= 0) return [];
  const base = Math.floor(amountCents / count);
  let remainder = amountCents - base * count;
  return ids.map((memberId) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return { memberId, shareCents: base + extra };
  });
}

/**
 * 依成員名單順序抵銷後，產生最多「人數 − 1」筆轉帳。
 * 正餘額表示該成員應收回，負餘額表示還要付。
 * @param {Array<{ id: number, name: string, sortOrder?: number }>} members
 * @param {Array<{ amountCents: number, payerMemberId: number, shares: { memberId: number, shareCents: number }[] }>} expenses
 */
function settleTrip(members, expenses) {
  const ordered = [...members].sort((a, b) => {
    const order = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (order !== 0) return order;
    return Number(a.id) - Number(b.id);
  });
  const byId = new Map(ordered.map((member) => [Number(member.id), member]));
  const paid = new Map(ordered.map((member) => [Number(member.id), 0]));
  const share = new Map(ordered.map((member) => [Number(member.id), 0]));

  for (const expense of expenses) {
    const payerId = Number(expense.payerMemberId);
    if (!paid.has(payerId)) continue;
    paid.set(payerId, paid.get(payerId) + Number(expense.amountCents || 0));
    for (const row of expense.shares || []) {
      const memberId = Number(row.memberId);
      if (!share.has(memberId)) continue;
      share.set(memberId, share.get(memberId) + Number(row.shareCents || 0));
    }
  }

  const people = ordered.map((member) => {
    const memberId = Number(member.id);
    const paidCents = paid.get(memberId) || 0;
    const shareCents = share.get(memberId) || 0;
    return {
      memberId,
      name: member.name,
      paidCents,
      shareCents,
      balanceCents: paidCents - shareCents,
    };
  });

  const debtors = people
    .filter((person) => person.balanceCents < 0)
    .map((person) => ({ ...person, oweCents: -person.balanceCents }));
  const creditors = people
    .filter((person) => person.balanceCents > 0)
    .map((person) => ({ ...person }));

  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountCents = Math.min(debtor.oweCents, creditor.balanceCents);
    if (amountCents > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        fromName: byId.get(debtor.memberId)?.name || debtor.name,
        toMemberId: creditor.memberId,
        toName: byId.get(creditor.memberId)?.name || creditor.name,
        amountCents,
      });
    }
    debtor.oweCents -= amountCents;
    creditor.balanceCents -= amountCents;
    if (debtor.oweCents === 0) debtorIndex += 1;
    if (creditor.balanceCents === 0) creditorIndex += 1;
  }

  return { people, transfers };
}

module.exports = {
  allocateEqualShares,
  settleTrip,
};
