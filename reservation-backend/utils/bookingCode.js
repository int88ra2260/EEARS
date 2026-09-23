'use strict';

function formatBookingCode(reservationId) {
  const idNum = Number(reservationId);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    const raw = String(reservationId || '').trim();
    return raw ? `R-${raw}` : '';
  }
  return `R-${String(idNum).padStart(6, '0')}`;
}

module.exports = {
  formatBookingCode,
};
