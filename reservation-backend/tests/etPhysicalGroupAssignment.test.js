'use strict';

const {
  normalizeAbilityGroupSlots,
  buildMixedPhysicalAssignments,
  buildAssignmentsByStrategy,
  buildPhysicalGroupLabel,
  assignStudentsToAbilityPhysicalSlots,
  assignStudentsToLegacyPhysicalSlots,
  splitEvenlyContiguous,
  distributeRoundRobin,
  GROUPING_STRATEGIES,
} = require('../services/etGrouping/etPhysicalGroupAssignment');

function makeStudent(id, gse) {
  return {
    reservation: { id, studentId: `S${id}` },
    snapshot: {
      gse: gse == null ? null : gse,
      cefr: gse == null ? null : 'B1',
      dataQuality: gse == null ? 'missing' : 'high',
    },
    band: { code: gse == null ? 'ET-UNK' : 'ET-B1' },
  };
}

describe('etPhysicalGroupAssignment', () => {
  it('defaults to all groups when groupSlots omitted', () => {
    const result = normalizeAbilityGroupSlots(null, 6);
    expect(result.abilitySlots).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.legacySlots).toEqual([]);
    expect(result.allAbility).toBe(true);
  });

  it('supports partial ability group selection', () => {
    const result = normalizeAbilityGroupSlots([1, 3, 5], 6);
    expect(result.abilitySlots).toEqual([1, 3, 5]);
    expect(result.legacySlots).toEqual([2, 4, 6]);
    expect(result.allAbility).toBe(false);
  });

  it('legacy mixed assigns selected groups by GSE and others by reservation order', () => {
    const students = [
      makeStudent(1, 50),
      makeStudent(2, 36),
      makeStudent(3, 80),
      makeStudent(4, null),
    ];

    const rows = buildMixedPhysicalAssignments({
      eventId: 99,
      students,
      abilitySlots: [1],
      legacySlots: [2],
      perGroupCapacity: 2,
    });

    expect(rows).toHaveLength(4);
    const abilityRows = rows.filter((row) => row.source === 'auto');
    const legacyRows = rows.filter((row) => row.source === 'legacy');
    expect(abilityRows.every((row) => row.groupLabel === buildPhysicalGroupLabel(1))).toBe(true);
    expect(legacyRows.every((row) => row.groupLabel === buildPhysicalGroupLabel(2))).toBe(true);
    expect(abilityRows[0].studentId).toBe('S3');
  });

  it('round-robin keeps groups balanced when not full', () => {
    const students = Array.from({ length: 10 }, (_, i) => makeStudent(i + 1, 60 - i));
    const rows = distributeRoundRobin(students, [1, 2, 3, 4, 5, 6, 7, 8, 9], 4, {
      eventId: 1,
      source: 'legacy',
    });
    const counts = {};
    rows.forEach((row) => {
      counts[row.groupLabel] = (counts[row.groupLabel] || 0) + 1;
    });
    const values = Object.values(counts);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    expect(values.every((n) => n <= 4)).toBe(true);
    expect(rows).toHaveLength(10);
  });

  it('all_ability clusters similar GSE into the same group', () => {
    const students = [
      makeStudent(1, 90),
      makeStudent(2, 88),
      makeStudent(3, 50),
      makeStudent(4, 48),
      makeStudent(5, 20),
      makeStudent(6, 18),
    ];
    const rows = buildAssignmentsByStrategy({
      eventId: 7,
      students,
      strategy: GROUPING_STRATEGIES.ALL_ABILITY,
      groupCount: 3,
      perGroupCapacity: 4,
    });
    const byGroup = {};
    rows.forEach((row) => {
      if (!byGroup[row.groupLabel]) byGroup[row.groupLabel] = [];
      byGroup[row.groupLabel].push(row.gseSnapshot);
    });
    // contiguous high / mid / low clusters
    expect(byGroup['Group 1'].sort((a, b) => b - a)).toEqual([90, 88]);
    expect(byGroup['Group 2'].sort((a, b) => b - a)).toEqual([50, 48]);
    expect(byGroup['Group 3'].sort((a, b) => b - a)).toEqual([20, 18]);
  });

  it('mixed_ability_random uses random for non-ability slots', () => {
    const students = Array.from({ length: 8 }, (_, i) => makeStudent(i + 1, 80 - i * 5));
    const rows = buildAssignmentsByStrategy({
      eventId: 3,
      students,
      strategy: GROUPING_STRATEGIES.MIXED_ABILITY_RANDOM,
      groupCount: 4,
      abilitySlots: [1, 2],
      legacySlots: [3, 4],
      perGroupCapacity: 2,
      randomSeed: 42,
    });
    expect(rows.filter((r) => r.source === 'auto').length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.source === 'random').length).toBeGreaterThan(0);
  });

  it('splitEvenlyContiguous balances chunk sizes', () => {
    expect(splitEvenlyContiguous([1, 2, 3, 4, 5], 3)).toEqual([[1, 2], [3, 4], [5]]);
    expect(splitEvenlyContiguous([1, 2, 3, 4], 4)).toEqual([[1], [2], [3], [4]]);
  });

  it('respects per-group capacity limits and marks overflow', () => {
    const students = Array.from({ length: 5 }, (_, index) => makeStudent(index + 1, 55 - index));
    const { assignments } = assignStudentsToAbilityPhysicalSlots(
      students,
      [1, 2],
      2,
      { eventId: 1 }
    );
    expect(assignments).toHaveLength(5);
    const group1 = assignments.filter((row) => row.groupLabel === buildPhysicalGroupLabel(1));
    const group2 = assignments.filter((row) => row.groupLabel === buildPhysicalGroupLabel(2));
    const overflow = assignments.filter((row) => String(row.groupLabel).includes('overflow'));
    expect(group1).toHaveLength(2);
    expect(group2).toHaveLength(2);
    expect(overflow).toHaveLength(1);
  });

  it('fills legacy slots in reservation order', () => {
    const students = [makeStudent(10, null), makeStudent(11, null)];
    const rows = assignStudentsToLegacyPhysicalSlots(students, [3, 4], 2, { eventId: 1 });
    expect(rows[0].groupLabel).toBe(buildPhysicalGroupLabel(3));
    expect(rows[1].groupLabel).toBe(buildPhysicalGroupLabel(4));
    expect(rows.every((row) => row.source === 'legacy')).toBe(true);
  });
});
