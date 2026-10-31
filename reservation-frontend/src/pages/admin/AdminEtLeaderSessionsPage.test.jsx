import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { P } from '../../constants/permissions';
import AdminEtLeaderSessionsPage from './AdminEtLeaderSessionsPage';

const api = vi.hoisted(() => ({
  fetchMyLeaderSessions: vi.fn(),
  fetchMyLeaderPayroll: vi.fn(),
  fetchLeaderMarkingAttention: vi.fn(),
  fetchEventPracticeBriefs: vi.fn(),
  fetchEventTaskMarks: vi.fn(),
  checkInLeaderAttendance: vi.fn(),
}));

vi.mock('../../services/etGroupingApi', () => api);

function session(index) {
  return {
    eventId: index,
    name: `英語桌 ${index}`,
    date: '2026-12-01',
    startTime: '18:00',
    endTime: '19:00',
    location: '文學院',
    groupLabels: ['A'],
    derivedStatus: 'upcoming',
    attendance: null,
    payGate: { status: 'unchecked' },
  };
}

function renderPage() {
  const accessProfile = {
    role: 'leader',
    permissionSet: new Set([P.CAN_MARK_ET_SESSION_TASKS]),
  };
  return render(
    <MemoryRouter initialEntries={['/admin/et-grouping/my-sessions']}>
      <Routes>
        <Route path="/admin" element={<Outlet context={{ token: 'leader-token', accessProfile }} />}>
          <Route path="et-grouping/my-sessions" element={<AdminEtLeaderSessionsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminEtLeaderSessionsPage', () => {
  beforeEach(() => {
    api.fetchMyLeaderSessions.mockResolvedValue(Array.from({ length: 7 }, (_, i) => session(i + 1)));
    api.fetchMyLeaderPayroll.mockResolvedValue(null);
    api.fetchLeaderMarkingAttention.mockResolvedValue({ count: 0 });
    api.fetchEventTaskMarks.mockResolvedValue({ students: [] });
    api.fetchEventPracticeBriefs.mockResolvedValue({ briefs: [] });
  });

  test('splits the instructions and pages sessions six at a time', async () => {
    renderPage();

    expect(await screen.findByText('活動當天先出席簽到，離場前把必填任務勾完。當天勾選最準。')).toBeInTheDocument();
    expect(screen.getByText('勾是或勾否都算完成，空白不算。')).toBeInTheDocument();
    expect(screen.getAllByText('英語桌 1')).toHaveLength(2);
    expect(screen.queryByText('英語桌 7')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '帶班場次分頁' })).toHaveTextContent('第 1–6 筆，共 7 筆');
    expect(screen.getAllByText('文學院').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '下一頁' }));

    await waitFor(() => {
      expect(screen.getAllByText('英語桌 7')).toHaveLength(2);
    });
    expect(screen.queryByText('英語桌 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一頁' })).toBeEnabled();
  });

  test('lists who arrived and who practiced, separate from task marks', async () => {
    api.fetchMyLeaderSessions.mockResolvedValue([session(1)]);
    api.fetchEventTaskMarks.mockResolvedValue({
      students: [
        { reservationId: 1, studentId: 'B1', studentName: '林小明', groupLabel: 'A', checkinStatus: '未簽到' },
        { reservationId: 2, studentId: 'B2', studentName: '王小華', groupLabel: 'A', checkinStatus: '已簽到' },
      ],
    });
    api.fetchEventPracticeBriefs.mockResolvedValue({
      briefs: [{ studentId: 'B2', studentName: '王小華' }],
    });
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: '這組名單' }))[0]);
    expect(await screen.findByText('已到')).toBeInTheDocument();
    expect(screen.getByText('未到')).toBeInTheDocument();
    expect(screen.getByText('有會前練習')).toBeInTheDocument();
    expect(screen.getByText('尚未練習')).toBeInTheDocument();
    const names = screen.getAllByText(/林小明|王小華/).map((node) => node.textContent);
    expect(names.indexOf('王小華')).toBeLessThan(names.indexOf('林小明'));
  });

  test('can look at last month of pay', async () => {
    renderPage();
    await screen.findByRole('button', { name: '上個月' });
    const current = api.fetchMyLeaderPayroll.mock.calls.at(-1)[1];
    fireEvent.click(screen.getByRole('button', { name: '上個月' }));
    await waitFor(() => {
      const months = api.fetchMyLeaderPayroll.mock.calls.map((call) => call[1]);
      expect(months.some((month) => month !== current)).toBe(true);
    });
  });

  test('shows short check-in instructions', async () => {
    renderPage();
    const buttons = await screen.findAllByRole('button', { name: '出席簽到' });
    fireEvent.click(buttons[0]);
    expect(screen.getByText('用手機相機掃描現場 QR，或向行政取得簽到碼後貼上。')).toBeInTheDocument();
    expect(screen.getByLabelText('現場簽到碼')).toBeInTheDocument();
  });
});
