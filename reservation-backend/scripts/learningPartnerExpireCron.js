// scripts/learningPartnerExpireCron.js
// 學習有伴過期檢查定時任務（server.js 每 15 分鐘呼叫）
// 目前為安全 placeholder：不連資料庫、不更新資料，僅記錄略過。

/**
 * 掃描並處理過期學習有伴團體。
 * @returns {Promise<{ expired: number, notified: number }>}
 */
async function expireLearningPartnerTeams() {
  console.log(
    `[${new Date().toISOString()}] [learningPartnerExpireCron] stub: expire check skipped (no-op placeholder)`
  );
  return { expired: 0, notified: 0 };
}

module.exports = {
  expireLearningPartnerTeams,
};
