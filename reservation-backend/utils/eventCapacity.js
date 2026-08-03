'use strict';

const DEFAULT_ET_GROUP_COUNT = 9;
const DEFAULT_ET_PER_GROUP_CAPACITY = 4;
const MAX_GROUP_COUNT = 20;
const MAX_PER_GROUP_CAPACITY = 30;
const MAX_TOTAL_CAPACITY = 300;
const MAX_NON_ET_CAPACITY = 100;

function isEnglishTableEventType(eventType) {
  return (eventType || 'English Table') === 'English Table';
}

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/**
 * 正規化活動名額欄位；ET 以 組數×每組人數=總人數 為準。
 * @returns {{ groupCount: number|null, perGroupCapacity: number|null, maxCapacity: number, error?: string }}
 */
function normalizeEventCapacityInput({
  eventType,
  groupCount,
  perGroupCapacity,
  maxCapacity,
} = {}) {
  const isET = isEnglishTableEventType(eventType);

  if (!isET) {
    const cap = toPositiveInt(maxCapacity);
    if (!cap) return { error: '請輸入有效的總人數（1-100）' };
    if (cap > MAX_NON_ET_CAPACITY) {
      return { error: `非 English Table 活動總人數不可超過 ${MAX_NON_ET_CAPACITY}` };
    }
    return { groupCount: null, perGroupCapacity: null, maxCapacity: cap };
  }

  let gc = toPositiveInt(groupCount);
  let pgc = toPositiveInt(perGroupCapacity);
  const mcInput = toPositiveInt(maxCapacity);

  if (!gc) gc = DEFAULT_ET_GROUP_COUNT;
  if (!pgc) pgc = DEFAULT_ET_PER_GROUP_CAPACITY;

  if (gc > MAX_GROUP_COUNT) {
    return { error: `組數不可超過 ${MAX_GROUP_COUNT}` };
  }
  if (pgc > MAX_PER_GROUP_CAPACITY) {
    return { error: `每組人數不可超過 ${MAX_PER_GROUP_CAPACITY}` };
  }

  let mc = gc * pgc;

  // 若前端一併傳入總人數，需與乘積一致
  if (mcInput && mcInput !== mc) {
    return { error: `總人數須等於組數×每組人數（${gc}×${pgc}=${mc}）` };
  }

  if (mc > MAX_TOTAL_CAPACITY) {
    return { error: `總人數不可超過 ${MAX_TOTAL_CAPACITY}` };
  }

  return { groupCount: gc, perGroupCapacity: pgc, maxCapacity: mc };
}

function resolveLegacyGroupCount(event) {
  if (!event) return DEFAULT_ET_GROUP_COUNT;
  const gc = toPositiveInt(event.groupCount);
  return gc || DEFAULT_ET_GROUP_COUNT;
}

function formatCapacityPayload(event) {
  if (!event) return {};
  const base = {
    maxCapacity: event.maxCapacity,
    groupCount: event.groupCount ?? null,
    perGroupCapacity: event.perGroupCapacity ?? null,
  };
  if (isEnglishTableEventType(event.eventType) && base.groupCount && base.perGroupCapacity) {
    base.totalCapacity = base.groupCount * base.perGroupCapacity;
  }
  return base;
}

module.exports = {
  DEFAULT_ET_GROUP_COUNT,
  DEFAULT_ET_PER_GROUP_CAPACITY,
  MAX_GROUP_COUNT,
  MAX_PER_GROUP_CAPACITY,
  MAX_TOTAL_CAPACITY,
  MAX_NON_ET_CAPACITY,
  isEnglishTableEventType,
  normalizeEventCapacityInput,
  resolveLegacyGroupCount,
  formatCapacityPayload,
};
