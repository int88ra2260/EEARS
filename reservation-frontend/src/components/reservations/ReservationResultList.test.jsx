import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import ReservationResultList from './ReservationResultList';
import { getCurrentSemester } from '../../utils/semesterUtils';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key) => key }),
}));

vi.mock('../events/EnglishTableTopicPanel', () => ({
  default: () => null,
}));

function renderList(records) {
  return render(
    <MemoryRouter>
      <ReservationResultList
        records={records}
        hasSearched
        signedIn
        onConfirmCancel={() => {}}
      />
    </MemoryRouter>,
  );
}

describe('ReservationResultList semesters', () => {
  test('預設看本學期，舊學期的已結束預約要切換後才出現', async () => {
    const current = getCurrentSemester();
    renderList([
      {
        id: 1432,
        reservationId: 1432,
        bookingCode: 'R-001432',
        eventName: 'English Table',
        eventType: 'english_table',
        date: '2025-05-22',
        startTime: '12:10',
        endTime: '12:40',
        location: '英語中心',
      },
    ]);

    const currentTab = screen.getByRole('tab', { name: new RegExp(current) });
    expect(currentTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(`${current} 目前沒有預約`)).toBeInTheDocument();
    expect(screen.queryByText('R-001432')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /113-2/ }));
    expect(await screen.findByText(/R-001432/)).toBeInTheDocument();
    expect(screen.getAllByText('已結束').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '出示簽到 QR' })).not.toBeInTheDocument();
  });
});
