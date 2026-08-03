'use strict';

const { Op } = require('sequelize');
const { sequelize, EtExamAttempt, EtExamAttemptSkillScore } = require('../models');

async function confirmClear() {
  if (process.env.SKIP_CONFIRM === 'true') return true;

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => {
    rl.question(
      '⚠️  即將刪除所有「英語學習歷程中心考試匯入」資料，請輸入 "YES" 確認：',
      (value) => resolve(String(value || '').trim().toUpperCase())
    );
  });
  rl.close();
  return answer === 'YES';
}

async function clearLearningJourneyExamImportData() {
  console.log('🚀 準備清除英語學習歷程中心考試匯入資料...');

  const confirmed = await confirmClear();
  if (!confirmed) {
    console.log('❌ 已取消操作');
    return;
  }

  await sequelize.authenticate();
  console.log('✅ 資料庫連線成功');

  const transaction = await sequelize.transaction();
  try {
    const attempts = await EtExamAttempt.findAll({
      attributes: ['id'],
      where: {
        [Op.or]: [
          { sourceType: 'excel_import' },
          { importBatchId: { [Op.like]: 'v3-exam:%' } },
          { sourceBatchId: { [Op.like]: 'v3-exam:%' } }
        ]
      },
      transaction
    });

    const attemptIds = attempts.map((row) => row.id);
    if (attemptIds.length === 0) {
      await transaction.commit();
      console.log('ℹ️  找不到可清除的匯入資料');
      return;
    }

    const skillScoreCount = await EtExamAttemptSkillScore.count({
      where: { attemptId: { [Op.in]: attemptIds } },
      transaction
    });

    await EtExamAttemptSkillScore.destroy({
      where: { attemptId: { [Op.in]: attemptIds } },
      transaction
    });

    const attemptCount = await EtExamAttempt.destroy({
      where: { id: { [Op.in]: attemptIds } },
      transaction
    });

    await transaction.commit();
    console.log('✅ 清除完成');
    console.log(`- 已刪除考試嘗試: ${attemptCount} 筆`);
    console.log(`- 已刪除技能分數: ${skillScoreCount} 筆`);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ 清除失敗，已回滾:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  clearLearningJourneyExamImportData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  clearLearningJourneyExamImportData
};
