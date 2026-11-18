import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import BookingSuccessView from './BookingSuccessView';

vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../events/EnglishTableTopicPanel', () => ({
  default: () => <div>題目面板</div>,
}));

function renderSuccess(eventType) {
  render(
    <MemoryRouter>
      <BookingSuccessView
        event={{
          name: 'English Table',
          eventType,
          date: '2026-10-05',
          startTime: '18:00',
          endTime: '19:00',
        }}
        studentEmail="student@example.com"
        reservationId={12}
        bookingCode="R-000012"
        successAt="2026-11-18T10:00:00.000Z"
      />
    </MemoryRouter>,
  );
}

describe('BookingSuccessView English Table practice guide', () => {
  test('explains the warm-up, what the leader sees, and where the review lives', () => {
    renderSuccess('english_table');
    expect(screen.getByRole('heading', { name: '下一步：先練今晚的題目' })).toBeInTheDocument();
    expect(screen.getByText(/會前練習/)).toBeInTheDocument();
    expect(screen.getByText(/不是分數/)).toBeInTheDocument();
    expect(screen.getByText(/活動後複習/)).toBeInTheDocument();
    expect(screen.getByText('題目面板')).toBeInTheDocument();
  });

  test('keeps the guide off other activity types', () => {
    renderSuccess('english_club');
    expect(screen.queryByRole('heading', { name: '下一步：先練今晚的題目' })).not.toBeInTheDocument();
  });
});
