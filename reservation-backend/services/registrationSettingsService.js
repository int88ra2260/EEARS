'use strict';

const { Settings } = require('../models');

const KEYS = Object.freeze({
  INDIVIDUAL: 'english_test_registration_enabled',
  GROUP: 'english_test_registration_group_enabled',
  LEARNING_PARTNER: 'learning_partner_enabled',
});

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

async function setIndividualRegistrationEnabled(enabled) {
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

module.exports = {
  KEYS,
  parseSettingBool,
  isIndividualRegistrationEnabled,
  isGroupRegistrationEnabled,
  setIndividualRegistrationEnabled,
  setGroupRegistrationEnabled,
};
