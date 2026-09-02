'use strict';

const { normalizeAcademicCourseResourceType } = require('../services/learningJourney/analytics/academicCourseResourceType');

describe('academicCourseResourceType', () => {
  it('maps sheet names and derived course codes', () => {
    expect(normalizeAcademicCourseResourceType('GE')).toBe('GE');
    expect(normalizeAcademicCourseResourceType('EAP')).toBe('EAP');
    expect(normalizeAcademicCourseResourceType('ESP')).toBe('ESP');
    expect(normalizeAcademicCourseResourceType('GE003')).toBe('GE');
    expect(normalizeAcademicCourseResourceType('EAP001')).toBe('EAP');
    expect(normalizeAcademicCourseResourceType('ESP002')).toBe('ESP');
    expect(normalizeAcademicCourseResourceType('GESP207')).toBeNull();
  });
});
