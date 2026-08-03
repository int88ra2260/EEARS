'use strict';



const {

  matchBandForSnapshot,

  assignStudentsToTables,

  UNK_BAND_CODE,

} = require('../services/etGrouping/etGroupingService');

const { buildLegacySequentialGroups } = require('../services/etGrouping/etReservationGroupDisplayService');



const mockBands = [

  {

    code: 'ET-A2',

    label: 'A1–A2',

    gseMin: 22,

    gseMax: 42,

    tableCount: 2,

    maxPerTable: 5,

  },

  {

    code: 'ET-B1',

    label: 'B1',

    gseMin: 43,

    gseMax: 58,

    tableCount: 1,

    maxPerTable: 5,

  },

  {

    code: UNK_BAND_CODE,

    label: '待確認',

    gseMin: null,

    gseMax: null,

    tableCount: 1,

    maxPerTable: 12,

  },

];



describe('etGrouping algorithm', () => {

  it('maps GSE into correct band', () => {

    const b1 = matchBandForSnapshot({ gse: 50, cefr: 'B1', dataQuality: 'high' }, mockBands);

    expect(b1.code).toBe('ET-B1');



    const a2 = matchBandForSnapshot({ gse: 36, cefr: 'A2', dataQuality: 'high' }, mockBands);

    expect(a2.code).toBe('ET-A2');



    const unk = matchBandForSnapshot({ gse: null, cefr: null, dataQuality: 'missing' }, mockBands);

    expect(unk.code).toBe(UNK_BAND_CODE);

  });



  it('round-robin assigns students across tables in same band', () => {

    const band = mockBands[0];

    const students = [

      { reservationId: 1, studentId: 'S1', snapshot: { gse: 40 } },

      { reservationId: 2, studentId: 'S2', snapshot: { gse: 35 } },

      { reservationId: 3, studentId: 'S3', snapshot: { gse: 30 } },

    ];

    const placed = assignStudentsToTables(students, band);

    expect(placed).toHaveLength(3);

    expect(placed[0].groupLabel).toBe('ET-A2-1');

    expect(placed[1].groupLabel).toBe('ET-A2-2');

    expect(placed[2].groupLabel).toBe('ET-A2-1');

  });



  it('legacy sequential grouping uses configured group count', () => {

    const reservations = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, group: null }));

    const grouped6 = buildLegacySequentialGroups(reservations, { groupCount: 6 });

    const labels6 = new Set(grouped6.map((g) => g.group));

    expect(labels6.size).toBe(6);



    const grouped = buildLegacySequentialGroups(reservations, { groupCount: 9 });

    const labels = new Set(grouped.map((g) => g.group));

    expect(labels.size).toBe(9);

    expect(grouped[0].group).toBe('Group 1');

  });

});

