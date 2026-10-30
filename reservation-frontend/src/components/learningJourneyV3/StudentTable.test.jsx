import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import StudentTable from './StudentTable';

function renderTable(props) {
  return render(
    <MemoryRouter>
      <StudentTable
        semesterId="114-2"
        pagination={{ limit: 20, offset: 0, total: 0, returned: 0 }}
        onPageChange={vi.fn()}
        students={[]}
        {...props}
      />
    </MemoryRouter>
  );
}

describe('learning journey student list empty state', () => {
  test('shows student rows when data exists', () => {
    renderTable({
      students: [{
        studentId: 'B123456789',
        studentName: '測試生',
        grade: '2',
        department: '外文系',
        bestSkills: { listening: { cefr: 'B1' } },
      }],
      pagination: { limit: 20, offset: 0, total: 1, returned: 1 },
    });
    expect(screen.getByText('B123456789')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看' })).toHaveAttribute(
      'href',
      '/admin/learning-journey/students/B123456789?semesterId=114-2'
    );
    expect(screen.queryByText('此學期目前沒有學生資料。')).toBeNull();
  });

  test('shows a semester empty state only when the unfiltered list is empty', () => {
    renderTable({ hasActiveFilters: false });
    expect(screen.getByText('此學期目前沒有學生資料。')).toBeInTheDocument();
    expect(screen.getByText('總筆數：0')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('shows a filter empty state without calling the semester empty', () => {
    renderTable({ hasActiveFilters: true });
    expect(screen.getByText('沒有符合篩選條件的學生。')).toBeInTheDocument();
    expect(screen.queryByText('此學期目前沒有學生資料。')).toBeNull();
  });

  test('keeps an empty later page distinct from having no students', () => {
    renderTable({
      hasActiveFilters: false,
      pagination: { limit: 20, offset: 20, total: 25, returned: 0 },
    });
    expect(screen.getByText('這一頁沒有學生資料。')).toBeInTheDocument();
    expect(screen.queryByText('此學期目前沒有學生資料。')).toBeNull();
  });

  test('keeps a filtered empty page distinct from a filter with no matches', () => {
    renderTable({
      hasActiveFilters: true,
      pagination: { limit: 20, offset: 20, total: 25, returned: 0 },
    });
    expect(screen.getByText('這一頁沒有學生資料。')).toBeInTheDocument();
    expect(screen.queryByText('沒有符合篩選條件的學生。')).toBeNull();
    expect(screen.queryByText('此學期目前沒有學生資料。')).toBeNull();
  });

  test('does not show an empty state while loading or after an error', () => {
    const loadingView = renderTable({ loading: true });
    expect(screen.getByText('正在載入學生清單...')).toBeInTheDocument();
    expect(screen.queryByText('此學期目前沒有學生資料。')).toBeNull();
    loadingView.unmount();

    renderTable({ error: '讀取學生清單失敗' });
    expect(screen.getByText('學生清單載入失敗：讀取學生清單失敗')).toBeInTheDocument();
    expect(screen.queryByText('此學期目前沒有學生資料。')).toBeNull();
    expect(screen.queryByText('沒有符合篩選條件的學生。')).toBeNull();
  });
});
