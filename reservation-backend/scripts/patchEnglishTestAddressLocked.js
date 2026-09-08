'use strict';

/**
 * 將已發布報名表單的通訊地址題目設為預設值 + 學生不可修改。
 * Usage: node scripts/patchEnglishTestAddressLocked.js
 */
require('dotenv').config();

const {
  getPublishedSchema,
  savePublishedSchema,
  validateAndNormalizeSchema,
  buildDefaultEnglishTestFormSchema,
} = require('../services/englishTestFormSchemaService');
const { ENGLISH_TEST_DEFAULT_ADDRESS } = require('../data/englishTestDefaultAddress');
const { sequelize } = require('../models');

const ADDRESS_KEYS = ['postalCode', 'city', 'district', 'address'];

const HELP =
  '系統預設為校本部全英語卓越教學中心（學生端預設不可修改；可於表單設計開放）';

async function main() {
  await sequelize.authenticate();

  const published = await getPublishedSchema();
  const base = published?.schema || buildDefaultEnglishTestFormSchema();
  const defaults = buildDefaultEnglishTestFormSchema();
  const defaultByKey = Object.fromEntries(
    (defaults.questions || [])
      .filter((q) => ADDRESS_KEYS.includes(q.fieldKey))
      .map((q) => [q.fieldKey, q])
  );

  let changed = 0;
  const questions = (base.questions || []).map((q) => {
    if (!ADDRESS_KEYS.includes(q.fieldKey)) return q;
    const def = defaultByKey[q.fieldKey] || {};
    const next = {
      ...q,
      defaultValue:
        q.defaultValue && String(q.defaultValue).trim()
          ? String(q.defaultValue)
          : (def.defaultValue || ENGLISH_TEST_DEFAULT_ADDRESS[q.fieldKey] || ''),
      studentEditable: false,
      helpText: HELP,
    };
    changed += 1;
    return next;
  });

  // 若舊 schema 缺任一地址題，從預設補上
  const existing = new Set(questions.map((q) => q.fieldKey));
  for (const key of ADDRESS_KEYS) {
    if (!existing.has(key) && defaultByKey[key]) {
      questions.push({ ...defaultByKey[key], studentEditable: false, helpText: HELP });
      changed += 1;
    }
  }

  const normalized = validateAndNormalizeSchema({ ...base, questions }, base);
  const saved = await savePublishedSchema(normalized, {
    changeSummary: '通訊地址：套用預設值並鎖定學生端不可修改（studentEditable=false）',
    updatedBy: null,
  });

  console.log(`patched address fields (${changed}), published v${saved.version}`);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sequelize.close();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
