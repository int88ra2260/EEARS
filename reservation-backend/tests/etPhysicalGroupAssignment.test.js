'use strict';



const {

  normalizeAbilityGroupSlots,

  buildMixedPhysicalAssignments,

  buildPhysicalGroupLabel,

  assignStudentsToAbilityPhysicalSlots,

  assignStudentsToLegacyPhysicalSlots,

} = require('../services/etGrouping/etPhysicalGroupAssignment');



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



  it('assigns selected groups by GSE and others by reservation order', () => {

    const students = [

      { reservation: { id: 1, studentId: 'S1' }, snapshot: { gse: 50, cefr: 'B1', dataQuality: 'high' }, band: { code: 'ET-B1' } },

      { reservation: { id: 2, studentId: 'S2' }, snapshot: { gse: 36, cefr: 'A2', dataQuality: 'high' }, band: { code: 'ET-A2' } },

      { reservation: { id: 3, studentId: 'S3' }, snapshot: { gse: 80, cefr: 'C1', dataQuality: 'high' }, band: { code: 'ET-C1' } },

      { reservation: { id: 4, studentId: 'S4' }, snapshot: { gse: null, cefr: null, dataQuality: 'missing' }, band: { code: 'ET-UNK' } },

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



  it('respects per-group capacity limits', () => {

    const students = Array.from({ length: 5 }, (_, index) => ({

      reservation: { id: index + 1, studentId: `S${index + 1}` },

      snapshot: { gse: 55 - index, cefr: 'B1', dataQuality: 'high' },

      band: { code: 'ET-B1' },

    }));



    const { assignments } = assignStudentsToAbilityPhysicalSlots(

      students,

      [1, 2],

      2,

      { eventId: 1 }

    );



    expect(assignments).toHaveLength(4);

    const group1 = assignments.filter((row) => row.groupLabel === buildPhysicalGroupLabel(1));

    const group2 = assignments.filter((row) => row.groupLabel === buildPhysicalGroupLabel(2));

    expect(group1).toHaveLength(2);

    expect(group2).toHaveLength(2);

  });



  it('fills legacy slots in reservation order', () => {

    const students = [

      { reservation: { id: 10, studentId: 'S10' }, snapshot: { gse: null, dataQuality: 'missing' }, band: { code: 'ET-UNK' } },

      { reservation: { id: 11, studentId: 'S11' }, snapshot: { gse: null, dataQuality: 'missing' }, band: { code: 'ET-UNK' } },

    ];



    const rows = assignStudentsToLegacyPhysicalSlots(students, [3, 4], 2, { eventId: 1 });

    expect(rows[0].groupLabel).toBe(buildPhysicalGroupLabel(3));

    expect(rows[1].groupLabel).toBe(buildPhysicalGroupLabel(4));

    expect(rows.every((row) => row.source === 'legacy')).toBe(true);

  });

});

