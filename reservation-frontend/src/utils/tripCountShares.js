/** 與後端 tripCountSettlement 對齊的前端預覽用分攤。 */

export function allocateEqualShares(amountCents, memberIds) {
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

export function allocateWeightedShares(amountCents, weightedMembers) {
  const rows = (Array.isArray(weightedMembers) ? weightedMembers : [])
    .map((row) => ({
      memberId: Number(row.memberId),
      weight: Number(row.weight),
    }))
    .filter((row) => Number.isInteger(row.memberId) && Number.isInteger(row.weight) && row.weight > 0);
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  if (!rows.length || !totalWeight || !Number.isInteger(amountCents) || amountCents <= 0) return [];

  const result = rows.map((row) => ({
    memberId: row.memberId,
    shareCents: Math.floor((amountCents * row.weight) / totalWeight),
    weight: row.weight,
  }));
  let remainder = amountCents - result.reduce((sum, row) => sum + row.shareCents, 0);
  for (let i = 0; remainder > 0 && i < result.length; i += 1) {
    result[i].shareCents += 1;
    remainder -= 1;
  }
  return result;
}
