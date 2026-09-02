'use strict';

const {
  normalizeStudentId,
  normalizeIdNumber,
  normalizeName,
  normalizeMatchFields,
  parseRosterMatrix,
  DEFAULT_MATCH_FIELDS,
} = require('../services/englishTestStudentIdCardRosterService');

describe('englishTestStudentIdCardRosterService', () => {
  describe('normalizeMatchFields', () => {
    test('defaults when all false', () => {
      expect(normalizeMatchFields({ studentId: false, name: false, idNumber: false })).toEqual({
        ...DEFAULT_MATCH_FIELDS,
      });
    });

    test('keeps selected fields', () => {
      expect(normalizeMatchFields({ studentId: true, name: true, idNumber: false })).toEqual({
        studentId: true,
        name: true,
        idNumber: false,
      });
    });
  });

  describe('parseRosterMatrix', () => {
    const header = ['學號', '身分證字號', '姓名'];

    test('requires 姓名 column', () => {
      expect(() =>
        parseRosterMatrix([
          ['學號', '身分證字號'],
          ['S1234567', 'A123456789'],
        ])
      ).toThrow(/姓名/);
    });

    test('parses valid rows', () => {
      const result = parseRosterMatrix([
        header,
        ['s1234567', 'a123456789', '王小明'],
      ]);
      expect(result.insertedCount).toBe(1);
      expect(result.entries[0]).toEqual({
        studentId: 'S1234567',
        idNumber: 'A123456789',
        nameZh: '王小明',
      });
    });

    test('skips studentId with conflicting idNumber or name', () => {
      const result = parseRosterMatrix([
        header,
        ['S1234567', 'A123456789', '王小明'],
        ['S1234567', 'B123456789', '王大明'],
      ]);
      expect(result.insertedCount).toBe(0);
      expect(result.conflictCount).toBe(1);
    });

    test('rejects row missing name', () => {
      const result = parseRosterMatrix([
        header,
        ['S1234567', 'A123456789', ''],
      ]);
      expect(result.insertedCount).toBe(0);
      expect(result.invalidRows.some((r) => r.field === '姓名')).toBe(true);
    });
  });

  describe('normalizers', () => {
    test('normalizeStudentId uppercases and strips', () => {
      expect(normalizeStudentId(' s12-34567 ')).toBe('S1234567');
    });

    test('normalizeIdNumber uppercases', () => {
      expect(normalizeIdNumber('a123456789')).toBe('A123456789');
    });

    test('normalizeName trims and collapses spaces', () => {
      expect(normalizeName(' 王  小明 ')).toBe('王小明');
    });
  });
});
