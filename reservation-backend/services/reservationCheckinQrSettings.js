'use strict';

const { Settings } = require('../models');

const RESERVATION_SUCCESS_CHECKIN_QR_KEY = 'reservation_success_email_include_checkin_qr';

function parseSettingBool(setting, defaultValue) {
  if (!setting) return defaultValue;
  if (setting.valueBool !== null && setting.valueBool !== undefined) {
    return setting.valueBool === true;
  }
  return setting.value === 'true';
}

/** 預約成功信是否附上現場簽到 QR。未設定時關閉。 */
async function isReservationSuccessCheckinQrEnabled() {
  const setting = await Settings.findOne({ where: { key: RESERVATION_SUCCESS_CHECKIN_QR_KEY } });
  return parseSettingBool(setting, false);
}

async function setReservationSuccessCheckinQrEnabled(enabled) {
  const next = !!enabled;
  const [setting, created] = await Settings.findOrCreate({
    where: { key: RESERVATION_SUCCESS_CHECKIN_QR_KEY },
    defaults: {
      value: next.toString(),
      valueBool: next,
    },
  });
  if (!created) {
    await setting.update({
      value: next.toString(),
      valueBool: next,
    });
  }
  return next;
}

module.exports = {
  RESERVATION_SUCCESS_CHECKIN_QR_KEY,
  isReservationSuccessCheckinQrEnabled,
  setReservationSuccessCheckinQrEnabled,
};
