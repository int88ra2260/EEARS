'use strict';

const { Op } = require('sequelize');
const {
  buildStudentWhere,
  applyEnrollmentScopeToStudentWhere,
  hasStudentScopeFilters,
} = require('../services/learningAnalytics/learningAnalyticsFilterUtils');

describe('learningAnalyticsFilterUtils raw-export enrollment scope', () => {
  it('ignores semester unless forRawExport', () => {
    const chartWhere = buildStudentWhere({ semester: '114-2', cohort: '113' }, 'snap-1');
    expect(chartWhere.enrollmentTerm).toBeUndefined();
    expect(chartWhere.cohort).toBe('113');

    const exportWhere = buildStudentWhere(
      { semester: '114-2', cohort: '113' },
      'snap-1',
      { forRawExport: true }
    );
    expect(exportWhere.enrollmentTerm).toBe('114-2');
    expect(exportWhere.cohort).toBe('113');
  });

  it('maps academic_year to cohort or enrollment_term prefix', () => {
    const where = buildStudentWhere(
      { academic_year: '114' },
      'snap-1',
      { forRawExport: true }
    );
    expect(where[Op.and]).toEqual([
      {
        [Op.or]: [
          { cohort: '114' },
          { enrollmentTerm: { [Op.like]: '114-%' } },
        ],
      },
    ]);
  });

  it('treats academic_year / semester as student-scope filters', () => {
    expect(hasStudentScopeFilters({ academic_year: '114' })).toBe(true);
    expect(hasStudentScopeFilters({ semester: '114-2' })).toBe(true);
    expect(hasStudentScopeFilters({ instrument: 'TOEIC' })).toBe(false);
  });

  it('applyEnrollmentScope prefers explicit enrollment_term', () => {
    const where = {};
    applyEnrollmentScopeToStudentWhere(where, {
      enrollment_term: '113-1',
      semester: '114-2',
      academic_year: '115',
    });
    expect(where.enrollmentTerm).toBe('113-1');
  });
});
