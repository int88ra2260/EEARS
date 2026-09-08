'use strict';

/**
 * 更新已發布表單：成績測驗類別（舊制／新制 TOEFL iBT、TOEFL ITP）
 * Usage: node scripts/patchEnglishTestScoreExamTypes.js
 */
require('dotenv').config();

const {
  getPublishedSchema,
  savePublishedSchema,
  validateAndNormalizeSchema,
  buildDefaultEnglishTestFormSchema,
} = require('../services/englishTestFormSchemaService');
const { sequelize } = require('../models');

async function main() {
  await sequelize.authenticate();
  const published = await getPublishedSchema();
  const base = published?.schema || buildDefaultEnglishTestFormSchema();
  const defaults = buildDefaultEnglishTestFormSchema();
  const defaultListening = (defaults.questions || []).find((q) => q.fieldKey === 'listeningScore');
  if (!defaultListening?.options?.length) {
    throw new Error('default listeningScore options missing');
  }

  const questions = (base.questions || []).map((q) => {
    if (q.fieldKey !== 'listeningScore') return q;
    return { ...q, options: defaultListening.options };
  });

  const normalized = validateAndNormalizeSchema({ ...base, questions }, base);
  const saved = await savePublishedSchema(normalized, {
    changeSummary: '成績測驗類別：新增「其他」；TOEFL ITP 僅聽力／閱讀（前端依技能過濾）',
    updatedBy: null,
  });
  console.log(`patched listeningScore options, published v${saved.version}`);
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
