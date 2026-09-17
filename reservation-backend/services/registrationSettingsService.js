'use strict';

const { Settings } = require('../models');

const KEYS = Object.freeze({
  INDIVIDUAL: 'english_test_registration_enabled',
  GROUP: 'english_test_registration_group_enabled',
  LEARNING_PARTNER: 'learning_partner_enabled',
  /** 學生端「檢視與修正」；與個人報名開關分開，方便報名截止後仍開放修正一段時間 */
  EDIT: 'english_test_registration_edit_enabled',
});

/** 允許：(開,開)／(關,開)／(關,關)；禁止只開個人報名而關檢視與修正 */
const INVALID_REGISTRATION_WINDOW_PAIR_MESSAGE =
  '不可只開啟個人報名而關閉「檢視與修正」。允許狀態：兩者皆開、僅檢視與修正、兩者皆關。';

function parseSettingBool(setting, defaultValue) {
  if (!setting) return defaultValue;
  if (setting.valueBool !== null && setting.valueBool !== undefined) {
    return setting.valueBool === true;
  }
  return setting.value === 'true';
}

async function readSettingBool(key, defaultValue) {
  const setting = await Settings.findOne({ where: { key } });
  return parseSettingBool(setting, defaultValue);
}

async function upsertSettingBool(key, enabled) {
  const [setting, created] = await Settings.findOrCreate({
    where: { key },
    defaults: {
      value: enabled.toString(),
      valueBool: enabled,
    },
  });

  if (!created) {
    await setting.update({
      value: enabled.toString(),
      valueBool: enabled,
    });
  }

  return setting;
}

/**
 * @param {boolean} individualEnabled
 * @param {boolean} editEnabled
 */
function assertValidRegistrationWindowPair(individualEnabled, editEnabled) {
  if (individualEnabled && !editEnabled) {
    const err = new Error(INVALID_REGISTRATION_WINDOW_PAIR_MESSAGE);
    err.status = 400;
    err.code = 'INVALID_REGISTRATION_WINDOW_PAIR';
    throw err;
  }
}

async function isIndividualRegistrationEnabled() {
  return readSettingBool(KEYS.INDIVIDUAL, true);
}

/**
 * 團體報名（Learning Partner）開關：優先讀 group key，無則 fallback learning_partner_enabled。
 */
async function isGroupRegistrationEnabled() {
  const groupSetting = await Settings.findOne({ where: { key: KEYS.GROUP } });
  if (groupSetting) {
    return parseSettingBool(groupSetting, true);
  }
  return readSettingBool(KEYS.LEARNING_PARTNER, true);
}

async function isRegistrationEditEnabled() {
  return readSettingBool(KEYS.EDIT, true);
}

async function setIndividualRegistrationEnabled(enabled) {
  if (enabled) {
    const editEnabled = await isRegistrationEditEnabled();
    assertValidRegistrationWindowPair(true, editEnabled);
  }
  await upsertSettingBool(KEYS.INDIVIDUAL, enabled);
  return enabled;
}

/** 同步寫入團體報名與 Learning Partner 兩個 key，避免前後端讀取不一致。 */
async function setGroupRegistrationEnabled(enabled) {
  await Promise.all([
    upsertSettingBool(KEYS.GROUP, enabled),
    upsertSettingBool(KEYS.LEARNING_PARTNER, enabled),
  ]);
  return enabled;
}

async function setRegistrationEditEnabled(enabled) {
  if (!enabled) {
    const individualEnabled = await isIndividualRegistrationEnabled();
    assertValidRegistrationWindowPair(individualEnabled, false);
  }
  await upsertSettingBool(KEYS.EDIT, enabled);
  return enabled;
}

module.exports = {
  KEYS,
  INVALID_REGISTRATION_WINDOW_PAIR_MESSAGE,
  parseSettingBool,
  assertValidRegistrationWindowPair,
  isIndividualRegistrationEnabled,
  isGroupRegistrationEnabled,
  isRegistrationEditEnabled,
  setIndividualRegistrationEnabled,
  setGroupRegistrationEnabled,
  setRegistrationEditEnabled,
};
