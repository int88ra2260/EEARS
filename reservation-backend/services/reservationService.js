'use strict';

const dayjs = require('dayjs');
const { Reservation, Event } = require('../models');
const { getCancellationDeadline } = require('../utils/reservationTime');
const eventTypeService = require('./eventTypeService');

async function cancelReservationPublic({
  reservationId,
  studentId,
  studentName,
  email,
  verificationCode,
}) {
  const reservation = await Reservation.findByPk(reservationId, { include: [Event] });
  if (!reservation || !reservation.Event) {
    return { cancelled: false, reservation: null, reason: 'not_found' };
  }

  const idMatch = String(reservation.studentId || '').trim() === String(studentId || '').trim();
  const nameMatch = String(reservation.studentName || '').trim() === String(studentName || '').trim();
  const emailMatch = String(reservation.studentEmail || '').trim().toLowerCase() === String(email || '').trim().toLowerCase();
  if (!idMatch || !nameMatch || !emailMatch) {
    return { cancelled: false, reservation, reason: 'identity_mismatch' };
  }

  const typeConfig = eventTypeService.resolveTypeConfigSync(reservation.Event.eventType);
  const now = dayjs();
  const { deadline: cancellationDeadline } = getCancellationDeadline(reservation.Event, typeConfig);
  if (now.isAfter(cancellationDeadline)) {
    return { cancelled: false, reservation, reason: 'time_window_closed', cutoffHours: typeConfig.cutoffHours };
  }

  const code = String(verificationCode || '').trim();
  if (!reservation.cancellationCode || !code || reservation.cancellationCode !== code) {
    return { cancelled: false, reservation, reason: 'invalid_code' };
  }

  await reservation.destroy();
  return { cancelled: true, reservation, reason: null };
}

async function cancelReservationByAdmin({ reservationId, verificationCode }) {
  const reservation = await Reservation.findByPk(reservationId, { include: [Event] });
  if (!reservation) {
    return { cancelled: false, reservation: null, reason: 'not_found' };
  }

  const code = String(verificationCode || '').trim();
  if (!reservation.cancellationCode) {
    return { cancelled: false, reservation, reason: 'missing_reservation_code' };
  }
  if (!code || reservation.cancellationCode !== code) {
    return { cancelled: false, reservation, reason: 'invalid_code' };
  }

  await reservation.destroy();
  return { cancelled: true, reservation, reason: null };
}

module.exports = {
  cancelReservationPublic,
  cancelReservationByAdmin,
};
