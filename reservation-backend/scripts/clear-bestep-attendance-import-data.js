'use strict';

const { sequelize, BestepAttendance } = require('../models');

async function confirmClear() {
  if (process.env.SKIP_CONFIRM === 'true') return true;

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => {
    rl.question(
      '⚠️  即將刪除所有 BESTEP 出席匯入資料，請輸入 "YES" 確認：',
      (value) => resolve(String(value || '').trim().toUpperCase())
    );
  });
  rl.close();
  return answer === 'YES';
}

async function clearBestepAttendanceImportData() {
  console.log('🚀 準備清除 BESTEP 出席匯入資料...');

  const confirmed = await confirmClear();
  if (!confirmed) {
    console.log('❌ 已取消操作');
    return;
  }

  await sequelize.authenticate();
  console.log('✅ 資料庫連線成功');

  const transaction = await sequelize.transaction();
  try {
    const total = await BestepAttendance.count({ transaction });
    if (total === 0) {
      await transaction.commit();
      console.log('ℹ️  目前無 BESTEP 出席資料可清除');
      return;
    }

    const deleted = await BestepAttendance.destroy({
      where: {},
      transaction
    });

    await transaction.commit();
    console.log('✅ 清除完成');
    console.log(`- 已刪除 BESTEP 出席資料: ${deleted} 筆`);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ 清除失敗，已回滾:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  clearBestepAttendanceImportData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  clearBestepAttendanceImportData
};
