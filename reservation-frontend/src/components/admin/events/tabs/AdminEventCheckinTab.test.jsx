import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import AdminEventCheckinTab from './AdminEventCheckinTab';

const confirm = vi.fn();

vi.mock('../../../ui/useConfirm', () => ({
  default: () => ({ confirm }),
}));

function renderTab(extra = {}) {
  const tabProps = {
    resBlocking: false,
    reservationsError: '',
    pendingCheckinRows: [
      { id: 1, studentId: 'A12345678', studentName: '王小明', checkinStatus: '未簽到' },
    ],
    checkedInRows: [
      {
        id: 2,
        studentId: 'B12345678',
        studentName: '李小華',
        checkinStatus: '已簽到',
        excludeFromClassCredit: false,
        checkinTime: '2026-10-05T04:10:00.000Z',
      },
    ],
    violationRows: [],
    currentEventType: 'Job Talk',
    currentEventDate: '2026-10-01',
    canCheckinStudents: true,
    canManageEvents: true,
    checkinLoading: {},
    handleCheckin: vi.fn(),
    handleCorrectCheckin: vi.fn(),
    isEventToday: () => false,
    ...extra,
  };

  render(
    <MemoryRouter initialEntries={['/admin/operations/367']}>
      <Routes>
        <Route path="/admin/operations/:eventId" element={<AdminEventCheckinTab tabProps={tabProps} />} />
      </Routes>
    </MemoryRouter>,
  );

  return tabProps;
}

describe('AdminEventCheckinTab', () => {
  test('兩種簽到分開標示，按下去會先確認，取消就不會送出', async () => {
    confirm.mockResolvedValue(false);
    const tabProps = renderTab();

    expect(screen.getByText('計入課堂加分')).toBeInTheDocument();
    expect(screen.getByText('不計課堂加分')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '改為不計點' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消簽到' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '補簽到' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      title: '確認補簽到？',
      description: '王小明（A12345678）',
      confirmText: '確認補簽到',
    }));
    await Promise.resolve();
    expect(tabProps.handleCheckin).not.toHaveBeenCalled();
  });

  test('確認後才送出補簽到', async () => {
    confirm.mockResolvedValue(true);
    const tabProps = renderTab();

    fireEvent.click(screen.getByRole('button', { name: '補簽到' }));
    await vi.waitFor(() => {
      expect(tabProps.handleCheckin).toHaveBeenCalledWith(1, {
        countsTowardPassport: false,
        excludeFromClassCredit: false,
        alreadyConfirmed: true,
      });
    });
  });
});
