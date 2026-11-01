'use strict';

const fs = require('fs');
const path = require('path');
const { halfOpenFromConfiguredSemester, instantInHalfOpen } = require('../../analytics-contracts');

describe('legacy temporal boundary notes', () => {
  test('configured inclusive end is the day before the half-open end', () => {
    const window = halfOpenFromConfiguredSemester('114-2');
    expect(window.legacyEnd).toBe('2026-07-31');
    expect(window.endExclusive).toBe('2026-08-01T00:00:00+08:00');
    expect(instantInHalfOpen(window.startInclusive, window.endExclusive, '2026-07-31T18:00:00+08:00')).toBe(true);
  });

  test('a JS string comparison is not the same as the half-open instant', () => {
    const start = '2026-02-01';
    const end = '2026-07-31';
    const stamp = '2026-07-31 18:00:00';
    const stringInside = stamp >= start && stamp <= end;
    expect(stringInside).toBe(false);
    expect(instantInHalfOpen(
      '2026-02-01T00:00:00+08:00',
      '2026-08-01T00:00:00+08:00',
      '2026-07-31T18:00:00+08:00',
    )).toBe(true);
  });

  test('kpiService still binds date strings while also building unused clock strings', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../services/kpiService.js'), 'utf8');
    expect(source).toContain('const end = `${range.end} 23:59:59`');
    expect(source).toContain('endDate: range.end');
    expect(source).not.toContain('endDate: end');
  });

  test('et_semesters is a separate nullable date pair and is not read by the boundary adapter', () => {
    const model = fs.readFileSync(path.join(__dirname, '../../models/EtSemester.js'), 'utf8');
    expect(model).toContain('startDate');
    expect(model).toContain('endDate');
    expect(model).toContain('allowNull: true');
    const adapter = fs.readFileSync(
      path.join(__dirname, '../../analytics-contracts/semesterBoundaryAdapter.js'),
      'utf8',
    );
    expect(adapter).not.toContain('et_semesters');
    expect(adapter).not.toContain('EtSemester');
  });
});
