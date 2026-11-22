import { describe, expect, test } from 'vitest';
import {
  filterKpiDetailRows,
  kpiDetailFilterOptions,
  pageKpiDetailRows,
  sortKpiDetailRows,
} from './kpiStudentDetailTable';

const dimensions = [
  { id: 'lr', label: '聽讀成對' },
  { id: 'sw', label: '說寫成對' },
];

function row(studentId, gradeNo, department, lr, sw) {
  return {
    studentId,
    grade: gradeNo == null ? '' : String(gradeNo),
    gradeNo,
    department,
    dimensions: {
      lr: { passed: lr },
      sw: { passed: sw },
    },
  };
}

const rows = [
  row('B003', 3, '外文系', true, false),
  row('A002', 1, '電機系', true, true),
  row('C001', null, '', false, false),
  row('A010', 2, '外文系', false, true),
];

describe('kpi student detail table', () => {
  test('builds grade and department options from the whole report', () => {
    expect(kpiDetailFilterOptions(rows)).toEqual({
      grades: ['1', '2', '3'],
      departments: ['外文系', '電機系'],
    });
  });

  test('filters by student id, grade, department, and attainment', () => {
    expect(filterKpiDetailRows(rows, { keyword: 'a01' }, dimensions).map((item) => item.studentId))
      .toEqual(['A010']);
    expect(filterKpiDetailRows(rows, { grade: '2' }, dimensions).map((item) => item.studentId))
      .toEqual(['A010']);
    expect(filterKpiDetailRows(rows, { department: '外文系' }, dimensions).map((item) => item.studentId))
      .toEqual(['B003', 'A010']);
    expect(filterKpiDetailRows(rows, { attainment: 'passed' }, dimensions).map((item) => item.studentId))
      .toEqual(['A002']);
    expect(filterKpiDetailRows(rows, { attainment: 'unmet' }, dimensions).map((item) => item.studentId))
      .toEqual(['B003', 'C001', 'A010']);
    expect(filterKpiDetailRows(rows, { attainment: 'dim:sw:N' }, dimensions).map((item) => item.studentId))
      .toEqual(['B003', 'C001']);
  });

  test('sorts ids, grades, and departments, keeping blanks last', () => {
    expect(sortKpiDetailRows(rows, 'studentId', 'asc').map((item) => item.studentId))
      .toEqual(['A002', 'A010', 'B003', 'C001']);
    expect(sortKpiDetailRows(rows, 'grade', 'asc').map((item) => item.studentId))
      .toEqual(['A002', 'A010', 'B003', 'C001']);
    expect(sortKpiDetailRows(rows, 'grade', 'desc').map((item) => item.studentId))
      .toEqual(['B003', 'A010', 'A002', 'C001']);
    expect(sortKpiDetailRows(rows, 'department', 'asc').map((item) => item.studentId))
      .toEqual(['A010', 'B003', 'A002', 'C001']);
    expect(sortKpiDetailRows(rows, 'dim:lr', 'desc').map((item) => item.studentId))
      .toEqual(['A002', 'B003', 'A010', 'C001']);
  });

  test('pages the full list and clamps an out-of-range page', () => {
    const many = Array.from({ length: 120 }, (_, index) => row(`S${String(index + 1).padStart(3, '0')}`, 1, '外文系', true, true));
    const first = pageKpiDetailRows(many, 1, 50);
    expect(first.total).toBe(120);
    expect(first.pageCount).toBe(3);
    expect(first.rows).toHaveLength(50);
    expect(first.rows[0].studentId).toBe('S001');

    const last = pageKpiDetailRows(many, 9, 50);
    expect(last.page).toBe(3);
    expect(last.rows).toHaveLength(20);
    expect(last.rows[0].studentId).toBe('S101');
  });
});
