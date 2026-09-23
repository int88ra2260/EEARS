/**
 * 現場簽到掃碼／簽到碼解析（學號條碼或預約編號 R-XXXXXX）
 */

export function formatBookingCode(reservationId) {
  const idNum = Number(reservationId);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    const raw = String(reservationId || '').trim();
    return raw ? `R-${raw}` : '';
  }
  return `R-${String(idNum).padStart(6, '0')}`;
}

/**
 * @param {string} raw
 * @returns {{ kind: 'booking_code', reservationId: number, bookingCode: string }
 *   | { kind: 'query', query: string }}
 */
export function parseCheckinScanPayload(raw) {
  const s = String(raw || '').trim();
  if (!s) return { kind: 'query', query: '' };

  // R-000123 / R000123 / EEARS-R-000123
  const bookingMatch = s.match(/^(?:EEARS[-_])?R[-_]?0*(\d+)$/i);
  if (bookingMatch) {
    const reservationId = Number(bookingMatch[1]);
    if (Number.isFinite(reservationId) && reservationId > 0) {
      return {
        kind: 'booking_code',
        reservationId,
        bookingCode: formatBookingCode(reservationId),
      };
    }
  }

  return { kind: 'query', query: s };
}
