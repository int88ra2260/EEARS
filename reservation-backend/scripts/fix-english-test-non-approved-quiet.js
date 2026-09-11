/**
 * 安靜修正：examType=NON 但 status 仍為 approved/success → revision
 * 不寄信、不走狀態更新 API。
 *
 * 使用：
 *   node scripts/fix-english-test-non-approved-quiet.js            # dry-run
 *   node scripts/fix-english-test-non-approved-quiet.js --apply    # 真正更新
 *
 * 可選：只處理指定學號（逗號分隔）；未指定則用下方預設名單。
 *   node scripts/fix-english-test-non-approved-quiet.js --apply --students=B152025005,B124020008
 */
require('dotenv').config();
const { Op } = require('sequelize');
const { sequelize, EnglishTestRegistration } = require('../models');

const APPLY = process.argv.includes('--apply');

const DEFAULT_STUDENT_IDS = [
  'B152025005',
  'B124020008',
  'B152025012',
  'B153015011',
  'B153015001',
];

function parseStudentIdsFromArgv() {
  const flag = process.argv.find((a) => a.startsWith('--students='));
  if (!flag) return DEFAULT_STUDENT_IDS;
  return flag
    .slice('--students='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function run() {
  const studentIds = parseStudentIdsFromArgv();
  const mode = APPLY ? 'APPLY（真正更新，不寄信）' : 'DRY_RUN（僅預覽）';
  console.log(`🛠️  修正「不報考但仍為已通過／成功」：${mode}`);
  console.log(`學號（${studentIds.length}）：${studentIds.join(', ')}\n`);

  const rows = await EnglishTestRegistration.findAll({
    where: {
      studentId: { [Op.in]: studentIds },
      examType: 'NON',
      status: { [Op.in]: ['approved', 'success'] },
    },
    order: [['studentId', 'ASC'], ['id', 'ASC']],
  });

  if (rows.length === 0) {
    console.log('沒有符合條件的資料（可能已修正，或 examType／status 不符）。');
    // 順便列出這五位目前狀態，方便核對
    const all = await EnglishTestRegistration.findAll({
      where: { studentId: { [Op.in]: studentIds } },
      attributes: ['id', 'studentId', 'name', 'semester', 'examType', 'status', 'updatedAt'],
      order: [['studentId', 'ASC'], ['id', 'ASC']],
    });
    console.log('\n指定學號目前所有報名列：');
    for (const r of all) {
      console.log(
        `  id=${r.id} ${r.studentId} ${r.name} semester=${r.semester} examType=${r.examType} status=${r.status}`
      );
    }
    return;
  }

  console.log(`找到 ${rows.length} 筆待修正：\n`);
  for (const r of rows) {
    console.log(
      `  id=${r.id} ${r.studentId} ${r.name} semester=${r.semester} examType=${r.examType} status=${r.status} → revision`
    );
  }

  if (!APPLY) {
    console.log('\n（dry-run）未寫入。確認後加上 --apply 執行。');
    return;
  }

  const ids = rows.map((r) => r.id);
  const [affected] = await EnglishTestRegistration.update(
    { status: 'revision' },
    { where: { id: { [Op.in]: ids } } }
  );

  console.log(`\n✅ 已更新 ${affected} 筆 status → revision（未寄信）。`);
}

run()
  .catch((err) => {
    console.error('❌ 執行失敗：', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_) {
      /* ignore */
    }
  });
