'use strict';

const {
  parseSemesterId,
  deriveEnrollmentTerm,
  computeSemIndex,
  termLabelFromSemIndex,
} = require('../services/learningJourney/utils/semIndexCalculator');
const { TIMING } = require('../constants/learningJourneyEventConstants');

describe('semIndexCalculator', () => {
  it('computes sem_index from enrollment and event term', () => {
    expect(computeSemIndex('113-1', '113-1')).toBe(0);
    expect(computeSemIndex('113-1', '113-2')).toBe(1);
    expect(computeSemIndex('113-1', '114-1')).toBe(2);
    expect(computeSemIndex('113-1', '114-2')).toBe(3);
  });

  it('allows negative sem_index only for entry timing', () => {
    expect(computeSemIndex('113-1', '112-2')).toBeNull();
    expect(computeSemIndex('113-1', '112-2', { timing: TIMING.ENTRY })).toBe(-1);
  });

  it('derives enrollment term from enrollment year', () => {
    expect(deriveEnrollmentTerm(113)).toBe('113-1');
  });

  it('builds term label from sem index', () => {
    expect(termLabelFromSemIndex('113-1', 2)).toBe('114-1');
  });

  it('parses semester id', () => {
    expect(parseSemesterId('114-2')).toEqual({ raw: '114-2', year: 114, term: 2 });
  });
});
