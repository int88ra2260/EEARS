import { formatTwd } from './tripCountMoney';

function balanceLabel(cents) {
  if (cents > 0) return `可收回 ${formatTwd(cents)}`;
  if (cents < 0) return `還要付 ${formatTwd(-cents)}`;
  return '已平衡';
}

export function formatTripSettlementCopy(trip, settlement) {
  const title = trip?.title || '旅程';
  const transfers = settlement?.transfers || [];
  const people = settlement?.people || [];
  const lines = [`【${title}】建議轉帳`];

  if (!transfers.length) {
    lines.push('目前沒有人需要再轉帳。');
  } else {
    transfers.forEach((transfer) => {
      lines.push(`${transfer.fromName} → ${transfer.toName} ${formatTwd(transfer.amountCents)}`);
    });
  }

  lines.push('', '各人結算：');
  people.forEach((person) => {
    lines.push(
      `${person.name}：先付 ${formatTwd(person.paidCents)}／應分攤 ${formatTwd(person.shareCents)}／${balanceLabel(person.balanceCents)}`,
    );
  });

  return lines.join('\n');
}
