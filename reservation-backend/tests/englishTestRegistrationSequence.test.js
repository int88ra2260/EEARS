'use strict';

const {
  resolveDisplayRegistrationNumber,
  assignExportSequentialNumbers,
  attachSemesterSequences,
} = require('../utils/englishTestRegistrationSequence');

describe('englishTestRegistrationSequence', () => {
  describe('assignExportSequentialNumbers', () => {
    it('renumbers filtered export rows as 1..N in order', () => {
      const out = assignExportSequentialNumbers([
        { id: 50, name: 'A' },
        { id: 12, name: 'B', toJSON() { return { id: 12, name: 'B' }; } },
        { id: 99, name: 'C' },
      ]);
      expect(out.map((r) => r.exportSequence)).toEqual([1, 2, 3]);
      expect(out.map((r) => r.id)).toEqual([50, 12, 99]);
    });
  });

  describe('resolveDisplayRegistrationNumber', () => {
    it('prefers semesterSequence like the admin list', () => {
      expect(resolveDisplayRegistrationNumber({
        id: 99,
        status: 'success',
        successSequence: 3,
        semesterSequence: 12,
      })).toBe(12);
    });

    it('falls back to successSequence when success and no semesterSequence', () => {
      expect(resolveDisplayRegistrationNumber({
        id: 99,
        status: 'success',
        successSequence: 3,
        semesterSequence: null,
      })).toBe(3);
    });

    it('falls back to id otherwise', () => {
      expect(resolveDisplayRegistrationNumber({
        id: 99,
        status: 'approved',
        successSequence: 3,
        semesterSequence: null,
      })).toBe(99);
    });
  });

  describe('attachSemesterSequences', () => {
    it('maps query results onto rows', async () => {
      const sequelize = {
        query: jest.fn(async () => [
          { id: 10, semesterSequence: 2 },
          { id: 11, semesterSequence: 5 },
        ]),
      };
      const rows = [
        { id: 10, semester: '115-1', toJSON() { return { id: 10, semester: '115-1' }; } },
        { id: 11, semester: '115-1', toJSON() { return { id: 11, semester: '115-1' }; } },
      ];
      const out = await attachSemesterSequences(sequelize, rows, { semesterFilter: '115-1' });
      expect(out.map((r) => r.semesterSequence)).toEqual([2, 5]);
      expect(sequelize.query).toHaveBeenCalled();
    });
  });
});
