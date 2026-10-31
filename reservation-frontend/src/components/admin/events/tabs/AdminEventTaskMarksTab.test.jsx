import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AdminEventTaskMarksTab from './AdminEventTaskMarksTab';

const api = vi.hoisted(() => ({
  fetchEventTaskMarks: vi.fn(),
  saveEventTaskMarks: vi.fn(),
}));

vi.mock('../../../../services/etGroupingApi', () => api);

function student(index) {
  return {
    reservationId: index,
    studentId: `B${index}`,
    studentName: `學生${index}`,
    groupLabel: 'A',
    canMark: true,
    checkinStatus: '已簽到',
    tasks: [{ taskItemId: 1, label: '開口', isRequired: true, completed: false }],
  };
}

describe('AdminEventTaskMarksTab', () => {
  beforeEach(() => {
    api.fetchEventTaskMarks.mockResolvedValue({
      markingOpen: true,
      scope: 'leader',
      leaderGroups: ['A'],
      students: Array.from({ length: 7 }, (_, i) => student(i + 1)),
    });
  });

  test('uses a short checklist and pages students', async () => {
    render(
      <AdminEventTaskMarksTab
        tabProps={{
          token: 'leader-token',
          eventId: 9,
          canMark: true,
          eventType: 'english_table',
        }}
      />,
    );

    expect(await screen.findByText('只有已簽到的學生可以勾。每個人用同一套任務。')).toBeInTheDocument();
    expect(screen.getAllByText('學生1').length).toBeGreaterThan(0);
    expect(screen.queryByText('學生7')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一頁' }));

    await waitFor(() => {
      expect(screen.getAllByText('學生7').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('學生1')).not.toBeInTheDocument();
  });
});
