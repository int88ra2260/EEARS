'use strict';

const {
  normalizeStudentIdList,
  applyRosterWorkingSet,
  collectImprovedStudentsBySkill,
  WORKING_SET_CAP,
} = require('../services/learningAnalytics/workingSetIds');

describe('workingSetIds', () => {
  it('normalizes, dedupes and caps student ids', () => {
    expect(normalizeStudentIdList(null)).toBeNull();
    expect(normalizeStudentIdList([])).toBeNull();
    expect(normalizeStudentIdList(' b112 , B112  a01 ')).toEqual(['B112', 'A01']);
    const many = Array.from({ length: WORKING_SET_CAP + 5 }, (_, i) => `S${i}`);
    expect(normalizeStudentIdList(many)).toHaveLength(WORKING_SET_CAP);
  });

  it('intersects a roster with the carried student list', () => {
    const roster = [
      { studentId: 'A01', grade: '2' },
      { studentId: 'B02', grade: '3' },
    ];
    const none = applyRosterWorkingSet(roster, null);
    expect(none.students).toBe(roster);
    expect(none.workingSet).toBeNull();

    const hit = applyRosterWorkingSet(roster, ['b02', 'C99']);
    expect(hit.students.map((row) => row.studentId)).toEqual(['B02']);
    expect(hit.workingSet).toEqual(expect.objectContaining({
      requested: 2,
      matchedRoster: 1,
      omittedFromRoster: 1,
    }));
  });

  it('collects unique students whose GSE actually grew, by skill', () => {
    const packed = collectImprovedStudentsBySkill([
      { studentId: 's1', skill: 'speaking', actualGseGrowth: 4 },
      { studentId: 'S1', skill: 'speaking', actualGseGrowth: 1 },
      { studentId: 's2', skill: 'speaking', actualGseGrowth: 0 },
      { studentId: 's3', skill: 'listening', actualGseGrowth: 2 },
      { studentId: 's4', skill: 'speaking', actualGseGrowth: null },
    ]);
    expect(packed.speaking).toEqual({
      total: 1,
      truncated: false,
      studentIds: ['S1'],
    });
    expect(packed.listening.studentIds).toEqual(['S3']);
  });
});
