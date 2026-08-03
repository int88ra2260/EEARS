'use strict';

const { resolveLegacyGroupCount } = require('../../utils/eventCapacity');

const PHYSICAL_GROUP_PREFIX = 'Group ';

function buildPhysicalGroupLabel(groupNumber) {
  return `${PHYSICAL_GROUP_PREFIX}${groupNumber}`;
}

function parsePhysicalGroupNumber(label) {
  if (!label || typeof label !== 'string') return null;
  const match = label.match(/^Group\s+(\d+)$/i);
  return match ? Number(match[1]) : null;
}

/**
 * 正規化使用者選擇的能力分組組別（1-based）。
 * 空陣列/null 代表全部組別。
 */
function normalizeAbilityGroupSlots(groupSlots, groupCount) {
  const total = Math.max(1, resolveLegacyGroupCount({ groupCount }));
  let abilitySlots;
  if (!Array.isArray(groupSlots) || groupSlots.length === 0) {
    abilitySlots = Array.from({ length: total }, (_, index) => index + 1);
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

function sortStudentsForAbility(students) {
  return students.slice().sort((a, b) => {
    const gseA = a.snapshot?.gse;
    const gseB = b.snapshot?.gse;
    if (gseA != null && gseB != null) return gseB - gseA;
    if (gseA != null) return -1;
    if (gseB != null) return 1;
    return String(a.reservation.studentId).localeCompare(String(b.reservation.studentId));
  });
}

function getSlotLoads(assignments, slots) {
  const loads = new Map(slots.map((slot) => [slot, 0]));
  for (const row of assignments) {
    const slot = parsePhysicalGroupNumber(row.groupLabel);
    if (slot != null && loads.has(slot)) {
      loads.set(slot, loads.get(slot) + 1);
    }
  }
  return loads;
}

function findNextAvailableSlot(slots, loads, perGroupCapacity, startIndex = 0) {
  for (let offset = 0; offset < slots.length; offset += 1) {
    const slot = slots[(startIndex + offset) % slots.length];
    if ((loads.get(slot) || 0) < perGroupCapacity) {
      return { slot, nextIndex: (startIndex + offset + 1) % slots.length };
    }
  }
  return null;
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
 * 將學生依 GSE 分配至指定實體組別（Group N）。
 */
function assignStudentsToAbilityPhysicalSlots(students, abilitySlots, perGroupCapacity, { eventId, bandCodeResolver }) {
  const sorted = sortStudentsForAbility(students);
  const assignments = [];
  const loads = getSlotLoads([], abilitySlots);
  let slotCursor = 0;
  const maxAssignable = abilitySlots.length * Math.max(1, perGroupCapacity);

  for (const item of sorted) {
    if (assignments.length >= maxAssignable) break;
    const placement = findNextAvailableSlot(abilitySlots, loads, perGroupCapacity, slotCursor);
    if (!placement) break;
    const { slot, nextIndex } = placement;
    loads.set(slot, (loads.get(slot) || 0) + 1);
    slotCursor = nextIndex;
    assignments.push(buildAssignmentRow({
      eventId,
      item,
      groupLabel: buildPhysicalGroupLabel(slot),
      source: 'auto',
      bandCode: bandCodeResolver ? bandCodeResolver(item) : item.band?.code,
    }));
  }

  return { assignments, assignedReservationIds: new Set(assignments.map((row) => row.reservationId)) };
}

/**
 * 其餘學生依預約順序填入舊制組別。
 */
function assignStudentsToLegacyPhysicalSlots(students, legacySlots, perGroupCapacity, { eventId }) {
  const assignments = [];
  const loads = getSlotLoads([], legacySlots);
  let slotCursor = 0;

  for (const item of students) {
    const placement = findNextAvailableSlot(legacySlots, loads, perGroupCapacity, slotCursor);
    if (!placement) {
      assignments.push(buildAssignmentRow({
        eventId,
        item,
        groupLabel: `${buildPhysicalGroupLabel(legacySlots[legacySlots.length - 1])}-overflow`,
        source: 'legacy',
        bandCode: item.band?.code || null,
      }));
      continue;
    }
    const { slot, nextIndex } = placement;
    loads.set(slot, (loads.get(slot) || 0) + 1);
    slotCursor = nextIndex;
    assignments.push(buildAssignmentRow({
      eventId,
      item,
      groupLabel: buildPhysicalGroupLabel(slot),
      source: 'legacy',
      bandCode: item.band?.code || null,
    }));
  }

  return assignments;
}

function buildMixedPhysicalAssignments({
  eventId,
  students,
  abilitySlots,
  legacySlots,
  perGroupCapacity,
}) {
  const { assignments: abilityAssignments, assignedReservationIds } = assignStudentsToAbilityPhysicalSlots(
    students,
    abilitySlots,
    perGroupCapacity,
    { eventId, bandCodeResolver: (item) => item.band?.code }
  );

  const remaining = students
    .filter((item) => !assignedReservationIds.has(item.reservation.id))
    .sort((a, b) => a.reservation.id - b.reservation.id);

  const legacyAssignments = legacySlots.length
    ? assignStudentsToLegacyPhysicalSlots(remaining, legacySlots, perGroupCapacity, { eventId })
    : [];

  const overflow = remaining.filter(
    (item) => !legacyAssignments.some((row) => row.reservationId === item.reservation.id)
      && !assignedReservationIds.has(item.reservation.id)
  );

  const overflowAssignments = overflow.map((item) => buildAssignmentRow({
    eventId,
    item,
    groupLabel: `${buildPhysicalGroupLabel(abilitySlots[abilitySlots.length - 1])}-overflow`,
    source: 'auto',
    bandCode: item.band?.code || null,
  }));

  return [...abilityAssignments, ...legacyAssignments, ...overflowAssignments];
}

function summarizePhysicalSlots({
  groupCount,
  abilitySlots,
  legacySlots,
  assignments = [],
}) {
  const counts = new Map();
  for (const row of assignments) {
    const label = row.groupLabel || '未分組';
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  const slots = [];
  for (let i = 1; i <= groupCount; i += 1) {
    const label = buildPhysicalGroupLabel(i);
    const mode = abilitySlots.includes(i) ? 'ability' : 'legacy';
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
  };
}

module.exports = {
  PHYSICAL_GROUP_PREFIX,
  buildPhysicalGroupLabel,
  parsePhysicalGroupNumber,
  normalizeAbilityGroupSlots,
  sortStudentsForAbility,
  assignStudentsToAbilityPhysicalSlots,
  assignStudentsToLegacyPhysicalSlots,
  buildMixedPhysicalAssignments,
  summarizePhysicalSlots,
};
