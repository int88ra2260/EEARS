import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import ReservationResultCard from './ReservationResultCard';

vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key) => key }),
}));

vi.mock('../events/EnglishTableTopicPanel', () => ({
  default: () => null,
}));

const record = {
  id: 10957,
  reservationId: 10957,
  bookingCode: 'R-010957',
  eventName: 'English Table',
  eventType: 'english_table',
  date: '2026-12-01',
  startTime: '16:10',
  endTime: '17:00',
  location: '英語中心',
  timestamp: '2026-11-16T08:00:00',
};

describe('ReservationResultCard check-in QR', () => {
  test('從我的預約叫出與簽到碼相同的 QR', async () => {
    const QRCode = (await import('qrcode')).default;
    render(
      <ReservationResultCard
        record={record}
        cancelingReservationId={null}
        onConfirmCancel={() => {}}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '出示簽到 QR' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('English Table');
    expect(dialog).toHaveTextContent('2026-12-01');
    expect(dialog).toHaveTextContent('16:10');
    expect(dialog).toHaveTextContent('R-010957');
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      'R-010957',
      expect.objectContaining({ errorCorrectionLevel: 'M' }),
    );

    fireEvent.click(screen.getByRole('button', { name: '關閉' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  test('已結束的活動不提供簽到 QR', () => {
    render(
      <ReservationResultCard
        record={{ ...record, date: '2025-05-22', startTime: '12:10', endTime: '12:40' }}
        cancelingReservationId={null}
        onConfirmCancel={() => {}}
      />,
    );

    expect(screen.getByText('已結束')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '出示簽到 QR' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'page.reservationCannotCancel' })).not.toBeInTheDocument();
  });
});
