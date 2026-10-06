import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
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
  beforeEach(() => {
    confirm.mockReset();
  });

  test('一般簽到直接送出，不先跳出確認', async () => {
    const tabProps = renderTab();

    expect(screen.getByText('計入課堂加分')).toBeInTheDocument();
    expect(screen.getByText('不計課堂加分')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '補簽到' }));

    expect(confirm).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(tabProps.handleCheckin).toHaveBeenCalledWith(1, {
        countsTowardPassport: false,
        excludeFromClassCredit: false,
      });
    });
  });

  test('English Table 待簽到不顯示組別，已簽到仍保留', () => {
    renderTab({
      currentEventType: 'english_table',
      pendingCheckinRows: [
        { id: 1, studentId: 'A12345678', studentName: '王小明', group: 'A', checkinStatus: '未簽到' },
      ],
      checkedInRows: [
        {
          id: 2,
          studentId: 'B12345678',
          studentName: '李小華',
          group: 'B',
          checkinStatus: '已簽到',
          excludeFromClassCredit: false,
          checkinTime: '2026-10-05T04:10:00.000Z',
        },
      ],
    });

    const pending = screen.getByText(/待簽到（/).closest('.admin-event-checkin-tab__panel');
    const checkedIn = screen.getByText(/已簽到（/).closest('.admin-event-checkin-tab__panel');
    expect(within(pending).queryByRole('columnheader', { name: '組別' })).not.toBeInTheDocument();
    expect(within(checkedIn).getByRole('columnheader', { name: '組別' })).toBeInTheDocument();
  });

  test('到場不計點要先確認，取消就不會送出', async () => {
    confirm.mockResolvedValue(false);
    const tabProps = renderTab();

    fireEvent.click(screen.getByRole('button', { name: '到場不計點' }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      title: '確認到場不計點？',
      description: '王小明（A12345678）',
      confirmText: '確認到場不計點',
    }));
    await Promise.resolve();
    expect(tabProps.handleCheckin).not.toHaveBeenCalled();
  });
});
