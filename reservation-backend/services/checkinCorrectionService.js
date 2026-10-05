'use strict';

const { sequelize } = require('../models');
const {
  revokePassportGrantForReservation,
} = require('./englishLearningPassport/eventPassportPointsService');

const CHECKIN_CORRECTION_MODES = Object.freeze({
  CLASS_CREDIT: 'class_credit',
  ATTENDANCE_ONLY: 'attendance_only',
  UNDO: 'undo',
});

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function snapshot(reservation) {
  return {
    checkinStatus: reservation.checkinStatus || null,
    checkinTime: reservation.checkinTime || null,
    countsTowardPassport: !!reservation.countsTowardPassport,
    excludeFromClassCredit: !!reservation.excludeFromClassCredit,
    passportPointsStatus: reservation.passportPointsStatus || null,
    passportSubmissionId: reservation.passportSubmissionId || null,
  };
}

/**
 * 已簽到紀錄的補救：改計課堂加分、改為到場不計點，或取消簽到回到待簽到。
 * @param {object} params
 * @param {import('sequelize').Model} params.reservation
 * @param {'class_credit'|'attendance_only'|'undo'} params.mode
 */
async function correctEventCheckin({
  reservation,
  mode,
  actorUserId = null,
  req = null,
} = {}) {
  if (!reservation) {
    throw httpError('找不到對應的預約記錄', 404);
  }
  if (!Object.values(CHECKIN_CORRECTION_MODES).includes(mode)) {
    throw httpError('不支援的更正方式', 400);
  }
  if (reservation.checkinStatus !== '已簽到') {
    throw httpError('只有已簽到的預約可以更正', 400);
  }
  if (mode === CHECKIN_CORRECTION_MODES.CLASS_CREDIT && !reservation.excludeFromClassCredit) {
    throw httpError('這筆已經計入課堂加分', 400);
  }
  if (mode === CHECKIN_CORRECTION_MODES.ATTENDANCE_ONLY && reservation.excludeFromClassCredit) {
    throw httpError('這筆已經是到場不計點', 400);
  }

  const before = snapshot(reservation);

  return sequelize.transaction(async (transaction) => {
    if (
      reservation.passportPointsStatus === 'granted'
      || reservation.countsTowardPassport
    ) {
      const reason = mode === CHECKIN_CORRECTION_MODES.UNDO
        ? '取消簽到，收回本場護照點數'
        : mode === CHECKIN_CORRECTION_MODES.ATTENDANCE_ONLY
          ? '簽到更正為到場不計點，收回本場護照點數'
          : '簽到改為課堂加分，收回本場護照點數';
      await revokePassportGrantForReservation({
        reservation,
        reason,
        actorUserId,
        req,
        transaction,
      });
    }

    const next = mode === CHECKIN_CORRECTION_MODES.UNDO
      ? {
        checkinStatus: '未簽到',
        checkinTime: null,
        countsTowardPassport: false,
        excludeFromClassCredit: false,
        passportPointsStatus: null,
        passportSubmissionId: null,
      }
      : {
        checkinStatus: '已簽到',
        countsTowardPassport: false,
        excludeFromClassCredit: mode === CHECKIN_CORRECTION_MODES.ATTENDANCE_ONLY,
        passportPointsStatus: null,
        passportSubmissionId: null,
      };

    await reservation.update(next, { transaction });

    const message = mode === CHECKIN_CORRECTION_MODES.UNDO
      ? '已取消簽到，可重新選擇'
      : mode === CHECKIN_CORRECTION_MODES.ATTENDANCE_ONLY
        ? '已改為到場不計點'
        : '已改為計入課堂加分';

    return {
      message,
      before,
      checkinStatus: reservation.checkinStatus,
      checkinTime: reservation.checkinTime || null,
      countsTowardPassport: !!reservation.countsTowardPassport,
      excludeFromClassCredit: !!reservation.excludeFromClassCredit,
      passportPointsStatus: reservation.passportPointsStatus || null,
    };
  });
}

module.exports = {
  CHECKIN_CORRECTION_MODES,
  correctEventCheckin,
};
