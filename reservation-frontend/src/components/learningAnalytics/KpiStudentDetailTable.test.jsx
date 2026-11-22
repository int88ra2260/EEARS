import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import KpiStudentDetailTable from './KpiStudentDetailTable';

const dimensions = [{ id: 'lr', label: '聽讀成對' }];

function row(index, passed) {
  const studentId = `A${String(index).padStart(3, '0')}`;
  return {
    studentId,
    grade: index % 2 === 0 ? '2' : '1',
    gradeNo: index % 2 === 0 ? 2 : 1,
    department: index % 2 === 0 ? '外文系' : '電機系',
    dimensions: {
      lr: { passed, proof: passed ? { instrument: 'BESTEP', examDate: '2026-03-01' } : null },
    },
  };
}

const rows = Array.from({ length: 51 }, (_, index) => row(index + 1, index === 0));

function renderTable() {
  return render(
    <MemoryRouter>
      <KpiStudentDetailTable rows={rows} dimensions={dimensions} />
    </MemoryRouter>,
  );
}

describe('KpiStudentDetailTable', () => {
  test('pages past the old 200-row preview and walks to the last student', () => {
    renderTable();
    expect(screen.getByText('符合 51 / 51 人，第 1–50 人')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'A001' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'A051' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一頁' }));
    expect(screen.getByText('符合 51 / 51 人，第 51–51 人')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'A051' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'A001' })).not.toBeInTheDocument();
  });

  test('filters by student id and attainment, then sorts the result', () => {
    renderTable();
    fireEvent.change(screen.getByLabelText('學號'), { target: { value: 'a051' } });
    expect(screen.getByText('符合 1 / 51 人，第 1–1 人')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'A051' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '清除' }));
    fireEvent.change(screen.getByLabelText('達標'), { target: { value: 'passed' } });
    expect(screen.getByText('符合 1 / 51 人，第 1–1 人')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'A001' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('達標'), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('button', { name: /學號/ }));
    const body = document.querySelector('tbody');
    const ids = within(body).getAllByRole('link').map((link) => link.textContent);
    expect(ids[0]).toBe('A051');
    expect(ids[1]).toBe('A050');
  });
});
