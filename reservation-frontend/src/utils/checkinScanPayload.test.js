import { formatBookingCode, parseCheckinScanPayload } from './checkinScanPayload';

describe('formatBookingCode', () => {
  it('pads numeric ids', () => {
    expect(formatBookingCode(123)).toBe('R-000123');
  });
});

describe('parseCheckinScanPayload', () => {
  it('parses booking codes from scanners', () => {
    expect(parseCheckinScanPayload('R-000360')).toEqual({
      kind: 'booking_code',
      reservationId: 360,
      bookingCode: 'R-000360',
    });
    expect(parseCheckinScanPayload('EEARS-R-42').reservationId).toBe(42);
    expect(parseCheckinScanPayload('r000007').reservationId).toBe(7);
  });

  it('falls back to free-text query for student ids', () => {
    expect(parseCheckinScanPayload('F1234567')).toEqual({
      kind: 'query',
      query: 'F1234567',
    });
  });
});
