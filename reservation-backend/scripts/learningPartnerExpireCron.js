// scripts/learningPartnerExpireCron.js
// 學習有伴過期檢查定時任務（server.js 每 15 分鐘呼叫）
// 團體報名（Learning Partner）開關關閉時不執行。

const { isGroupRegistrationEnabled } = require('../services/registrationSettingsService');
const { expirePendingLearningPartnerTeams } = require('../services/learningPartnerExpireService');

/**
 * 掃描並處理過期學習有伴團體。
 * @returns {Promise<{ expired: number, notified: number, skipped?: boolean, reason?: string }>}
 */
async function expireLearningPartnerTeams() {
  const groupEnabled = await isGroupRegistrationEnabled();
  if (!groupEnabled) {
    return {
      expired: 0,
      notified: 0,
      skipped: true,
      reason: 'group_registration_disabled',
    };
  }

  return expirePendingLearningPartnerTeams();
}

module.exports = {
  expireLearningPartnerTeams,
};
