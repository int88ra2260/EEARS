'use strict';



const {

  buildGroupLabel,

  assignStudentsToTables,

  buildBandTableAssignments,

  countBandTables,

} = require('../services/etGrouping/etBandTableAssignmentService');



const mockBands = [

  {

    code: 'ET-B1',

    label: 'B1',

    gseMin: 43,

    gseMax: 58,

    tableCount: 2,

    maxPerTable: 2,

    isActive: true,

  },

  {

    code: 'ET-UNK',

    label: '待確認',

    gseMin: null,

    gseMax: null,

    tableCount: 1,

    maxPerTable: 4,

    isActive: true,

  },

];



describe('etBandTableAssignmentService', () => {

  it('builds multi-table labels', () => {

    expect(buildGroupLabel(mockBands[0], 1)).toBe('ET-B1-1');

    expect(buildGroupLabel(mockBands[0], 2)).toBe('ET-B1-2');

    expect(buildGroupLabel({ code: 'ET-A2', tableCount: 1 }, 1)).toBe('ET-A2');

  });



  it('round-robin assigns students across band tables', () => {

    const band = mockBands[0];

    const students = [

      { reservation: { id: 1 }, snapshot: {}, band },

      { reservation: { id: 2 }, snapshot: {}, band },

      { reservation: { id: 3 }, snapshot: {}, band },

      { reservation: { id: 4 }, snapshot: {}, band },

    ];

    const placed = assignStudentsToTables(students, band);

    expect(placed.map((row) => row.groupLabel)).toEqual([

      'ET-B1-1',

      'ET-B1-2',

      'ET-B1-1',

      'ET-B1-2',

    ]);

  });



  it('counts total band tables excluding inactive and UNK band', () => {

    const bands = [

      { code: 'ET-B1', tableCount: 2, isActive: true },

      { code: 'ET-B2', tableCount: 1, isActive: false },

      { code: 'ET-UNK', tableCount: 1, isActive: true },

    ];

    expect(countBandTables(bands)).toBe(2);

  });



  it('builds assignment rows per band table layout', () => {

    const students = [

      {

        reservation: { id: 10, studentId: 'S1' },

        snapshot: { gse: 50, cefr: 'B1', dataQuality: 'high' },

        band: mockBands[0],

      },

      {

        reservation: { id: 11, studentId: 'S2' },

        snapshot: { gse: null, cefr: null, dataQuality: 'missing' },

        band: mockBands[1],

      },

    ];

    const rows = buildBandTableAssignments({ eventId: 99, students, bands: mockBands });

    expect(rows).toHaveLength(2);

    expect(rows[0]).toMatchObject({

      eventId: 99,

      studentId: 'S1',

      bandCode: 'ET-B1',

      groupLabel: 'ET-B1-1',

      source: 'auto',

    });

    expect(rows[1].bandCode).toBe('ET-UNK');

  });

});

