'use strict';

/**
 * 將報名 examType 與已發布表單 schema 統一為代碼：LRSW / LR / SW / NON
 *
 * Usage:
 *   node scripts/normalizeEnglishTestExamTypes.js           # dry-run
 *   node scripts/normalizeEnglishTestExamTypes.js --apply   # 寫入
 */
require('dotenv').config();

const { QueryTypes } = require('sequelize');
const { sequelize, EnglishTestRegistration } = require('../models');
const {
  normalizeExamTypeCode,
  normalizeExamTypeOptions,
  CANONICAL_EXAM_TYPES,
} = require('../utils/englishTestExamType');
const {
  getPublishedSchema,
  savePublishedSchema,
  validateAndNormalizeSchema,
  buildDefaultEnglishTestFormSchema,
} = require('../services/englishTestFormSchemaService');

const APPLY = process.argv.includes('--apply');

async function normalizeRegistrations() {
  const rows = await sequelize.query(
    `SELECT id, examType
     FROM english_test_registrations
     WHERE examType IS NOT NULL
       AND TRIM(examType) != ''
       AND examType NOT IN ('LRSW', 'LR', 'SW', 'NON')`,
    { type: QueryTypes.SELECT }
  );

  const plan = [];
  const unmapped = [];
  for (const row of rows) {
    const code = normalizeExamTypeCode(row.examType);
    if (!code) {
      unmapped.push({ id: row.id, examType: row.examType });
      continue;
    }
    plan.push({ id: row.id, from: row.examType, to: code });
  }

  console.log(`[registrations] non-canonical rows: ${rows.length}`);
  console.log(`[registrations] will normalize: ${plan.length}`);
  if (unmapped.length) {
    console.log(`[registrations] unmapped (left as-is): ${unmapped.length}`);
    console.log(unmapped.slice(0, 20));
  }

  const byPair = {};
  for (const p of plan) {
    const key = `${p.from} -> ${p.to}`;
    byPair[key] = (byPair[key] || 0) + 1;
  }
  console.log('[registrations] mapping counts:', byPair);

  if (!APPLY || plan.length === 0) return { updated: 0, planCount: plan.length };

  let updated = 0;
  for (const code of CANONICAL_EXAM_TYPES) {
    const ids = plan.filter((p) => p.to === code).map((p) => p.id);
    if (ids.length === 0) continue;
    // batch by from-value for clarity
    const fromValues = [...new Set(plan.filter((p) => p.to === code).map((p) => p.from))];
    for (const from of fromValues) {
      const [count] = await EnglishTestRegistration.update(
        { examType: code },
        { where: { examType: from } }
      );
      updated += count;
      console.log(`  updated examType "${from}" -> "${code}": ${count}`);
    }
  }
  return { updated, planCount: plan.length };
}

async function normalizePublishedSchema() {
  const published = await getPublishedSchema({ allowPersistMerge: false });
  const base = published?.schema || buildDefaultEnglishTestFormSchema();
  const defaults = buildDefaultEnglishTestFormSchema();
  const defaultExam = (defaults.questions || []).find((q) => q.fieldKey === 'examType');

  let changed = false;
  const questions = (base.questions || []).map((q) => {
    if (q.fieldKey !== 'examType') return q;
    const nextOptions = normalizeExamTypeOptions(q.options || [], defaultExam?.options || []);
    const before = JSON.stringify(q.options || []);
    const after = JSON.stringify(nextOptions);
    if (before !== after) changed = true;
    return { ...q, options: nextOptions };
  });

  console.log(`[schema] published id=${published?.id} version=${published?.version} examTypeChanged=${changed}`);
  console.log('[schema] examType options:', (questions.find((q) => q.fieldKey === 'examType') || {}).options);

  if (!APPLY) return { changed: false, skipped: true };
  if (!changed) {
    // 仍走一次 validate，確保 normalizeQuestion 路徑一致
    console.log('[schema] already canonical; no new publish');
    return { changed: false, skipped: false };
  }

  const normalized = validateAndNormalizeSchema({ ...base, questions }, base);
  const saved = await savePublishedSchema(normalized, {
    changeSummary: '正規化報考項目選項 value 為 LRSW/LR/SW/NON（修正中文 label 被寫成 value）',
    userId: null,
  });
  console.log(`[schema] published v${saved.version}`);
  return { changed: true, version: saved.version };
}

async function printSummary() {
  const rows = await sequelize.query(
    `SELECT examType, COUNT(*) AS c
     FROM english_test_registrations
     GROUP BY examType
     ORDER BY c DESC`,
    { type: QueryTypes.SELECT }
  );
  console.log('[summary] examType distribution:', rows);
}

async function main() {
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: dry-run (pass --apply to write)');
  await sequelize.authenticate();

  const reg = await normalizeRegistrations();
  const schema = await normalizePublishedSchema();
  await printSummary();

  console.log('done', { registrations: reg, schema });
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
