'use strict';

const dayjs = require('dayjs');
const { Reservation, Event } = require('../models');
const { getCancellationDeadline } = require('../utils/reservationTime');
const eventTypeService = require('./eventTypeService');

async function cancelReservationPublic({
  reservationId,
  studentId,
}) {
  const reservation = await Reservation.findByPk(reservationId, { include: [Event] });
  if (!reservation || !reservation.Event) {
    return { cancelled: false, reservation: null, reason: 'not_found' };
  }

  const idMatch = String(reservation.studentId || '').trim() === String(studentId || '').trim();
  if (!idMatch) {
    return { cancelled: false, reservation, reason: 'identity_mismatch' };
  }

  const typeConfig = eventTypeService.resolveTypeConfigSync(reservation.Event.eventType);
  const now = dayjs();
  const { deadline: cancellationDeadline } = getCancellationDeadline(reservation.Event, typeConfig);
  if (now.isAfter(cancellationDeadline)) {
    return { cancelled: false, reservation, reason: 'time_window_closed', cutoffHours: typeConfig.cutoffHours };
  }

  await reservation.destroy();
  return { cancelled: true, reservation, reason: null };
}

async function cancelReservationByAdmin({ reservationId }) {
  const reservation = await Reservation.findByPk(reservationId, { include: [Event] });
  if (!reservation) {
    return { cancelled: false, reservation: null, reason: 'not_found' };
  }

  await reservation.destroy();
  return { cancelled: true, reservation, reason: null };
}

module.exports = {
  cancelReservationPublic,
  cancelReservationByAdmin,
};
