'use strict';

/**
 * 一次性：把缺漏的步驟1/2等系統階段補進 DB（不需重啟舊 Node 行程也能生效）。
 * Usage: node scripts/fixEnglishTestFormSchemaSystemParts.js
 */
require('dotenv').config();

const {
  getPublishedSchema,
  savePublishedSchema,
  mergeMissingSystemParts,
  schemaNeedsSystemMerge,
  parseSchemaJson,
  buildDefaultEnglishTestFormSchema,
} = require('../services/englishTestFormSchemaService');
const { EnglishTestFormSchema, sequelize } = require('../models');

async function main() {
  await sequelize.authenticate();

  const row = await EnglishTestFormSchema.findOne({
    where: { status: 'published' },
    order: [['version', 'DESC'], ['id', 'DESC']],
  });

  if (!row) {
    const created = await EnglishTestFormSchema.create({
      version: 1,
      status: 'published',
      schemaJson: buildDefaultEnglishTestFormSchema(),
      changeSummary: '自動建立預設報名表單（fix script）',
      updatedBy: null,
    });
    console.log('created default schema v', created.version);
    return;
  }

  const raw = parseSchemaJson(row.schemaJson);
  console.log('before sections:', (raw.sections || []).map((s) => `${s.order}:${s.id}`).join(' | '));
  console.log('needsMerge:', schemaNeedsSystemMerge(raw));

  const merged = mergeMissingSystemParts(raw);
  console.log('after sections:', (merged.sections || []).map((s) => `${s.order}:${s.id}`).join(' | '));

  if (!schemaNeedsSystemMerge(raw) && JSON.stringify(raw.sections) === JSON.stringify(merged.sections)) {
    console.log('already up to date');
    return;
  }

  const saved = await savePublishedSchema(merged, {
    userId: null,
    changeSummary: '維運腳本：補齊步驟1/2並校正階段順序',
  });
  console.log('saved version', saved.version);
  console.log(
    'saved sections:',
    (saved.schema.sections || []).map((s) => `${s.order}:${s.id}`).join(' | ')
  );
}

main()
  .then(() => sequelize.close())
  .catch(async (err) => {
    console.error(err);
    try {
      await sequelize.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
