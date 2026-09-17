'use strict';

const { resolveLegacyGroupCount } = require('../../utils/eventCapacity');

const PHYSICAL_GROUP_PREFIX = 'Group ';

/** 寫入 plan.groupingLayout；相容舊值 physical_slots */
const GROUPING_STRATEGIES = Object.freeze({
  LEGACY_ORDER: 'legacy_order',
  RANDOM: 'random',
  ALL_ABILITY: 'all_ability',
  MIXED_ABILITY_RANDOM: 'mixed_ability_random',
  BAND_TABLES: 'band_tables',
});

function buildPhysicalGroupLabel(groupNumber) {
  return `${PHYSICAL_GROUP_PREFIX}${groupNumber}`;
}

function parsePhysicalGroupNumber(label) {
  if (!label || typeof label !== 'string') return null;
  const match = label.match(/^Group\s+(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function allSlotNumbers(groupCount) {
  const total = Math.max(1, resolveLegacyGroupCount({ groupCount }));
  return Array.from({ length: total }, (_, index) => index + 1);
}

/**
 * 正規化「能力組」勾選；空／null 表示全部組別。
 */
function normalizeAbilityGroupSlots(groupSlots, groupCount) {
  const total = Math.max(1, resolveLegacyGroupCount({ groupCount }));
  let abilitySlots;
  if (!Array.isArray(groupSlots) || groupSlots.length === 0) {
    abilitySlots = allSlotNumbers(total);
  } else {
    abilitySlots = [...new Set(
      groupSlots
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= total)
    )].sort((a, b) => a - b);
  }

  if (!abilitySlots.length) {
    throw Object.assign(new Error('請至少選擇一個組別進行能力分組'), { status: 400 });
  }

  const abilitySet = new Set(abilitySlots);
  const legacySlots = [];
  for (let i = 1; i <= total; i += 1) {
    if (!abilitySet.has(i)) legacySlots.push(i);
  }

  return {
    groupCount: total,
    abilitySlots,
    legacySlots,
    allAbility: legacySlots.length === 0,
  };
}

function normalizeGroupingStrategy(raw, { hasPartialAbilitySlots = false } = {}) {
  const key = String(raw || '').trim();
  if (key === GROUPING_STRATEGIES.BAND_TABLES) return GROUPING_STRATEGIES.BAND_TABLES;
  if (key === GROUPING_STRATEGIES.LEGACY_ORDER) return GROUPING_STRATEGIES.LEGACY_ORDER;
  if (key === GROUPING_STRATEGIES.RANDOM) return GROUPING_STRATEGIES.RANDOM;
  if (key === GROUPING_STRATEGIES.ALL_ABILITY) return GROUPING_STRATEGIES.ALL_ABILITY;
  if (key === GROUPING_STRATEGIES.MIXED_ABILITY_RANDOM) return GROUPING_STRATEGIES.MIXED_ABILITY_RANDOM;
  // 舊版 physical_slots / mixed
  if (key === 'physical_slots' || key === 'mixed') {
    return hasPartialAbilitySlots
      ? GROUPING_STRATEGIES.MIXED_ABILITY_RANDOM
      : GROUPING_STRATEGIES.ALL_ABILITY;
  }
  return GROUPING_STRATEGIES.ALL_ABILITY;
}

function strategyRequiresBands(strategy) {
  return strategy === GROUPING_STRATEGIES.ALL_ABILITY
    || strategy === GROUPING_STRATEGIES.MIXED_ABILITY_RANDOM
    || strategy === GROUPING_STRATEGIES.BAND_TABLES;
}

function sortStudentsForAbility(students) {
  return students.slice().sort((a, b) => {
    const gseA = a.snapshot?.gse;
    const gseB = b.snapshot?.gse;
    if (gseA != null && gseB != null) return gseB - gseA;
    if (gseA != null) return -1;
    if (gseB != null) return 1;
    return a.reservation.id - b.reservation.id;
  });
}

function sortStudentsByReservationOrder(students) {
  return students.slice().sort((a, b) => a.reservation.id - b.reservation.id);
}

/** 穩定亂數（同 seed 可重現），避免測試飄忽 */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleStudents(students, seed = Date.now()) {
  const arr = students.slice();
  const rand = mulberry32(Number(seed) || 1);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * 將 n 人切成 k 段，段長盡量平均（前 rem 段多 1 人）。
 * 用於「相近能力同組」：排序後切 contiguous chunks。
 */
function splitEvenlyContiguous(items, slotCount) {
  const k = Math.max(1, slotCount);
  const n = items.length;
  if (k === 1) return [items.slice()];
  const base = Math.floor(n / k);
  const rem = n % k;
  const chunks = [];
  let offset = 0;
  for (let i = 0; i < k; i += 1) {
    const size = base + (i < rem ? 1 : 0);
    chunks.push(items.slice(offset, offset + size));
    offset += size;
  }
  return chunks;
}

function buildAssignmentRow({
  eventId,
  item,
  groupLabel,
  source,
  bandCode,
}) {
  return {
    eventId,
    reservationId: item.reservation.id,
    studentId: item.reservation.studentId,
    bandCode: bandCode || item.band?.code || null,
    groupLabel,
    gseSnapshot: item.snapshot?.gse ?? null,
    cefrSnapshot: item.snapshot?.cefr ?? null,
    dataQuality: item.snapshot?.dataQuality || 'missing',
    source,
    leaderTeacherId: null,
    adjustedBy: null,
    adjustedAt: null,
    adjustReason: null,
  };
}

/**
 * 輪流入座：未滿員時優先把人平均分到各組，避免先塞滿某一組。
 */
function distributeRoundRobin(students, slots, perGroupCapacity, {
  eventId,
  source,
  bandCodeResolver,
} = {}) {
  if (!slots.length) return [];
  const assignments = [];
  const loads = new Map(slots.map((slot) => [slot, 0]));
  let cursor = 0;
  const cap = Math.max(1, perGroupCapacity);

  for (const item of students) {
    let placed = false;
    for (let offset = 0; offset < slots.length; offset += 1) {
      const slot = slots[(cursor + offset) % slots.length];
      if ((loads.get(slot) || 0) < cap) {
        loads.set(slot, (loads.get(slot) || 0) + 1);
        cursor = (slots.indexOf(slot) + 1) % slots.length;
        assignments.push(buildAssignmentRow({
          eventId,
          item,
          groupLabel: buildPhysicalGroupLabel(slot),
          source,
          bandCode: bandCodeResolver ? bandCodeResolver(item) : item.band?.code,
        }));
        placed = true;
        break;
      }
    }
    if (!placed) {
      const overflowSlot = slots[slots.length - 1];
      assignments.push(buildAssignmentRow({
        eventId,
        item,
        groupLabel: `${buildPhysicalGroupLabel(overflowSlot)}-overflow`,
        source,
        bandCode: bandCodeResolver ? bandCodeResolver(item) : item.band?.code,
      }));
    }
  }
  return assignments;
}

/**
 * 相近能力同組：依 GSE 排序後切成平均段，每段進一組。
 * 超過每組上限的人再補到尚有空缺的組。
 */
function distributeAbilityClusters(students, slots, perGroupCapacity, {
  eventId,
  source = 'auto',
  bandCodeResolver,
} = {}) {
  if (!slots.length) return [];
  const sorted = sortStudentsForAbility(students);
  const chunks = splitEvenlyContiguous(sorted, slots.length);
  const assignments = [];
  const overflow = [];
  const cap = Math.max(1, perGroupCapacity);
  const loads = new Map(slots.map((slot) => [slot, 0]));

  chunks.forEach((chunk, index) => {
    const slot = slots[index];
    for (const item of chunk) {
      if ((loads.get(slot) || 0) < cap) {
        loads.set(slot, (loads.get(slot) || 0) + 1);
        assignments.push(buildAssignmentRow({
          eventId,
          item,
          groupLabel: buildPhysicalGroupLabel(slot),
          source,
          bandCode: bandCodeResolver ? bandCodeResolver(item) : item.band?.code,
        }));
      } else {
        overflow.push(item);
      }
    }
  });

  for (const item of overflow) {
    let placed = false;
    for (const slot of slots) {
      if ((loads.get(slot) || 0) < cap) {
        loads.set(slot, (loads.get(slot) || 0) + 1);
        assignments.push(buildAssignmentRow({
          eventId,
          item,
          groupLabel: buildPhysicalGroupLabel(slot),
          source,
          bandCode: bandCodeResolver ? bandCodeResolver(item) : item.band?.code,
        }));
        placed = true;
        break;
      }
    }
    if (!placed) {
      const overflowSlot = slots[slots.length - 1];
      assignments.push(buildAssignmentRow({
        eventId,
        item,
        groupLabel: `${buildPhysicalGroupLabel(overflowSlot)}-overflow`,
        source,
        bandCode: bandCodeResolver ? bandCodeResolver(item) : item.band?.code,
      }));
    }
  }

  return assignments;
}

/** @deprecated 舊測試／相容：輪流能力分組 */
function assignStudentsToAbilityPhysicalSlots(students, abilitySlots, perGroupCapacity, opts) {
  const assignments = distributeRoundRobin(
    sortStudentsForAbility(students),
    abilitySlots,
    perGroupCapacity,
    { ...opts, source: 'auto' }
  );
  return {
    assignments,
    assignedReservationIds: new Set(assignments.map((row) => row.reservationId)),
  };
}

/** @deprecated 舊測試／相容 */
function assignStudentsToLegacyPhysicalSlots(students, legacySlots, perGroupCapacity, opts) {
  return distributeRoundRobin(
    sortStudentsByReservationOrder(students),
    legacySlots,
    perGroupCapacity,
    { ...opts, source: 'legacy' }
  );
}

/**
 * 依策略產生實體組別分組結果（皆平均分配、組名 Group N）。
 */
function buildAssignmentsByStrategy({
  eventId,
  students = [],
  strategy,
  groupCount,
  abilitySlots = [],
  legacySlots = [],
  perGroupCapacity,
  randomSeed,
}) {
  const resolved = normalizeGroupingStrategy(strategy);
  const bandResolver = (item) => item.band?.code;
  const allSlots = allSlotNumbers(groupCount);

  if (resolved === GROUPING_STRATEGIES.LEGACY_ORDER) {
    return distributeRoundRobin(
      sortStudentsByReservationOrder(students),
      allSlots,
      perGroupCapacity,
      { eventId, source: 'legacy', bandCodeResolver: bandResolver }
    );
  }

  if (resolved === GROUPING_STRATEGIES.RANDOM) {
    return distributeRoundRobin(
      shuffleStudents(students, randomSeed ?? eventId),
      allSlots,
      perGroupCapacity,
      { eventId, source: 'random', bandCodeResolver: bandResolver }
    );
  }

  if (resolved === GROUPING_STRATEGIES.ALL_ABILITY) {
    return distributeAbilityClusters(students, allSlots, perGroupCapacity, {
      eventId,
      source: 'auto',
      bandCodeResolver: bandResolver,
    });
  }

  // mixed_ability_random
  const aSlots = (abilitySlots || []).filter((n) => allSlots.includes(n));
  const lSlots = (legacySlots || []).filter((n) => allSlots.includes(n));
  if (!aSlots.length) {
    throw Object.assign(new Error('混合策略請至少勾選一個「能力組」'), { status: 400 });
  }

  const abilityCapacity = aSlots.length * Math.max(1, perGroupCapacity);
  const sorted = sortStudentsForAbility(students);
  const abilityPool = sorted.slice(0, abilityCapacity);
  const abilityAssignments = distributeAbilityClusters(abilityPool, aSlots, perGroupCapacity, {
    eventId,
    source: 'auto',
    bandCodeResolver: bandResolver,
  });
  const assignedIds = new Set(abilityAssignments.map((row) => row.reservationId));
  const leftoverUnique = students.filter((item) => !assignedIds.has(item.reservation.id));

  const randomAssignments = lSlots.length
    ? distributeRoundRobin(
      shuffleStudents(leftoverUnique, (randomSeed ?? eventId) + 17),
      lSlots,
      perGroupCapacity,
      { eventId, source: 'random', bandCodeResolver: bandResolver }
    )
    : leftoverUnique.map((item) => buildAssignmentRow({
      eventId,
      item,
      groupLabel: `${buildPhysicalGroupLabel(aSlots[aSlots.length - 1])}-overflow`,
      source: 'auto',
      bandCode: item.band?.code,
    }));

  return [...abilityAssignments, ...randomAssignments];
}

/** 舊 API 相容 */
function buildMixedPhysicalAssignments({
  eventId,
  students,
  abilitySlots,
  legacySlots,
  perGroupCapacity,
}) {
  if (!legacySlots.length) {
    return buildAssignmentsByStrategy({
      eventId,
      students,
      strategy: GROUPING_STRATEGIES.ALL_ABILITY,
      abilitySlots,
      legacySlots: [],
      perGroupCapacity,
    });
  }
  // 舊行為：其餘依預約順序（非亂數）
  const abilityCapacity = abilitySlots.length * Math.max(1, perGroupCapacity);
  const sorted = sortStudentsForAbility(students);
  const abilityPool = sorted.slice(0, abilityCapacity);
  const abilityAssignments = distributeRoundRobin(abilityPool, abilitySlots, perGroupCapacity, {
    eventId,
    source: 'auto',
    bandCodeResolver: (item) => item.band?.code,
  });
  const assignedIds = new Set(abilityAssignments.map((row) => row.reservationId));
  const remaining = sortStudentsByReservationOrder(
    students.filter((item) => !assignedIds.has(item.reservation.id))
  );
  const legacyAssignments = distributeRoundRobin(remaining, legacySlots, perGroupCapacity, {
    eventId,
    source: 'legacy',
    bandCodeResolver: (item) => item.band?.code,
  });
  return [...abilityAssignments, ...legacyAssignments];
}

function summarizePhysicalSlots({
  groupCount,
  abilitySlots,
  legacySlots,
  assignments = [],
  strategy = null,
}) {
  const counts = new Map();
  for (const row of assignments) {
    const label = row.groupLabel || '未分組';
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  const resolved = normalizeGroupingStrategy(strategy, {
    hasPartialAbilitySlots: Array.isArray(abilitySlots)
      && abilitySlots.length > 0
      && abilitySlots.length < groupCount,
  });

  const slots = [];
  for (let i = 1; i <= groupCount; i += 1) {
    const label = buildPhysicalGroupLabel(i);
    let mode = 'ability';
    if (resolved === GROUPING_STRATEGIES.LEGACY_ORDER) mode = 'legacy';
    else if (resolved === GROUPING_STRATEGIES.RANDOM) mode = 'random';
    else if (resolved === GROUPING_STRATEGIES.MIXED_ABILITY_RANDOM) {
      mode = abilitySlots.includes(i) ? 'ability' : 'random';
    } else if (legacySlots.includes(i)) {
      mode = 'legacy';
    }
    slots.push({
      groupNumber: i,
      groupLabel: label,
      mode,
      count: counts.get(label) || 0,
    });
  }

  return {
    slots,
    abilitySlots,
    legacySlots,
    allAbility: legacySlots.length === 0,
    strategy: resolved,
  };
}

module.exports = {
  PHYSICAL_GROUP_PREFIX,
  GROUPING_STRATEGIES,
  buildPhysicalGroupLabel,
  parsePhysicalGroupNumber,
  normalizeAbilityGroupSlots,
  normalizeGroupingStrategy,
  strategyRequiresBands,
  sortStudentsForAbility,
  sortStudentsByReservationOrder,
  shuffleStudents,
  splitEvenlyContiguous,
  distributeRoundRobin,
  distributeAbilityClusters,
  assignStudentsToAbilityPhysicalSlots,
  assignStudentsToLegacyPhysicalSlots,
  buildMixedPhysicalAssignments,
  buildAssignmentsByStrategy,
  summarizePhysicalSlots,
};
