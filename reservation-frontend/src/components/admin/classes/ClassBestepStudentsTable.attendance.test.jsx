import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import ClassBestepStudentsTable from './ClassBestepStudentsTable';
import ClassBestepFilters from './ClassBestepFilters';

const filters = { semester: '114-1', examType: 'all', page: 1, pageSize: 50 };

function student(overrides) {
  return {
    studentId: 'SYN-N-1',
    studentName: '合成丙',
    department: '外文',
    personalRegistration: {
      status: 'success',
      examType: 'LRSW',
      examTypeLabel: '聽讀說寫',
      exemptionType: '無',
    },
    groupRegistration: null,
    attendance: {
      L: { attended: true },
      R: { attended: false },
      S: { attended: null },
      W: {},
    },
    score: null,
    ...overrides,
  };
}

function renderTable(students, pagination = { total: students.length, totalPages: 1 }) {
  const onExport = vi.fn();
  const onFilterChange = vi.fn();
  render(
    <ClassBestepStudentsTable
      loading={false}
      students={students}
      filters={filters}
      pagination={pagination}
      exporting={false}
      onFilterChange={onFilterChange}
      onExport={onExport}
      onShowStudentDetail={vi.fn()}
      onOpenStudentJourney={vi.fn()}
    />
  );
  return { onExport, onFilterChange };
}

describe('Class BESTEP attendance cells', () => {
  test('renders skill states without calling unknown attendance absent', () => {
    renderTable([student()]);
    const row = screen.getByText('SYN-N-1').closest('tr');
    const cells = within(row).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent).slice(0, 8)).toEqual([
      'SYN-N-1',
      '合成丙',
      '外文',
      '聽讀說寫',
      '無',
      '報名成功',
      '無',
      'L: 出席R: 缺席S: 未確認W: 未確認',
    ]);
    expect(cells[7].textContent).not.toMatch(/S: 缺席|W: 缺席/);
    expect(screen.getByRole('columnheader', { name: '出席狀況' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '個人報名' })).toBeTruthy();
  });

  test('does not infer unregistered or exempted status from a missing attendance object', () => {
    renderTable([
      student({
        studentId: 'SYN-N-UNREG',
        personalRegistration: null,
        attendance: {},
      }),
      student({
        studentId: 'SYN-N-EXEMPT',
        personalRegistration: {
          status: 'success',
          examTypeLabel: '聽讀說寫',
          exemptionType: '聽讀說寫',
          exemption_review_status: 'approved',
          exemptionVerifiedType: 'LRSW',
        },
        attendance: {},
      }),
    ]);

    const unregistered = within(screen.getByText('SYN-N-UNREG').closest('tr')).getAllByRole('cell');
    expect(unregistered[5]).toHaveTextContent('未報名');
    expect(unregistered[7]).toHaveTextContent('未匯入');
    expect(unregistered[7]).not.toHaveTextContent('缺席');
    expect(unregistered[7]).not.toHaveTextContent('不適用');

    const exempted = within(screen.getByText('SYN-N-EXEMPT').closest('tr')).getAllByRole('cell');
    expect(exempted[4]).toHaveTextContent('聽讀說寫');
    expect(exempted[7]).toHaveTextContent('未匯入');
    expect(exempted[7]).not.toHaveTextContent('缺席');
    expect(exempted[7]).not.toHaveTextContent('抵免');
  });

  test('keeps pagination and export controls', async () => {
    const user = userEvent.setup();
    const { onExport, onFilterChange } = renderTable(
      [student()],
      { total: 60, totalPages: 2 }
    );
    expect(screen.getByText('第 1 頁，共 2 頁')).toBeTruthy();
    expect(screen.getByRole('button', { name: '上一頁' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '下一頁' }));
    expect(onFilterChange).toHaveBeenCalledWith('page', 2);
    await user.click(screen.getByRole('button', { name: '匯出 BESTEP Excel' }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  test('keeps the existing search and exam-type filters', () => {
    render(
      <ClassBestepFilters
        filters={filters}
        onFilterChange={vi.fn()}
        onSearchChange={vi.fn()}
      />
    );
    expect(screen.getByText('搜尋學生')).toBeTruthy();
    expect(screen.getByPlaceholderText('輸入學號或姓名...')).toBeTruthy();
    expect(screen.getByText('考試類型')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'LR（聽讀）' })).toBeTruthy();
  });
});
